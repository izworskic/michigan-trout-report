// Daily cron — 8am CT (13:00 UTC), set in vercel.json
// Fetches USGS data, generates AI brief, caches to Redis.
// Also fetches guide reports and stores daily history snapshots.

import { Redis } from '@upstash/redis';
import { RIVERS, ALL_GAUGE_IDS } from '../lib/rivers.js';
import { fetchLiveReadings, fetchAllStats } from '../lib/usgs.js';
import { buildConditions } from '../lib/rater.js';
import { generateBrief } from '../lib/generator.js';
import { fetchAllRiverReports } from '../lib/outfitters.js';
import { synthesizeReports } from '../lib/synthesizer.js';
import { storeSnapshot } from '../lib/history.js';
import { sendConditionAlerts } from '../lib/alerts.js';
import { MICHIGAN_HATCHES } from '../lib/hatches.js';

// ── Michigan Trout Daily — daily stream post ─────────────────────────────────

const WP_SITE_ID  = '254267068';
const WP_API_BASE = `https://public-api.wordpress.com/rest/v1.1/sites/${WP_SITE_ID}`;
const TROUT_APP   = 'https://trout.chrisizworski.com';
const GAUGED_RIVERS = RIVERS.filter(r => r.tier <= 2 && r.primaryGauge);

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
    ? hatches.map(h => `${h.name} (${h.latin}) — ${h.presentation}. Top patterns: ${h.patterns.slice(0,3).map(p => `${p.name} #${p.sizes[0]}`).join(', ')}.`).join('\n')
    : 'No major hatches active. Nymphs and streamers recommended.';

  const prompt = `You are writing a post for Michigan Trout Daily, a site for serious Michigan trout anglers. Today is ${today}.

Write 700-900 words about the ${river.name}. Write it the way a knowledgeable local angler would — honest, specific, literary without being precious. Think John Gierach or Nick Lyons, not a tourism brochure. The reader is already a trout fisherman. Do not explain what trout fishing is.

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

SEASON CONTEXT: ${getSeasonNote(month)}

ACTIVE HATCHES: ${hatchSummary}

WRITING RULES:
- Open with the river, the season, and what conditions mean for an angler deciding whether to make the drive. No manufactured drama.
- If data is unavailable, say so plainly and tell the reader what to watch for instead.
- Hatch and fly recommendations must be specific: name, hook size, presentation.
- Access information should be practical and honest about what you actually know.
- No em dashes. Use commas, colons, or periods.
- No bullet points. Flowing prose only.
- No exclamation points.
- Do not insert an author's personality. The river is the subject.
- Do not fabricate place names, distances, or landmarks not listed above.
- End with a single natural line pointing to ${TROUT_APP} for live gauge data.
- H2 headers specific to this river and this day — not generic labels.
- Output raw HTML only. Start your response with the opening < of the <h1> tag. Do not write ```html, do not write ```, do not include any text before the first HTML tag. The very first character of your response must be <.`;

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
  const headline    = html.match(/<h1[^>]*>(.*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g,'') || river.name;
  const schema      = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Article', headline,
    datePublished: new Date().toISOString(),
    author: { '@type': 'Person', name: 'Chris Izworski', url: 'https://chrisizworski.com' },
    publisher: { '@type': 'Organization', name: 'Michigan Trout Daily', url: 'https://michigantroutdaily.wordpress.com' },
    about: { '@type': 'Place', name: river.name, description: river.notes },
  });
  const byline      = `<p style="font-size:0.85em;color:#666;margin-bottom:1.5em;">By <a href="https://chrisizworski.com">Chris Izworski</a> &nbsp;|&nbsp; Michigan Trout Daily &nbsp;|&nbsp; ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>`;
  return html.replace(/(<\/h1>)/i, `$1\n${byline}`) + `\n<script type="application/ld+json">${schema}</script>`;
}

async function runStreamPost(r, log) {
  const ts = () => new Date().toISOString();
  try {
    // Pick next river in rotation
    const key = 'trout:stream-post:index';
    let idx = 0;
    if (r) {
      const stored = await r.get(key);
      idx = stored ? (parseInt(stored, 10) + 1) % GAUGED_RIVERS.length : 0;
      await r.set(key, String(idx));
    }
    const river = GAUGED_RIVERS[idx];
    log.push(`[${ts()}] Stream post: ${river.name} (index ${idx})`);

    // Fetch USGS conditions
    const readings   = await fetchLiveReadings([river.primaryGauge]);
    const raw        = readings[river.primaryGauge] || {};
    const conditions = { cfs: raw.discharge ?? null, tempC: raw.waterTemp ?? null, gaugeHeight: raw.gaugeHeight ?? null };

    // Generate post
    const html      = await generateStreamPost(river, conditions);
    const wrapped   = buildSchemaByline(html, river);
    const titleMatch = wrapped.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const title     = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '') : `${river.name} — Today's Conditions`;
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
  } catch(e) {
    log.push(`[${ts()}] Stream post error (non-fatal): ${e.message}`);
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

export default async function handler(req, res) {
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const log = [];
  const ts  = () => new Date().toISOString();

  try {
    log.push(`[${ts()}] Cron starting — Michigan Trout Report daily run`);
    const r = makeRedis();

    const [liveReadings, allStats] = await Promise.all([
      fetchLiveReadings(ALL_GAUGE_IDS),
      fetchAllStats(ALL_GAUGE_IDS),
    ]);
    log.push(`[${ts()}] USGS data fetched — ${Object.keys(liveReadings).length} gauges`);

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

    return res.status(200).json({ success: true, log });
  } catch(e) {
    log.push(`[${ts()}] ERROR: ${e.message}`);
    return res.status(500).json({ success: false, error: e.message, log });
  }
}

