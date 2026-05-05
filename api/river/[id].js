// GET /api/river/[id]: JSON data API (default)
// GET /rivers/:id (rewritten to this): HTML SEO page
// Behavior switches on req.url path.

import { Redis } from '@upstash/redis';
import { RIVERS } from '../../lib/rivers.js';
import { fetchLiveReadings, fetchAllStats } from '../../lib/usgs.js';
import { buildConditions } from '../../lib/rater.js';
import { fetchRiverReports } from '../../lib/outfitters.js';
import { synthesizeReports } from '../../lib/synthesizer.js';
import { findSimilarDays } from '../../lib/history.js';
import { MICHIGAN_HATCHES } from '../../lib/hatches.js';

const SITE       = 'https://trout.chrisizworski.com';
const AUTHOR     = 'Chris Izworski';
const AUTHOR_URL = 'https://chrisizworski.com';
const DAILY      = 'https://troutdaily.chrisizworski.com';

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const CACHE_TTL = 6 * 60 * 60;

// ── SEO HTML PAGE BUILDER ───────────────────────────────────────────────
function cfsLabel(cfs) {
  if (!cfs || isNaN(cfs)) return null;
  if (cfs < 50)  return `${Math.round(cfs)} cfs: very low`;
  if (cfs < 150) return `${Math.round(cfs)} cfs: low`;
  if (cfs < 400) return `${Math.round(cfs)} cfs: normal`;
  if (cfs < 800) return `${Math.round(cfs)} cfs: elevated`;
  return `${Math.round(cfs)} cfs: high`;
}

