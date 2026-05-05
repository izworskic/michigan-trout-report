// Michigan Trout Report: Outfitter Scraper
//
// Two clean paths, in priority order:
//   1. WordPress REST API  → /wp-json/wp/v2/posts?search=fishing+report&per_page=5
//      Returns structured JSON. No HTML parsing needed.
//   2. Shopify Atom feed   → /blogs/news.atom
//      Standard Atom XML. Simple regex parse.
//   3. WordPress RSS       → /feed/ (fallback for WP sites)
//
// All paths apply a strict fishing-content filter.
// Non-fishing content (gear reviews, events, product launches) is silently dropped.
// Pre-season or inactive shops return empty: caller handles gracefully.

const UA = 'MichiganTroutReport/1.0 (+https://michigan-trout-report.vercel.app)';

async function timedFetch(url, ms = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Accept': 'application/json, application/atom+xml, text/xml, */*' }
    });
    clearTimeout(t);
    return r;
  } catch(e) { clearTimeout(t); throw e; }
}

// ── Fishing content filter ─────────────────────────────────────────────────
const FISHING_SIGNALS = [
  /\b(fishing report|stream report|river report|conditions report|weekly report)\b/i,
  /\b(brown trout|rainbow trout|brook trout|brookies?|steelhead|lakers?)\b/i,
  /\b(hatch|hatching|sulphur|caddis|mayfly|hex|trico|blue.winged olive|BWO|PMD|Baetis)\b/i,
  /\b(nymph|dry fly|streamer|indicator|swinging|mending|dead.drift|swing)\b/i,
  /\b(water (temp|temperature|level|clarity|color)|off.color|clearing|running (high|low|clear|normal))\b/i,
  /\b(fish(ing)? (well|good|great|tough|slow)|biting|taking flies|on (dries|nymphs|streamers))\b/i,
  /\b(AuSable|Au Sable|Manistee|Pere Marquette|Boardman|Jordan|Muskegon|Pigeon River|Rifle River)\b/i,
];

const PRODUCT_NOISE = [
  /\b(rod review|reel review|wader review|gear review|product review|fly rod review)\b/i,
  /\b(now available|shop now|new in stock|just arrived|order (yours|today|now))\b/i,
  /\b(holiday (picks|gift)|staff picks|gift guide|sale (ends|starts|today))\b/i,
  /\b(tying class|spey school|casting clinic|film screening|book signing)\b/i,
  /\b(podcast episode|new episode|listen now|subscribe)\b/i,
];

function isFishingContent(title, text) {
  const full = (title + ' ' + text).toLowerCase();
  const signals = FISHING_SIGNALS.filter(rx => rx.test(full)).length;
  const noise   = PRODUCT_NOISE.filter(rx => rx.test(full)).length;
  return signals >= 2 && noise === 0;
}

// Only keep posts from the last 45 days
function isRecent(dateStr) {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    return (Date.now() - d.getTime()) < 45 * 24 * 60 * 60 * 1000;
  } catch(e) { return false; }
}

function cleanHtml(html = '') {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&#8211;/g, '–').replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"').replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ').replace(/&[a-z]+;/g, ' ')
    .replace(/\s{2,}/g, ' ').trim();
}

// ── Path 1: WordPress REST API ─────────────────────────────────────────────
async function fetchWordPress(base, search = 'fishing report') {
  const url = `${base}/wp-json/wp/v2/posts?per_page=5&orderby=date&order=desc&search=${encodeURIComponent(search)}`;
  try {
    const r = await timedFetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const posts = await r.json();
    if (!Array.isArray(posts)) return null;

    return posts
      .filter(p => isRecent(p.date))
      .map(p => ({
        title:   cleanHtml(p.title?.rendered   || ''),
        content: cleanHtml(p.content?.rendered || '').slice(0, 900),
        excerpt: cleanHtml(p.excerpt?.rendered || '').slice(0, 350),
        date:    (p.date || '').slice(0, 10),
        url:     p.link || base,
      }))
      .filter(p => isFishingContent(p.title, p.content));
  } catch(e) { return null; }
}

// ── Path 2: Shopify Atom feed ──────────────────────────────────────────────
async function fetchShopifyAtom(base, blogSlug = 'news') {
  const url = `${base}/blogs/${blogSlug}.atom`;
  try {
    const r = await timedFetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = await r.text();
    if (!xml.includes('<entry>')) throw new Error('Not Atom');

    const blocks = xml.match(/<entry>([\s\S]*?)<\/entry>/gi) || [];
    return blocks
      .map(block => {
        const get = (rx) => (block.match(rx) || [])[1] || '';
        const title   = cleanHtml(get(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i));
        const date    = get(/<published>([\s\S]*?)<\/published>/i).slice(0, 10);
        const link    = get(/rel="alternate"[^>]*href="([^"]+)"/i) || get(/<link[^>]*href="([^"]+)"/i);
        const content = cleanHtml(get(/<content[^>]*>([\s\S]*?)<\/content>/i)).slice(0, 900);
        return { title, content, excerpt: content.slice(0, 350), date, url: link || base };
      })
      .filter(e => isRecent(e.date) && isFishingContent(e.title, e.content));
  } catch(e) { return null; }
}

// ── Path 3: WordPress RSS /feed/ ───────────────────────────────────────────
async function fetchWordPressRss(base) {
  const url = `${base}/feed/`;
  try {
    const r = await timedFetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = await r.text();
    if (!xml.includes('<item>')) throw new Error('Not RSS');

    const blocks = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];
    return blocks
      .map(block => {
        const get = (rx) => (block.match(rx) || [])[1] || '';
        const title   = cleanHtml(get(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i));
        const rawDate = get(/<pubDate>([\s\S]*?)<\/pubDate>/i);
        const date    = rawDate ? new Date(rawDate).toISOString().slice(0, 10) : '';
        const link    = get(/<link>([\s\S]*?)<\/link>/i).trim();
        const content = cleanHtml(
          get(/<content:encoded>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i) ||
          get(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)
        ).slice(0, 900);
        return { title, content, excerpt: content.slice(0, 350), date, url: link || base };
      })
      .filter(e => isRecent(e.date) && isFishingContent(e.title, e.content));
  } catch(e) { return null; }
}

// ── Outfitter registry ─────────────────────────────────────────────────────
// type: 'wp' | 'shopify' | 'rss'
// Listed by richest source first per river.

export const OUTFITTERS = {
  'ausable': [
    { name: 'Gates Au Sable Lodge',    base: 'https://gatesausablelodge.com',    type: 'wp',      search: 'fishing report' },
    { name: 'AuSable Fly Shop',        base: 'https://ausablefly.com',           type: 'wp',      search: 'fishing report' },
    { name: 'Rusty Hook Fly Fishing',  base: 'https://rustyhookflyfishing.com',  type: 'rss' },
    { name: 'Troutman Flies',          base: 'https://troutmanflies.com',        type: 'wp',      search: 'fishing report' },
  ],
  'manistee': [
    { name: 'Little Forks Outfitters', base: 'https://littleforksoutfitters.com', type: 'wp',    search: 'fishing report' },
    { name: 'Gates Au Sable Lodge',    base: 'https://gatesausablelodge.com',     type: 'wp',    search: 'Manistee' },
  ],
  'pere-marquette': [
    { name: 'Schultz Outfitters',      base: 'https://schultzoutfitters.com',    type: 'shopify', blog: 'news' },
    { name: 'Baldwin Bait & Tackle',   base: 'https://baldwinbaitandtackle.com', type: 'rss' },
  ],
  'muskegon': [
    { name: 'Muskegon River Outfitters', base: 'https://muskegonriveroutfitters.com', type: 'shopify', blog: 'news' },
    { name: 'Reel Outdoors',             base: 'https://reeloutdoors.com',             type: 'wp',      search: 'Muskegon River' },
  ],
  'boardman': [
    { name: 'The Northern Angler',     base: 'https://thenorthernangler.com',    type: 'shopify', blog: 'news' },
  ],
  'jordan': [
    { name: 'The Northern Angler',     base: 'https://thenorthernangler.com',    type: 'shopify', blog: 'news' },
  ],
  'pigeon': [
    { name: 'Gates Au Sable Lodge',    base: 'https://gatesausablelodge.com',    type: 'wp',      search: 'Pigeon River' },
    { name: 'Little Forks Outfitters', base: 'https://littleforksoutfitters.com', type: 'wp',    search: 'Pigeon River' },
  ],
  'rifle': [
    { name: 'AuSable Fly Shop',        base: 'https://ausablefly.com',           type: 'wp',      search: 'Rifle River' },
  ],
  'little-manistee': [
    { name: 'Little Forks Outfitters', base: 'https://littleforksoutfitters.com', type: 'wp',    search: 'Little Manistee' },
  ],
};

// Fetch one outfitter using its designated path
async function fetchOne(outfitter) {
  let posts = null;
  if      (outfitter.type === 'wp')      posts = await fetchWordPress(outfitter.base, outfitter.search);
  else if (outfitter.type === 'shopify') posts = await fetchShopifyAtom(outfitter.base, outfitter.blog || 'news');
  else if (outfitter.type === 'rss')     posts = await fetchWordPressRss(outfitter.base);

  if (!posts?.length) return null;
  return { source: outfitter.name, url: outfitter.base, posts: posts.slice(0, 2) };
}

// Fetch all reports for a river
export async function fetchRiverReports(riverId) {
  const outfitters = OUTFITTERS[riverId] || [];
  if (!outfitters.length) return [];
  const results = await Promise.allSettled(outfitters.map(o => fetchOne(o)));
  return results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
}

// Fetch all rivers: used by daily cron
export async function fetchAllRiverReports(riverIds) {
  const out = {};
  for (const id of riverIds) {
    out[id] = await fetchRiverReports(id);
    await new Promise(r => setTimeout(r, 400));
  }
  return out;
}
