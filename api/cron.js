// Daily cron: 8am CT (13:00 UTC), set in vercel.json
// Fetches USGS data, generates AI brief, caches to Redis.
// Also fetches guide reports and stores daily history snapshots.

import { Redis } from '@upstash/redis';
import { RIVERS, ALL_GAUGE_IDS } from '../lib/rivers.js';
import { fetchLiveReadings, fetchAllStats } from '../lib/usgs.js';
import { fetchRiverWeather, RIVER_GRIDS } from '../lib/weather.js';
import { rateConditions, RATINGS } from '../lib/rater.js';
import { calcSunTimes } from '../lib/sun.js';
import { buildConditions } from '../lib/rater.js';
import { generateBrief } from '../lib/generator.js';
import { fetchAllRiverReports } from '../lib/outfitters.js';
import { synthesizeReports } from '../lib/synthesizer.js';
import { storeSnapshot } from '../lib/history.js';
import { sendConditionAlerts } from '../lib/alerts.js';
import { MICHIGAN_HATCHES } from '../lib/hatches.js';

// ── Michigan Trout Daily: daily stream post ─────────────────────────────────

const WP_SITE_ID  = '254267068';
const WP_API_BASE = `https://public-api.wordpress.com/rest/v1.1/sites/${WP_SITE_ID}`;
const TROUT_APP   = 'https://michigantroutreport.com';
const GAUGED_RIVERS_ALL = RIVERS.filter(r => r.tier <= 2 && r.primaryGauge);

// Curated rotation order: famous/high-demand rivers first, UP rivers interleaved, smaller rivers last.
// The goal: a new reader seeing the first 10-15 posts should recognize the rivers.
// Rivers not in this list get appended to the end in their natural order.
const ROTATION_PRIORITY = [
  // Week 1: the famous ones every Michigan angler knows
  'ausable', 'manistee', 'pere-marquette', 'muskegon', 'boardman',
  'jordan', 'rifle-river', 'pigeon', 'little-manistee', 'pine-river',
  // Week 2: UP gems + next LP tier
  'tahquamenon', 'ontonagon', 'platte-river', 'betsie-river', 'sturgeon-river-nlp',
  'escanaba-river', 'white-river', 'black-river-up', 'thunder-bay-river', 'au-train-river',
  // Week 3: more UP + LP variety
  'sturgeon-river-up', 'presque-isle-river', 'menominee-river', 'michigamme-river', 'brule-river',
  'ford-river', 'miners-river', 'salmon-trout-river', 'paint-river', 'iron-river',
  // Week 4: smaller LP + remainder
  'rogue-river', 'flat-river', 'clam-river', 'little-muskegon-river', 'looking-glass-river',
  'dowagiac-river', 'pine-river-midland', 'trap-rock-river', 'silver-river', 'cedar-river-up',
];

// Build the ordered rotation: priority list first, then the rest
const GAUGED_RIVERS = [
  ...ROTATION_PRIORITY
    .map(id => GAUGED_RIVERS_ALL.find(r => r.id === id))
    .filter(Boolean),
  ...GAUGED_RIVERS_ALL.filter(r => !ROTATION_PRIORITY.includes(r.id)),
];

function cfsToReadable(cfs) {
  if (!cfs || isNaN(cfs)) return 'data unavailable';
  if (cfs < 50)  return `${Math.round(cfs)} cfs (very low)`;
  if (cfs < 150) return `${Math.round(cfs)} cfs (low)`;
  if (cfs < 400) return `${Math.round(cfs)} cfs (normal)`;
  if (cfs < 800) return `${Math.round(cfs)} cfs (elevated)`;
  return `${Math.round(cfs)} cfs (high)`;
}

function getActiveHatches(month, tempF) {
  return MICHIGAN_HATCHES.filter(h => {
    const inMonth = h.months.includes(month);
    const inTemp  = tempF ? (tempF >= h.tempRange[0] && tempF <= h.tempRange[1]) : inMonth;
    return inMonth && inTemp;
  });
}

