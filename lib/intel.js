// Michigan Trout Report: Current Hatch Intel Scraper
//
// Scrapes confirmed-accessible RSS feeds for current fly fishing intel.
// Filters for Michigan-relevant content and hatch/fly mentions.
// Used to supplement the static hatch chart with real-world current reports.

const UA = 'MichiganTroutReport/1.0 (+https://michigantroutreport.com)';

async function timedFetch(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/atom+xml, text/xml, */*' }
    });
    clearTimeout(t);
    return r;
  } catch(e) { clearTimeout(t); throw e; }
}

function cleanHtml(html = '') {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&#8211;/g, '–').replace(/&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"').replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ').replace(/&[a-z]+;/g, ' ')
    .replace(/\s{2,}/g, ' ').trim();
}

function isRecent(dateStr, days = 21) {
  if (!dateStr) return false;
  try { return (Date.now() - new Date(dateStr).getTime()) < days * 86400000; }
  catch(e) { return false; }
}

// Fly/hatch keyword signals
const HATCH_SIGNALS = [
  /\b(hatch|hatching|emergence|emerging)\b/i,
  /\b(sulphur|hendrickson|caddis|BWO|blue.winged olive|hex|hexagenia|trico|PMD|march brown|baetis)\b/i,
  /\b(dry fly|nymph|streamer|emerger|spinner fall|midge)\b/i,
  /\b(fly pattern|fly recommendation|what fly|what.s biting|on the water)\b/i,
  /\b(water temperature|water temp|water clarity|fishing conditions)\b/i,
];

// Michigan-specific signals
const MICHIGAN_SIGNALS = [
  /\b(Michigan|AuSable|Au Sable|Manistee|Pere Marquette|Boardman|Muskegon|Jordan|Pigeon|Rifle)\b/i,
  /\b(Great Lakes|midwest|upper midwest|lower peninsula)\b/i,
];

function scoreContent(title, text) {
  const full = title + ' ' + text;
  const hatchScore   = HATCH_SIGNALS.filter(rx => rx.test(full)).length;
  const michiganHit  = MICHIGAN_SIGNALS.some(rx => rx.test(full));
  return { hatchScore, michiganHit, total: hatchScore + (michiganHit ? 3 : 0) };
}

// Parse RSS feed
function parseRss(xml) {
  const items = [];
  const blocks = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];
  for (const block of blocks) {
    const get = rx => (block.match(rx) || [])[1] || '';
    const title   = cleanHtml(get(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i));
    const date    = get(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const link    = get(/<link>([\s\S]*?)<\/link>/i).trim();
    const content = cleanHtml(
      get(/<content:encoded>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i) ||
      get(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)
    ).slice(0, 600);
    const parsedDate = date ? new Date(date).toISOString().slice(0, 10) : '';
    items.push({ title, content, date: parsedDate, url: link });
  }
  return items;
}

// Confirmed RSS sources
const INTEL_SOURCES = [
  { name: 'MidCurrent',    url: 'https://midcurrent.com/feed/',         type: 'rss' },
  { name: 'Hatch Magazine', url: 'https://www.hatchmag.com/rss.xml',    type: 'rss' },
  { name: 'Trout Unlimited', url: 'https://www.tu.org/feed/',           type: 'rss' },
];

async function fetchSource(source) {
  try {
    const r = await timedFetch(source.url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    const items = parseRss(text);
    return items
      .filter(i => isRecent(i.date, 21))
      .map(i => ({ ...i, source: source.name, score: scoreContent(i.title, i.content) }))
      .filter(i => i.score.hatchScore >= 1)
      .sort((a, b) => b.score.total - a.score.total);
  } catch(e) {
    return [];
  }
}

// Fetch and return top hatch intel items
export async function fetchHatchIntel() {
  const results = await Promise.allSettled(INTEL_SOURCES.map(s => fetchSource(s)));
  const all = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, 6);

  return {
    items:     all,
    fetchedAt: new Date().toISOString(),
    sources:   INTEL_SOURCES.map(s => s.name),
  };
}
