// Daily stream post — 11am ET (15:00 UTC), set in vercel.json
// Picks the next Michigan river in rotation, fetches live USGS data + hatch
// conditions, generates a full post via Claude API, publishes to
// michigantroutdaily.wordpress.com (site ID 254267068).

import { Redis } from '@upstash/redis';
import { RIVERS } from '../lib/rivers.js';
import { fetchLiveReadings } from '../lib/usgs.js';
import { MICHIGAN_HATCHES, getTempZone } from '../lib/hatches.js';

const WP_SITE_ID  = '254267068';
const WP_API_BASE = `https://public-api.wordpress.com/rest/v1.1/sites/${WP_SITE_ID}`;
const TROUT_APP   = 'https://trout.chrisizworski.com';

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Only rivers with a live gauge (tier 1 or 2)
const GAUGED_RIVERS = RIVERS.filter(r => r.tier <= 2 && r.primaryGauge);

function cfsToReadable(cfs) {
  if (!cfs || isNaN(cfs)) return 'data unavailable';
  if (cfs < 50)  return `${Math.round(cfs)} cfs (very low)`;
  if (cfs < 150) return `${Math.round(cfs)} cfs (low)`;
  if (cfs < 400) return `${Math.round(cfs)} cfs (normal)`;
  if (cfs < 800) return `${Math.round(cfs)} cfs (elevated)`;
  return `${Math.round(cfs)} cfs (high)`;
}

function tempToReadable(tempC) {
  if (tempC === null || tempC === undefined) return null;
  const f = (tempC * 9/5 + 32).toFixed(1);
  return `${f}°F`;
}

function getActiveHatches(month, tempF) {
  return MICHIGAN_HATCHES.filter(h => {
    const inMonth = h.months.includes(month);
    const inTemp  = tempF ? (tempF >= h.tempRange[0] && tempF <= h.tempRange[1]) : inMonth;
    return inMonth && inTemp;
  });
}