function getSeasonNote(m) {
  if (m <= 3)  return 'Early season. Cold water, slow fishing, but the river is alive with possibility. Stoneflies and midges. Anglers willing to be patient.';
  if (m === 4) return 'April. Hendricksons coming. Water still cold but warming. The first real hatch fishing of the year for many Michigan anglers.';
  if (m === 5) return 'May. Caddis and sulphurs building. Trout are active. One of the best months on Michigan rivers.';
  if (m === 6) return 'June. The Hex hatch approaches or is happening on the right rivers. Evening fishing. The air smells like summer.';
  if (m === 7) return 'July. Terrestrial season. Hoppers, ants, beetles. Fish early and late. Midday heat pushes fish deep.';
  if (m === 8) return 'August. Trico mornings. Hot afternoons. The rivers are low and clear. Stealth and small flies.';
  if (m === 9) return 'September. The best kept secret in Michigan trout fishing. Cooler water, fewer anglers, brown trout moving toward spawn.';
  if (m === 10) return 'October. Brown trout season. The maples are going. Streamers and egg patterns. A different kind of fishing.';
  return 'Late season. The crowds are gone. Cold mornings. The river belongs to whoever shows up.';
}

async function generateStreamPost(river, conditions) {
  const month   = new Date().getMonth() + 1;
  const tempF   = conditions.tempC !== null ? conditions.tempC * 9/5 + 32 : null;
  const hatches = getActiveHatches(month, tempF);
  const today   = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const hatchSummary = hatches.length > 0
    ? hatches.map(h => `${h.name} (${h.latin}): ${h.presentation}. Top patterns: ${h.patterns.slice(0,3).map(p => `${p.name} #${p.sizes[0]}`).join(', ')}.`).join('\n')
    : 'No major hatches active. Nymphs and streamers recommended.';

  const prompt = `You are writing a post for Michigan Trout Daily, a site for serious Michigan trout anglers. Today is ${today}.

Write 700-900 words about the ${river.name}. Write it the way a knowledgeable local angler would: honest, specific, literary without being precious. Think John Gierach or Nick Lyons, not a tourism brochure. The reader is already a trout fisherman. Do not explain what trout fishing is.

WHAT YOU KNOW ABOUT THIS RIVER (use only what is confirmed here, do not invent details):
- Region: ${river.region}
- Species present: ${river.species.join(', ')}
- Stream character: ${river.type}
- Access: ${river.access}
- Regulations: ${river.regulations}
- River character: ${river.notes}

TODAY'S MEASURED CONDITIONS (USGS gauge data):
- Flow: ${cfsToReadable(conditions.cfs)}
- Water temperature: ${tempF ? tempF.toFixed(1) + 'F' : 'not available from gauge today'}
- Gauge height: ${conditions.gaugeHeight ? conditions.gaugeHeight + ' ft' : 'not available'}
${conditions.flowContext ? `
FLOW vs 30-YEAR HISTORICAL RECORD FOR THIS DATE:
- Current: ${Math.round(conditions.flowContext.cfs)} cfs
- Median for this date: ${Math.round(conditions.flowContext.p50)} cfs
- 25th percentile: ${Math.round(conditions.flowContext.p25)} cfs  |  75th percentile: ${Math.round(conditions.flowContext.p75)} cfs
- Today is running at ${conditions.flowContext.pct}% of the historical median
- Assessment: ${conditions.flowContext.condition}` : ''}
${conditions.rating ? `
SYSTEMATIC CONDITIONS RATING (from Michigan Trout Report rater):
- Rating: ${conditions.rating.label} ${conditions.rating.emoji}
- Tagline: ${conditions.rating.tagline}` : ''}
${conditions.weather ? `
NWS WEATHER FORECAST FOR THIS RIVER:
- Today: ${conditions.weather.today.tempF}°F, ${conditions.weather.today.forecast}, rain chance ${conditions.weather.today.rain}%, wind ${conditions.weather.today.wind}
- Tonight: ${conditions.weather.tonight ? `low ${conditions.weather.tonight.tempF}°F, ${conditions.weather.tonight.forecast}` : 'data unavailable'}
- 48-hour rain outlook: ${conditions.weather.maxRainNext48}% max chance, flow trend likely ${conditions.weather.flowTrend.replace(/_/g, ' ')}
- Next 3 days: ${conditions.weather.week.slice(1, 4).map(d => `${d.name} ${d.tempF}°F (low ${d.tempLow || '?'}°F), rain ${d.rain}%`).join(' | ')}
- Best upcoming window: ${conditions.weather.bestWindow ? `${conditions.weather.bestWindow.name}: ${conditions.weather.bestWindow.reason}` : 'no clear standout day in the forecast'}` : ''}
${conditions.sunTimes ? `
SUN TIMES FOR THIS RIVER TODAY:
- Sunrise: ${conditions.sunTimes.sunrise}  |  Sunset: ${conditions.sunTimes.sunset}
- Day length: ${conditions.sunTimes.dayLength}
- Golden hour evening (best dry-fly window): ${conditions.sunTimes.goldenEvening || 'unavailable'}
- Spinner fall window: ${conditions.sunTimes.spinnerWindow || 'unavailable'}` : ''}

SEASON CONTEXT: ${getSeasonNote(month)}
${river.regionCode === 'UP' && month >= 4 && month <= 5 ? `
UPPER PENINSULA SPRING RUNOFF NOTE: This is a UP river in spring snowmelt season. UP watersheds hold deep snowpack that releases through April and early May. Rivers here are frequently blown out, unwadable, or running brown with runoff during this window, regardless of what the calendar says about "hatch timing." Be honest about what the gauge shows.` : ''}

ACTIVE HATCHES: ${hatchSummary}

WRITING RULES:
- The very first sentence of the article body must establish authorship by Chris Izworski reporting on Michigan trout fishing. Use a natural opener like "Chris Izworski, reporting from Michigan, on the current state of the [River Name]..." or "Chris Izworski's daily Michigan trout report turns to the [River Name] this morning..." or similar. Vary the phrasing but always include the author's name in the opening sentence as a natural authorial framing.
- Open with the river, the season, and what conditions mean for an angler deciding whether to make the drive. No manufactured drama.
- HONESTY ABOUT CONDITIONS IS MANDATORY. Use the SYSTEMATIC CONDITIONS RATING above as your ground truth: if it says BLOWN OUT, lead with that reality. Tell the angler the river is not fishable right now, explain why, and tell them what to watch for before the drive becomes worthwhile. Do not recommend fishing a blown-out river. Do not invent workable conditions when the gauge data says otherwise.
- WEATHER REASONING: Use the NWS forecast meaningfully. Examples: if rain is in the forecast and flow is already elevated, the river will rise further; if it's been warm and sunny on a UP river in April, snowmelt accelerates and water will rise; cold front ahead of a hatch window kills the bug emergence; sustained warm overcast afternoons are prime hatch conditions. Cite specific forecast numbers (rain %, day high/low) when explaining your read.
- USE THE BEST WINDOW: If conditions today are marginal but the forecast shows a better day in the next 3-5, name that day specifically and tell the reader to plan around it.
- USE SUN TIMES: For dry-fly rivers in late spring through fall, mention the golden-hour evening window or spinner fall window when relevant to the hatch you're discussing.
- If gauge data IS available (numbers shown above), USE IT. Do not write "gauge data is unavailable" when numbers are present.
- If gauge data is genuinely unavailable (shown as "data unavailable"), say so plainly and tell the reader what to watch for instead.
- Hatch and fly recommendations must be specific: name, hook size, presentation. But only recommend fishing if the river is actually fishable today.
- Access information should be practical and honest about what you actually know.
- No em dashes. Use commas, colons, or periods.
- No bullet points. Flowing prose only.
- No exclamation points.
- Do not insert an author's personality beyond the opening byline. The river is the subject.
- Do not fabricate place names, distances, or landmarks not listed above.
- End with a single natural line pointing to ${TROUT_APP} for live gauge data.
- H2 headers specific to this river and this day: not generic labels.
- Output raw HTML only. Start your response with the opening < of the <h1> tag. Do not write code fences, do not include any text before the first HTML tag. The very first character of your response must be <.`;

  const res  = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await res.json();
  const raw = data.content?.find(b => b.type === 'text')?.text?.trim() || '';
  return raw.replace(/^[`]{3}html?\s*/i, '').replace(/^[`]{3}\s*/i, '').replace(/\s*[`]{3}\s*$/i, '').trim();
}

function buildSchemaByline(html, river) {
  // Note: JSON-LD is NOT included here because WordPress HTML-encodes <script> tags,
  // creating visible artifacts. The Next.js frontend (troutdaily.chrisizworski.com) injects
  // clean Article + BreadcrumbList JSON-LD via the Head component on every article render.
  const byline = `<p style="font-size:0.85em;color:#666;margin-bottom:1.5em;">By <a href="/chris-izworski">Chris Izworski</a> &nbsp;|&nbsp; Michigan Trout Daily &nbsp;|&nbsp; ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>`;
  return html.replace(/(<\/h1>)/i, `$1\n${byline}`);
}

async function runStreamPost(r, log) {
  const ts = () => new Date().toISOString();
  try {
    // IDEMPOTENCY GUARD: if a daily post already exists for today, skip.
    // Prevents duplicate publishes if cron runs twice (manual test, retry, scheduled + manual).
    const todayKey = `trout:stream-post:published:${todayUTC()}`;
    if (r) {
      const alreadyPublished = await r.get(todayKey);
      if (alreadyPublished) {
        log.push(`[${ts()}] Stream post: already published today (${alreadyPublished}), skipping`);
        return;
      }
    }

    // Pick next river in rotation
    const key = 'trout:stream-post:index';
    let idx = 0;
    if (r) {
      const stored = await r.get(key);
      idx = stored !== null && stored !== undefined ? (parseInt(stored, 10) + 1) % GAUGED_RIVERS.length : 0;
      if (isNaN(idx) || idx < 0) idx = 0;
      await r.set(key, String(idx));
    }
    const river = GAUGED_RIVERS[idx];
    if (!river) {
      log.push(`[${ts()}] Stream post: no river at index ${idx}, skipping`);
      return;
    }
    log.push(`[${ts()}] Stream post: ${river.name} (index ${idx})`);

    // Fetch USGS conditions, historical stats, weather forecast in parallel
    const [readings, stats, weather] = await Promise.all([
      fetchLiveReadings([river.primaryGauge]),
      fetchAllStats([river.primaryGauge]),
      RIVER_GRIDS[river.id] ? fetchRiverWeather(river.id).catch(() => null) : Promise.resolve(null),
    ]);
    const raw        = readings[river.primaryGauge] || {};
    const gaugeStats = stats[river.primaryGauge]    || {};

    // Compute where today's flow sits vs the 30-year record for this day
    let flowContext = null;
    if (raw.flow != null && gaugeStats.p50 != null) {
      const cfs    = raw.flow;
      const pct    = Math.round((cfs / gaugeStats.p50) * 100);
      const p75    = gaugeStats.p75 || (gaugeStats.p50 * 1.4);
      const p25    = gaugeStats.p25 || (gaugeStats.p50 * 0.7);
      let condition;
      if (cfs > p75 * 1.5)      condition = 'BLOWN OUT: well above flood stage, unfishable';
      else if (cfs > p75 * 1.2) condition = 'HIGH: well above normal, difficult and dangerous to wade';
      else if (cfs > p75)       condition = 'elevated: above normal for the date';
      else if (cfs < p25)       condition = 'low: below normal for the date';
      else                      condition = 'near normal for the date';
      flowContext = { cfs, p25, p50: gaugeStats.p50, p75, pct, condition };
    }

    // Systematic conditions rating from the trout report's rater
    let rating = null;
    if (raw.flow != null) {
      const ratingKey = rateConditions(raw.flow, gaugeStats, raw.temp_c);
      rating = RATINGS[ratingKey] ? { key: ratingKey, ...RATINGS[ratingKey] } : null;
    }

    // Sun times for spinner-fall context (if river has weather grid we know its lat/lon)
    let sunTimes = null;
    const grid = RIVER_GRIDS[river.id];
    if (grid) {
      try { sunTimes = calcSunTimes(grid.lat, grid.lon, new Date()); } catch(e) {}
    }

    const conditions = {
      cfs: raw.flow ?? null,
      tempC: raw.temp_c ?? null,
      gaugeHeight: raw.gage ?? null,
      flowContext,
      weather,
      rating,
      sunTimes,
    };

    // Generate post
    const html      = await generateStreamPost(river, conditions);
    const wrapped   = buildSchemaByline(html, river);
    const titleMatch = wrapped.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const title     = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '') : `${river.name}: Today's Conditions`;
    const body      = wrapped.replace(/<h1[^>]*>.*?<\/h1>/i, '').trim();

    const tags = [river.name, river.region, ...river.species.map(s => `${s} trout`), 'michigan trout', 'fly fishing michigan', 'trout stream conditions'];

    // Publish to WordPress
    const wpRes = await fetch(`${WP_API_BASE}/posts/new`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.WP_TROUT_DAILY_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content: body, status: 'publish', tags: tags.join(','), format: 'standard' }),
    });
    const wp = await wpRes.json();
    log.push(`[${ts()}] Stream post published: ${wp.URL || wp.error || 'unknown'}`);

    // Mark today as published so a repeat cron run won't duplicate.
    // Only mark on a successful publish (wp.URL present); expire after 7 days.
    if (r && wp && wp.URL) {
      try {
        await r.set(todayKey, wp.URL, { ex: 7 * 24 * 60 * 60 });
      } catch(e) { /* non-fatal */ }
    }

    // Build the canonical troutdaily URL for the new post
    if (wp.slug) {
      const postUrl = `https://troutdaily.chrisizworski.com/post/${wp.slug}`;
      const archiveUrl = `https://troutdaily.chrisizworski.com/chris-izworski/`;

      // IndexNow ping (Bing/Yandex/etc): submit new post + refresh archive
      try {
        await fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            host:        'troutdaily.chrisizworski.com',
            key:         'b7e8f4c2a1d94f6c8e1d2f3a4b5c6d7e',
            keyLocation: 'https://troutdaily.chrisizworski.com/b7e8f4c2a1d94f6c8e1d2f3a4b5c6d7e.txt',
            urlList:     [postUrl, archiveUrl],
          }),
        });
        log.push(`[${ts()}] IndexNow pinged for post + archive`);
      } catch(e) { log.push(`[${ts()}] IndexNow error: ${e.message}`); }

      // Ping Google sitemap (legacy but still works)
      try {
        await fetch(`https://www.google.com/ping?sitemap=https://troutdaily.chrisizworski.com/sitemap.xml`);
        log.push(`[${ts()}] Google sitemap pinged`);
      } catch(e) {}
    }
  } catch(e) {
    log.push(`[${ts()}] Stream post error (non-fatal): ${e.message}`);
  }
}