function buildSEOPage(river, conditions, hatches) {
  const monthName = new Date().toLocaleString('en-US', { month: 'long' });
  const year      = new Date().getFullYear();
  const dateStr   = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const flow      = cfsLabel(conditions?.cfs);
  const temp      = conditions?.tempC != null ? `${(conditions.tempC * 9/5 + 32).toFixed(1)}°F` : null;
  const rating    = conditions?.rating || null;

  const hatchRows = hatches.map(h => `<tr>
    <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:600;color:#111;">${h.name}</td>
    <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#555;font-size:14px;font-style:italic;">${h.latin}</td>
    <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#444;font-size:14px;">${h.patterns.slice(0,2).map(p=>`${p.name} #${p.sizes[0]}`).join(', ')}</td>
    <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#555;font-size:13px;">${h.timeOfDay}</td></tr>`).join('');

  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'Article',
      headline: `${river.name} Fly Fishing Conditions: ${monthName} ${year}`,
      description: `Live ${river.name} trout fishing conditions. USGS flow ${flow || 'data'}, water temperature, active hatches, and fly recommendations for ${monthName} ${year}. By ${AUTHOR}.`,
      dateModified: new Date().toISOString(),
      datePublished: new Date().toISOString(),
      author: { '@type': 'Person', name: AUTHOR, url: AUTHOR_URL, sameAs: [AUTHOR_URL, DAILY, 'https://www.wikidata.org/wiki/Q138283432'] },
      publisher: { '@type': 'Organization', name: 'Michigan Trout Report', url: SITE },
      about: { '@type': 'Place', name: river.name, description: river.notes },
      keywords: `${river.name}, michigan trout fishing, fly fishing michigan, ${river.species.join(', ')} trout, USGS stream conditions, ${AUTHOR}`,
      mainEntityOfPage: `${SITE}/rivers/${river.id}`,
    }, {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: AUTHOR, item: AUTHOR_URL },
        { '@type': 'ListItem', position: 2, name: 'Michigan Trout Report', item: SITE },
        { '@type': 'ListItem', position: 3, name: river.name, item: `${SITE}/rivers/${river.id}` },
      ]
    }, {
      '@type': 'Dataset',
      name: `${river.name} Live Conditions`,
      description: `Real-time USGS gauge data for the ${river.name}`,
      url: `${SITE}/rivers/${river.id}`,
      creator: { '@type': 'Person', name: AUTHOR, url: AUTHOR_URL },
      variableMeasured: ['stream discharge', 'water temperature', 'gauge height'],
    }]
  });

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${AUTHOR}: ${river.name} Fly Fishing Conditions ${monthName} ${year}: Michigan Trout Report</title>
<meta name="description" content="${AUTHOR} reports live ${river.name} trout fishing conditions for ${monthName} ${year}. USGS flow data, water temperature, active hatches, and fly recommendations. Updated daily.">
<meta name="author" content="${AUTHOR}">
<link rel="canonical" href="${SITE}/rivers/${river.id}">
<link rel="author" href="${AUTHOR_URL}">
<meta property="og:type" content="article">
<meta property="og:title" content="${AUTHOR}: ${river.name} Conditions: ${monthName} ${year}">
<meta property="og:description" content="Live USGS conditions, active hatches, and fly recommendations for the ${river.name}.">
<meta property="og:url" content="${SITE}/rivers/${river.id}">
<meta property="og:site_name" content="Michigan Trout Report">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="article:author" content="${AUTHOR_URL}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${AUTHOR}: ${river.name} Conditions">
<meta name="twitter:description" content="Live ${river.name} fly fishing conditions and hatch report.">
<meta name="twitter:image" content="${SITE}/og-image.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script type="application/ld+json">${schema}</script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--green:#1a5c3a;--ink:#111;--ink2:#444;--ink3:#777;--rule:#ddd;--bg:#fff;--bg2:#f7f7f5}
body{font-family:Georgia,'Times New Roman',serif;background:var(--bg);color:var(--ink);line-height:1.6;font-size:16px}
a{color:var(--green);text-decoration:none}a:hover{text-decoration:underline}
.site-header{border-bottom:3px solid var(--ink);padding:13px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
.header-brand{font-family:Georgia,serif;font-size:20px;font-weight:700;color:var(--ink)}
.header-brand:hover{color:var(--green);text-decoration:none}
.header-nav{font-family:'Courier New',monospace;font-size:11px;letter-spacing:.1em;display:flex;gap:20px}
.header-nav a{color:var(--ink3);text-transform:uppercase}.header-nav a:hover{color:var(--green);text-decoration:none}
.wrap{max-width:860px;margin:0 auto;padding:0 24px 80px}
.breadcrumb{font-family:'Courier New',monospace;font-size:11px;color:var(--ink3);letter-spacing:.08em;padding:16px 0;text-transform:uppercase}
.breadcrumb a{color:var(--ink3)}.breadcrumb a:hover{color:var(--green);text-decoration:none}
h1{font-family:Georgia,serif;font-size:clamp(28px,5vw,44px);font-weight:700;line-height:1.1;margin-bottom:10px}
.byline{font-family:'Courier New',monospace;font-size:12px;color:var(--ink3);margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--rule)}
.byline a{color:var(--green)}
.conditions-bar{background:var(--bg2);border-top:3px solid var(--ink);padding:20px 24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:36px}
.cond-label{font-family:'Courier New',monospace;font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink3);margin-bottom:4px}
.cond-value{font-size:20px;font-weight:700;color:var(--ink)}
.cond-sub{font-family:'Courier New',monospace;font-size:11px;color:var(--ink3);margin-top:2px}
.section-head{font-family:'Courier New',monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--green);margin:36px 0 14px;padding-bottom:8px;border-bottom:2px solid var(--green)}
h2{font-family:Georgia,serif;font-size:22px;font-weight:700;margin-bottom:12px}
p{font-size:16px;color:var(--ink2);line-height:1.78;margin-bottom:18px}
.hatch-table{width:100%;border-collapse:collapse;font-size:15px;margin-bottom:24px}
.hatch-table th{text-align:left;padding:8px 12px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);border-bottom:2px solid var(--ink)}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--rule);border:1px solid var(--rule);margin-bottom:32px}
.info-cell{background:var(--bg);padding:18px 20px}
.info-cell-label{font-family:'Courier New',monospace;font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:var(--green);margin-bottom:6px}
.info-cell-val{font-size:14px;color:var(--ink2);line-height:1.65}
@media(max-width:600px){.info-grid{grid-template-columns:1fr}.conditions-bar{grid-template-columns:1fr 1fr}}
.cta-box{background:var(--green);color:#fff;padding:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-top:40px}
.cta-text{font-size:16px;font-style:italic;max-width:500px}
.cta-btn{display:inline-block;background:#fff;color:var(--green);font-family:'Courier New',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;padding:10px 20px;font-weight:700;white-space:nowrap}
.cta-btn:hover{background:#e8f2ec;text-decoration:none}
.footer{border-top:3px solid var(--ink);padding:18px 24px;max-width:860px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:.08em}
.footer-brand{font-family:Georgia,serif;font-size:14px;font-weight:700;color:var(--ink)}
.footer a{color:var(--ink3)}.footer a:hover{color:var(--green);text-decoration:none}
.author-bio{background:var(--bg2);padding:20px;margin-top:32px;border-left:3px solid var(--green)}
.author-bio-label{font-family:'Courier New',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--green);margin-bottom:8px}
.author-bio-text{font-size:14px;color:var(--ink2);line-height:1.7}
.author-bio-text a{color:var(--green);font-weight:600}
</style></head><body>
<header class="site-header">
  <a href="/" class="header-brand">Michigan Trout Report</a>
  <nav class="header-nav">
    <a href="/">Rivers</a><a href="/directory.html">Directory</a><a href="${DAILY}" target="_blank">Daily Reports</a>
  </nav>
</header>
<div class="wrap">
  <div class="breadcrumb"><a href="${AUTHOR_URL}">${AUTHOR}</a> &rsaquo; <a href="/">Michigan Trout Report</a> &rsaquo; ${river.name}</div>
  <h1>${river.name}: Fly Fishing Conditions &amp; Hatch Report</h1>
  <div class="byline">By <a href="${AUTHOR_URL}">${AUTHOR}</a> &nbsp;&#183;&nbsp; Updated ${dateStr} &nbsp;&#183;&nbsp; <a href="${DAILY}" target="_blank">Daily reports at Michigan Trout Daily</a></div>
  <div class="conditions-bar">
    <div><div class="cond-label">Flow</div><div class="cond-value">${flow ? flow.split(': ')[0] : 'N/A'}</div><div class="cond-sub">${flow ? flow.split(': ')[1] || '' : 'gauge unavailable'}</div></div>
    <div><div class="cond-label">Water Temp</div><div class="cond-value">${temp || 'N/A'}</div><div class="cond-sub">${conditions?.tempC != null ? ((conditions.tempC * 9/5 + 32) < 50 ? 'cold' : (conditions.tempC * 9/5 + 32) < 60 ? 'prime' : (conditions.tempC * 9/5 + 32) < 68 ? 'warm' : 'hot') : 'unavailable'}</div></div>
    <div><div class="cond-label">Gauge Height</div><div class="cond-value">${conditions?.gaugeHeight ? conditions.gaugeHeight + ' ft' : 'N/A'}</div><div class="cond-sub">USGS gauge</div></div>
    <div><div class="cond-label">Conditions</div><div class="cond-value" style="font-size:16px;text-transform:capitalize;">${rating || 'check app'}</div><div class="cond-sub">as of ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</div></div>
  </div>
  <div class="section-head">About This River</div>
  <h2>${river.name}, ${river.region}</h2>
  <p>${river.notes}</p>
  <p>Species present: ${river.species.map(s => s.charAt(0).toUpperCase() + s.slice(1) + ' trout').join(', ')}. Stream type: ${river.type.replace('_', ' ')}.</p>
  <div class="section-head">Active Hatches: ${monthName} ${year}</div>
  <h2>What's Hatching Now</h2>
  ${hatches.length > 0 ? `<p>Based on current water temperature${temp ? ` (${temp})` : ''} and time of year, the following insects are active or expected on the ${river.name}.</p>
  <table class="hatch-table"><thead><tr><th>Hatch</th><th>Latin</th><th>Top Patterns</th><th>Time of Day</th></tr></thead><tbody>${hatchRows}</tbody></table>` : `<p>No major hatches active at current conditions. Nymphs, streamers, and midges are the recommended approach.</p>`}
  <div class="section-head">Access &amp; Regulations</div>
  <div class="info-grid">
    <div class="info-cell"><div class="info-cell-label">Public Access</div><div class="info-cell-val">${river.access}</div></div>
    <div class="info-cell"><div class="info-cell-label">Regulations</div><div class="info-cell-val">${river.regulations}</div></div>
    <div class="info-cell"><div class="info-cell-label">Target Species</div><div class="info-cell-val">${river.species.map(s => s.charAt(0).toUpperCase() + s.slice(1) + ' trout').join(', ')}</div></div>
    <div class="info-cell"><div class="info-cell-label">Stream Type</div><div class="info-cell-val">${river.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div></div>
  </div>
  <div class="author-bio">
    <div class="author-bio-label">About the Author</div>
    <div class="author-bio-text"><a href="${AUTHOR_URL}">${AUTHOR}</a> is a Michigan angler and the founder of the <a href="${SITE}">Michigan Trout Report</a>, which tracks live conditions for 110+ Michigan rivers. He publishes daily stream reports at <a href="${DAILY}">Michigan Trout Daily</a>.</div>
  </div>
  <div class="cta-box">
    <div class="cta-text">Get a daily conditions report for the ${river.name} every morning during trout season.</div>
    <a href="${DAILY}" target="_blank" class="cta-btn">Michigan Trout Daily &rarr;</a>
  </div>
</div>
<footer class="footer">
  <span class="footer-brand">Michigan Trout Report</span>
  <nav style="display:flex;gap:20px;flex-wrap:wrap;">
    <a href="/">Home</a><a href="/directory.html">All Rivers</a><a href="${DAILY}" target="_blank">Daily Reports</a><a href="${AUTHOR_URL}" target="_blank">${AUTHOR}</a>
  </nav>
</footer>
</body></html>`;
}

// ── HANDLER ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const { id } = req.query;
  const river = RIVERS.find(r => r.id === id);
  if (!river) {
    if ((req.url || '').startsWith('/rivers/')) return res.status(404).send('<h1>River not found</h1>');
    return res.status(404).json({ error: 'River not found' });
  }

  // ── HTML SEO PAGE branch ────────────────────────────────────────
  if ((req.url || '').startsWith('/rivers/')) {
    const redis    = makeRedis();
    const cacheKey = `trout:river-page:${id}`;

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
          res.setHeader('X-Cache', 'HIT');
          return res.send(cached);
        }
      } catch(e) {}
    }

    let conditions = {};
    try {
      const readings = await fetchLiveReadings([river.primaryGauge]);
      const stats    = await fetchAllStats([river.primaryGauge]);
      const raw      = readings[river.primaryGauge] || {};
      const s        = stats[river.primaryGauge] || {};
      conditions     = { ...buildConditions(raw, s), cfs: raw.flow, tempC: raw.temp_c, gaugeHeight: raw.gage };
    } catch(e) {}

    const month   = new Date().getMonth() + 1;
    const tempF   = conditions.tempC != null ? conditions.tempC * 9/5 + 32 : null;
    const hatches = MICHIGAN_HATCHES.filter(h => {
      const inMonth = h.months.includes(month);
      const inTemp  = tempF != null ? tempF >= h.tempRange[0] && tempF <= h.tempRange[1] : inMonth;
      return inMonth && inTemp;
    });

    const html = buildSEOPage(river, conditions, hatches);
    if (redis) try { await redis.set(cacheKey, html, { ex: 3600 }); } catch(e) {}

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    return res.send(html);
  }

  // ── JSON DATA API branch (original) ────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const r = makeRedis();
  const cacheKey = `trout:detail:${id}:${new Date().toISOString().slice(0, 10)}`;
  if (r) {
    try {
      const cached = await r.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json({ success: true, cached: true, ...parsed });
      }
    } catch(e) {}
  }

  try {
    const gaugeIds = river.gauges.map(g => g.id);
    const [liveReadings, allStats, rawReports] = await Promise.all([
      fetchLiveReadings(gaugeIds),
      fetchAllStats(gaugeIds),
      fetchRiverReports(id),
    ]);

    const gauges = river.gauges.map(g => ({
      ...g,
      conditions: buildConditions(liveReadings[g.id] || {}, allStats[g.id] || {}),
    }));
    const primaryConditions = buildConditions(
      liveReadings[river.primaryGauge] || {},
      allStats[river.primaryGauge] || {}
    );
    const synthesis = await synthesizeReports(id, river.name, rawReports);
    const { matches: similarDays, totalDays, hasEnough } = await findSimilarDays(
      r, id, primaryConditions.flow, primaryConditions.flowPct, primaryConditions.tempF
    );

    const payload = {
      id: river.id, name: river.name, region: river.region, notes: river.notes,
      primaryConditions, gauges,
      reports: { sources: rawReports, synthesis: synthesis || null, fetchedAt: new Date().toISOString() },
      history: { similarDays, totalDays, hasEnough,
        message: hasEnough ? `Based on ${totalDays} days of data`
          : totalDays === 0 ? 'Building historical data: check back after a few weeks'
          : `${totalDays} day${totalDays === 1 ? '' : 's'} of data collected: more coming`,
      },
      generatedAt: new Date().toISOString(),
    };

    if (r) try { await r.set(cacheKey, JSON.stringify(payload), { ex: CACHE_TTL }); } catch(e) {}

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({ success: true, cached: false, ...payload });
  } catch(e) {
    console.error(`[river/${id}]`, e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