async function wrapWithSchema(html, river) {
  const datePublished = new Date().toISOString();
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": html.match(/<h1[^>]*>(.*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g,'') || river.name,
    "datePublished": datePublished,
    "author": {
      "@type": "Person",
      "name": "Chris Izworski",
      "url": "https://chrisizworski.com"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Michigan Trout Daily",
      "url": "https://michigantroutdaily.wordpress.com"
    },
    "about": {
      "@type": "Place",
      "name": river.name,
      "description": river.notes
    }
  };

  const schemaBlock = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
  const byline = `<p style="font-size:0.85em;color:#666;margin-bottom:1.5em;">By <a href="https://chrisizworski.com">Chris Izworski</a> &nbsp;|&nbsp; Michigan Trout Daily &nbsp;|&nbsp; ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>`;

  // Insert byline after opening <h1>, schema at end
  return html.replace(/(<\/h1>)/i, `$1\n${byline}`) + '\n' + schemaBlock;
}

  const today      = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const tempF      = conditions.tempC !== null ? (conditions.tempC * 9/5 + 32).toFixed(1) : null;

  const hatchSummary = hatches.length > 0
    ? hatches.map(h => `${h.name} (${h.latin}) — ${h.presentation}. Top patterns: ${h.patterns.slice(0,3).map(p => `${p.name} #${p.sizes[0]}`).join(', ')}.`).join('\n')
    : 'No major hatches active. Nymphs and streamers recommended.';

  const seasonNote = (() => {
    const m = new Date().getMonth() + 1;
    if (m <= 3)  return 'Early season. Cold water, slow fishing, but the river is alive with possibility. Stoneflies and midges. Anglers willing to be patient.';
    if (m === 4) return 'April. Hendricksons coming. Water still cold but warming. The first real hatch fishing of the year for many Michigan anglers.';
    if (m === 5) return 'May. Caddis and sulphurs building. Trout are active. One of the best months on Michigan rivers.';
    if (m === 6) return 'June. The Hex hatch approaches or is happening on the right rivers. Evening fishing. The air smells like summer.';
    if (m === 7) return 'July. Terrestrial season. Hoppers, ants, beetles. Fish early and late. Midday heat pushes fish deep.';
    if (m === 8) return 'August. Trico mornings. Hot afternoons. The rivers are low and clear. Stealth and small flies.';
    if (m === 9) return 'September. The best kept secret in Michigan trout fishing. Cooler water, fewer anglers, brown trout moving toward spawn.';
    if (m === 10) return 'October. Brown trout season. The maples are going. Streamers and egg patterns. A different kind of fishing.';
    return 'Late season. The crowds are gone. Cold mornings. The river belongs to whoever shows up.';
  })();

  const prompt = `You are writing a post for Michigan Trout Daily, a site for serious Michigan trout anglers. Today is ${today}.

Write 700-900 words about the ${river.name}. This is a conditions and fishing report post. Write it the way a knowledgeable local angler would write it — honest, specific, literary without being precious. Think John Gierach or Nick Lyons, not a tourism brochure. The reader is already a trout fisherman. Do not explain what trout fishing is.

WHAT YOU KNOW ABOUT THIS RIVER (use only what is confirmed here, do not invent details):
- Region: ${river.region}
- Species present: ${river.species.join(', ')}
- Stream character: ${river.type}
- Access: ${river.access}
- Regulations note: ${river.regulations}
- River character: ${river.notes}

TODAY'S MEASURED CONDITIONS (USGS gauge data):
- Flow: ${cfsToReadable(conditions.cfs)}
- Water temperature: ${tempF ? tempF + 'F' : 'not available from gauge today'}
- Gauge height: ${conditions.gaugeHeight ? conditions.gaugeHeight + ' ft' : 'not available'}

SEASON CONTEXT:
${seasonNote}

ACTIVE HATCHES THIS TIME OF YEAR AT THIS WATER TEMPERATURE:
${hatchSummary}

WRITING RULES — follow these exactly:
- Open with the river, the season, and what the conditions mean for an angler deciding whether to make the drive. No manufactured drama.
- If data is unavailable, say so plainly and tell the reader what to watch for instead.
- Hatch and fly information should be specific: name, hook size, presentation. Write it like advice from someone who fishes this water, not a catalog entry.
- Access information should be practical and honest about what you actually know.
- No em dashes anywhere. Use commas, colons, or periods.
- No bullet points. Flowing prose only.
- No exclamation points.
- Do not insert an author's personality or voice into the piece. The river and the fishing are the subject.
- Do not fabricate place names, distances, landmark names, or conditions not in the data above.
- End with a single line pointing to ${TROUT_APP} for live gauge data, worded naturally.
- H2 headers for sections. Make the section headers specific to this river and this day, not generic.
- Output clean HTML only. First line is the post title in an <h1> tag. No markdown, no backticks, no preamble.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  const raw  = data.content?.find(b => b.type === 'text')?.text || '';
  return raw.trim();
}

async function publishToWordPress(title, content, tags) {
  const token = process.env.WP_TROUT_DAILY_TOKEN;
  const res = await fetch(`${WP_API_BASE}/posts/new`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      content,
      status: 'publish',
      tags: tags.join(','),
      format: 'standard',
    }),
  });
  return res.json();
}

export default async function handler(req, res) {
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const log = [];
  const ts  = () => new Date().toISOString();

  try {
    log.push(`[${ts()}] Stream post cron starting`);

    // ── Pick next river in rotation ──────────────────────────────────────
    const r     = makeRedis();
    const key   = 'trout:stream-post:index';
    let   idx   = 0;
    if (r) {
      const stored = await r.get(key);
      idx = stored ? (parseInt(stored, 10) + 1) % GAUGED_RIVERS.length : 0;
      await r.set(key, String(idx));
    }
    const river = GAUGED_RIVERS[idx];
    log.push(`[${ts()}] River selected: ${river.name} (index ${idx})`);

    // ── Fetch live USGS conditions ────────────────────────────────────────
    const readings = await fetchLiveReadings([river.primaryGauge]);
    const raw      = readings[river.primaryGauge] || {};
    const conditions = {
      cfs:         raw.discharge   ?? null,
      tempC:       raw.waterTemp   ?? null,
      gaugeHeight: raw.gaugeHeight ?? null,
    };
    log.push(`[${ts()}] USGS: cfs=${conditions.cfs} tempC=${conditions.tempC}`);

    // ── Match active hatches ──────────────────────────────────────────────
    const month  = new Date().getMonth() + 1;
    const tempF  = conditions.tempC !== null ? conditions.tempC * 9/5 + 32 : null;
    const hatches = getActiveHatches(month, tempF);
    log.push(`[${ts()}] Active hatches: ${hatches.map(h => h.name).join(', ') || 'none'}`);

    // ── Generate post content via Claude ─────────────────────────────────
    const html = await generatePost(river, conditions, hatches);
    log.push(`[${ts()}] Post generated — ${html.length} chars`);

    // ── Wrap with author schema + byline ─────────────────────────────────
    const wrappedHtml = await wrapWithSchema(html, river);

    // ── Extract title from <h1> ───────────────────────────────────────────
    const titleMatch = wrappedHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const title      = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '') : `${river.name} — Today's Conditions`;
    const body       = wrappedHtml.replace(/<h1[^>]*>.*?<\/h1>/i, '').trim();

    // ── Build tags ────────────────────────────────────────────────────────
    const tags = [
      river.name,
      river.region,
      ...river.species.map(s => `${s} trout`),
      'michigan trout',
      'fly fishing michigan',
      'trout stream conditions',
    ];

    // ── Publish to WordPress ──────────────────────────────────────────────
    const wpResult = await publishToWordPress(title, body, tags);
    log.push(`[${ts()}] Published: ${wpResult.URL || wpResult.error}`);

    return res.status(200).json({ success: true, river: river.name, post: wpResult.URL, log });

  } catch(e) {
    log.push(`[${ts()}] ERROR: ${e.message}`);
    return res.status(500).json({ success: false, error: e.message, log });
  }
}