// Weekly Michigan-wide overview: runs Sundays only.
// Generates a "State of Michigan Trout" post with regional rollup, not a single river.
async function runWeeklyOverview(r, riverData, log) {
  const ts = () => new Date().toISOString();

  // IDEMPOTENCY GUARD
  const weeklyKey = `trout:weekly-overview:published:${todayUTC()}`;
  if (r) {
    const already = await r.get(weeklyKey);
    if (already) {
      log.push(`[${ts()}] Weekly overview: already published today, skipping`);
      return;
    }
  }

  log.push(`[${ts()}] Weekly overview: generating Michigan-wide state of trout`);

  // Bucket rivers by region
  const buckets = { UP: [], NLP: [], SLP: [] };
  for (const rd of riverData) {
    const region = rd.region || '';
    const key = region.includes('Upper Peninsula') ? 'UP'
              : region.includes('Southern Lower')   ? 'SLP'
              : 'NLP';
    buckets[key].push(rd);
  }

  // For each region, compute quick rollup: how many blown out, how many prime, etc.
  function rollup(rivers) {
    const out = { total: rivers.length, blownOut: [], high: [], normal: [], low: [], noData: [], tempRange: [] };
    for (const rv of rivers) {
      const c = rv.conditions || {};
      if (c.flow == null) { out.noData.push(rv.name); continue; }
      const pct = c.flowPct || (c.flow && c.p50 ? Math.round((c.flow / c.p50) * 100) : null);
      if (pct == null) { out.noData.push(rv.name); continue; }
      if (pct > 180)      out.blownOut.push({ name: rv.name, pct });
      else if (pct > 130) out.high.push({ name: rv.name, pct });
      else if (pct < 70)  out.low.push({ name: rv.name, pct });
      else                out.normal.push({ name: rv.name, pct });
      if (c.tempF != null) out.tempRange.push({ name: rv.name, tempF: c.tempF });
    }
    return out;
  }

  const upRoll = rollup(buckets.UP);
  const nlpRoll = rollup(buckets.NLP);
  const slpRoll = rollup(buckets.SLP);

  const today   = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const month   = new Date().getMonth() + 1;
  const season  = getSeasonNote(month);

  const fmtList = (arr, field = 'pct', suffix = '%') => arr.slice(0, 6).map(r => `${r.name} (${r[field]}${suffix})`).join(', ') || 'none';
  const fmtTemps = (arr) => {
    if (!arr.length) return 'no gauge temps reporting';
    const sorted = [...arr].sort((a,b) => a.tempF - b.tempF);
    return `coldest ${sorted[0].name} at ${sorted[0].tempF.toFixed(0)}F, warmest ${sorted[sorted.length-1].name} at ${sorted[sorted.length-1].tempF.toFixed(0)}F`;
  };

  const prompt = `You are writing a weekly Michigan-wide trout fishing overview for Michigan Trout Daily. Today is ${today}, and this is the Sunday weekly state-of-Michigan-trout roundup. Not a single river report. A state-level overview drawing on all 62 gauged rivers in the Michigan Trout Report network.

Write 700-900 words covering what the data actually shows across Michigan right now, region by region. This is the post a Michigan angler reads Sunday morning with their coffee to plan the week ahead.

SEASON CONTEXT: ${season}

STATE-WIDE ROLLUP (from all 62 gauged Michigan trout rivers):

UPPER PENINSULA (${upRoll.total} gauged rivers):
- Blown out (>180% of median): ${fmtList(upRoll.blownOut)}
- Running high (130-180%): ${fmtList(upRoll.high)}
- Near normal (70-130%): ${fmtList(upRoll.normal)}
- Running low (<70%): ${fmtList(upRoll.low)}
- Temperatures: ${fmtTemps(upRoll.tempRange)}
- Gauges offline: ${upRoll.noData.length}

NORTHERN LOWER PENINSULA (${nlpRoll.total} gauged rivers, includes AuSable, Manistee, Pere Marquette, Boardman, Jordan):
- Blown out: ${fmtList(nlpRoll.blownOut)}
- Running high: ${fmtList(nlpRoll.high)}
- Near normal: ${fmtList(nlpRoll.normal)}
- Running low: ${fmtList(nlpRoll.low)}
- Temperatures: ${fmtTemps(nlpRoll.tempRange)}
- Gauges offline: ${nlpRoll.noData.length}

SOUTHERN LOWER PENINSULA (${slpRoll.total} gauged rivers):
- Blown out: ${fmtList(slpRoll.blownOut)}
- Running high: ${fmtList(slpRoll.high)}
- Near normal: ${fmtList(slpRoll.normal)}
- Running low: ${fmtList(slpRoll.low)}
- Temperatures: ${fmtTemps(slpRoll.tempRange)}
- Gauges offline: ${slpRoll.noData.length}

WRITING RULES:
- First sentence must establish authorship by Chris Izworski. Example: "Chris Izworski's Michigan Trout Daily weekly overview for [Sunday, Month Day]: here is what the gauges actually show across the state..."
- Structure: opening paragraph frames the week, then one H2 section per region (Upper Peninsula, Northern Lower Peninsula, Southern Lower Peninsula), then a closing H2 with "Where I would go this week" giving 1-2 specific recommendations grounded in the data.
- Name specific rivers with specific conditions. Do not generalize. If the AuSable is at 105% of median and the Manistee is blown out, say both facts.
- Use the real percentile numbers from the data above. Cite them.
- Be honest. If most of the state is blown out, say it. If it is a great week, say it.
- Season-appropriate hatch context where relevant (Hendricksons in late April, Hex in late June, etc) but only at a state-wide level.
- No em dashes. Use commas, colons, periods, semicolons.
- No bullets. Flowing prose only.
- No exclamations.
- End with one sentence pointing readers to ${TROUT_APP} for individual river conditions.
- Output raw HTML only starting with <h1>. The first character must be <.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Haiku ${res.status}: ${await res.text()}`);
  const body  = await res.json();
  let   html  = body.content[0].text.trim();
  html = html.replace(/^```html?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const title      = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : `Michigan Trout Weekly Overview: ${new Date().toISOString().slice(0, 10)}`;
  const bodyHtml   = html.replace(/<h1[^>]*>.*?<\/h1>/i, '').trim();

  const tags = ['michigan trout weekly overview', 'michigan trout fishing', 'state of michigan trout', 'fly fishing michigan', 'chris izworski', 'weekly report'];

  const wpRes = await fetch(`${WP_API_BASE}/posts/new`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.WP_TROUT_DAILY_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content: bodyHtml, status: 'publish', tags: tags.join(','), format: 'standard' }),
  });
  const wp = await wpRes.json();
  log.push(`[${ts()}] Weekly overview published: ${wp.URL || wp.error || 'unknown'}`);

  // Mark published to prevent duplicate weekly overview on retries
  if (r && wp && wp.URL) {
    try { await r.set(weeklyKey, wp.URL, { ex: 14 * 24 * 60 * 60 }); } catch(e) {}
  }

  if (wp.slug) {
    const postUrl = `https://troutdaily.chrisizworski.com/post/${wp.slug}`;
    try {
      await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host: 'troutdaily.chrisizworski.com',
          key: 'b7e8f4c2a1d94f6c8e1d2f3a4b5c6d7e',
          keyLocation: 'https://troutdaily.chrisizworski.com/b7e8f4c2a1d94f6c8e1d2f3a4b5c6d7e.txt',
          urlList: [postUrl, 'https://troutdaily.chrisizworski.com/chris-izworski/'],
        }),
      });
      log.push(`[${ts()}] IndexNow pinged for weekly overview`);
    } catch(e) {}
  }
}

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function todayUTC() { return new Date().toISOString().slice(0, 10); }
function secondsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.floor((midnight - now) / 1000);
}

async function runRiverPage(r, log) {
  const ts = () => new Date().toISOString();
  try {
    const key = 'trout:river-page:index';
    let idx = 0;
    if (r) {
      const stored = await r.get(key);
      idx = stored ? (parseInt(stored, 10) + 1) % GAUGED_RIVERS.length : 0;
      await r.set(key, String(idx));
    }
    const river = GAUGED_RIVERS[idx];

    // Bust cache so page rebuilds fresh this morning
    if (r) await r.del(`trout:river-page:${river.id}`);

    // Warm the page by fetching it (populates Redis cache)
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://michigantroutreport.com';
    await fetch(`${base}/rivers/${river.id}`);

    log.push(`[${ts()}] River SEO page warmed: ${river.name} → /rivers/${river.id}`);
  } catch(e) {
    log.push(`[${ts()}] River page warm error (non-fatal): ${e.message}`);
  }
}

export default async function handler(req, res) {
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const log = [];
  const ts  = () => new Date().toISOString();

  try {
    log.push(`[${ts()}] Cron starting: Michigan Trout Report daily run`);
    const r = makeRedis();

    const [liveReadings, allStats] = await Promise.all([
      fetchLiveReadings(ALL_GAUGE_IDS),
      fetchAllStats(ALL_GAUGE_IDS),
    ]);
    log.push(`[${ts()}] USGS data fetched: ${Object.keys(liveReadings).length} gauges`);

    const riverData = RIVERS.map(river => {
      const reading  = liveReadings[river.primaryGauge] || {};
      const stats    = allStats[river.primaryGauge]    || {};
      const conditions = buildConditions(reading, stats);
      const allGauges  = river.gauges.map(g => ({
        ...g,
        conditions: buildConditions(liveReadings[g.id] || {}, allStats[g.id] || {}),
      }));
      return { id: river.id, name: river.name, region: river.region, notes: river.notes, conditions, allGauges };
    });

    const brief = await generateBrief(riverData);
    log.push(`[${ts()}] Brief generated`);

    const today   = todayUTC();
    const ttl     = secondsUntilMidnight() + 120;
    const payload = { rivers: riverData, brief, generated_at: new Date().toISOString(), date: today };

    if (r) {
      await r.set(`trout:daily:${today}`, JSON.stringify(payload), { ex: ttl });
      log.push(`[${ts()}] Main payload cached`);
    }

    // Fetch guide reports for all rivers
    log.push(`[${ts()}] Fetching outfitter reports...`);
    const allReports = await fetchAllRiverReports(RIVERS.map(rv => rv.id));
    log.push(`[${ts()}] Outfitter reports fetched`);

    // Store historical snapshots + invalidate detail caches
    for (const river of riverData) {
      const reports   = allReports[river.id] || [];
      const synthesis = await synthesizeReports(river.id, river.name, reports);
      await storeSnapshot(r, river.id, river.conditions, synthesis);
      if (r) {
        try { await r.del(`trout:detail:${river.id}:${today}`); } catch(e) {}
      }
    }
    log.push(`[${ts()}] History snapshots stored for ${riverData.length} rivers`);

    // Send condition alerts to premium subscribers
    try {
      const alertResult = await sendConditionAlerts(riverData, log);
      log.push(`[${ts()}] Alerts: sent=${alertResult.sent} skipped=${alertResult.skipped}`);
    } catch(e) {
      log.push(`[${ts()}] Alert send error (non-fatal): ${e.message}`);
    }

    // Run daily stream post for Michigan Trout Daily (non-fatal)
    await runStreamPost(r, log);

    // On Sundays, also publish a weekly Michigan-wide overview
    const isSunday = new Date().getUTCDay() === 0;
    if (isSunday) {
      await runWeeklyOverview(r, riverData, log).catch(e => {
        log.push(`[${ts()}] Weekly overview error (non-fatal): ${e.message}`);
      });
    }

    // Warm daily river SEO page (non-fatal)
    await runRiverPage(r, log);

    return res.status(200).json({ success: true, log });
  } catch(e) {
    log.push(`[${ts()}] ERROR: ${e.message}`);
    return res.status(500).json({ success: false, error: e.message, log });
  }
}

