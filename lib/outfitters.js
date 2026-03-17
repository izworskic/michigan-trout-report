// Michigan Trout Report — Outfitter & Guide Shop Scraper
// Each outfitter is mapped to one or more rivers.
// Strategy: try WordPress REST API first (cleanest), fall back to HTML scrape.

const HEADERS = {
  'User-Agent': 'MichiganTroutReport/1.0 (+https://freighterviewfarms.com; daily stream conditions aggregator)',
  'Accept': 'application/json, text/html, */*',
};

async function fetchTimeout(url, opts = {}, ms = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal, headers: { ...HEADERS, ...(opts.headers || {}) } });
    clearTimeout(id);
    return r;
  } catch(e) { clearTimeout(id); throw e; }
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#8211;/g, '–').replace(/&#8217;/g, "'").replace(/&#8220;|&#8221;/g, '"')
    .replace(/\s{2,}/g, ' ').trim();
}

// Try WordPress REST API for posts — most reliable for WP sites
async function fetchWpPosts(baseUrl, search = 'fishing report', perPage = 2) {
  const url = `${baseUrl}/wp-json/wp/v2/posts?per_page=${perPage}&search=${encodeURIComponent(search)}&orderby=date&order=desc`;
  try {
    const r = await fetchTimeout(url, {}, 8000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const posts = await r.json();
    if (!Array.isArray(posts) || !posts.length) return null;
    return posts.map(p => ({
      title:   stripHtml(p.title?.rendered || ''),
      content: stripHtml(p.content?.rendered || '').slice(0, 800),
      excerpt: stripHtml(p.excerpt?.rendered || '').slice(0, 300),
      date:    (p.date || '').slice(0, 10),
      url:     p.link || baseUrl,
    }));
  } catch(e) {
    return null;
  }
}

// HTML scrape fallback — grab recent post content from report pages
async function fetchHtmlReport(url) {
  try {
    const r = await fetchTimeout(url, { headers: { ...HEADERS, Accept: 'text/html' } }, 10000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();
    // Extract paragraphs with fishing content
    const paras = [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gis)]
      .map(m => stripHtml(m[1]).trim())
      .filter(p => p.length > 60 && /\b(trout|fishing|fly|hatch|nymph|streamer|caddis|mayfly|brown|rainbow|brookies?|conditions?|report)\b/i.test(p));
    if (!paras.length) return null;
    return [{
      title:   'Recent Report',
      content: paras.slice(0, 4).join(' '),
      excerpt: paras[0].slice(0, 300),
      date:    new Date().toISOString().slice(0, 10),
      url,
    }];
  } catch(e) {
    return null;
  }
}

// MDNR Weekly Fishing Report — scraped directly (confirmed accessible)
async function fetchMDNRReport(region) {
  const url = 'https://www.michigan.gov/dnr/things-to-do/fishing/weekly';
  try {
    const r = await fetchTimeout(url, {}, 10000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();

    // DNR report is region-based — find content blocks mentioning this region
    const regionKeywords = {
      'ausable':       ['Au Sable', 'AuSable', 'Oscoda', 'Mio', 'Grayling', 'Northeast'],
      'manistee':      ['Manistee', 'Northwest', 'Grayling'],
      'pere-marquette':['Pere Marquette', 'Baldwin', 'West-Central', 'Northwest'],
      'muskegon':      ['Muskegon', 'Big Rapids', 'West-Central'],
      'boardman':      ['Boardman', 'Traverse City', 'Northwest'],
      'jordan':        ['Jordan', 'East Jordan', 'Northwest', 'Northern'],
      'pigeon':        ['Pigeon River', 'Vanderbilt', 'Northeast', 'Northern'],
      'rifle':         ['Rifle River', 'Sterling', 'Northeast'],
      'little-manistee':['Little Manistee', 'Northwest', 'Mason County'],
    };

    const keywords = regionKeywords[region] || [];
    const text = stripHtml(html);

    for (const kw of keywords) {
      const idx = text.indexOf(kw);
      if (idx > 0) {
        const snippet = text.slice(Math.max(0, idx - 50), idx + 400).trim();
        if (snippet.length > 80) {
          return [{
            title:   `Michigan DNR Weekly Report — ${kw} area`,
            content: snippet,
            excerpt: snippet.slice(0, 250),
            date:    new Date().toISOString().slice(0, 10),
            url,
          }];
        }
      }
    }
    return null;
  } catch(e) {
    return null;
  }
}

// Outfitter definitions — per river
const OUTFITTERS = {
  'ausable': [
    { name: 'Gates Au Sable Lodge',  base: 'https://gatesausablelodge.com',   search: 'fishing report' },
    { name: 'AuSable Fly Shop',      base: 'https://ausablefly.com',           search: 'fishing report' },
    { name: 'Rusty Hook Fly Fishing',base: 'https://rustyhookflyfishing.com',  search: 'report' },
  ],
  'manistee': [
    { name: 'Little Forks Outfitters', base: 'https://littleforksoutfitters.com', search: 'fishing report' },
    { name: 'Gates Au Sable Lodge',    base: 'https://gatesausablelodge.com',     search: 'Manistee' },
  ],
  'pere-marquette': [
    { name: 'Schultz Outfitters',      base: 'https://schultzoutfitters.com',  search: 'fishing report' },
    { name: 'Pere Marquette Lodge',    base: 'https://pmlodge.com',            search: 'fishing report' },
  ],
  'muskegon': [
    { name: 'Muskegon River Outfitters', base: 'https://muskegonriveroutfitters.com', search: 'fishing report' },
    { name: 'Reel Outdoors',             base: 'https://reeloutdoors.com',             search: 'report' },
  ],
  'boardman': [
    { name: 'The Northern Angler',    base: 'https://thenorthernangler.com',  search: 'fishing report' },
    { name: 'Traverse City Fly Shop', base: 'https://tcflyfishing.com',       search: 'report' },
  ],
  'jordan': [
    { name: 'The Northern Angler',    base: 'https://thenorthernangler.com',  search: 'Jordan River' },
  ],
  'pigeon': [
    { name: 'Gates Au Sable Lodge',   base: 'https://gatesausablelodge.com',  search: 'Pigeon River' },
  ],
  'rifle': [
    { name: 'Rifle River Outfitters', base: 'https://rifleriveroutfitters.com', search: 'report' },
  ],
  'little-manistee': [
    { name: 'Little Forks Outfitters', base: 'https://littleforksoutfitters.com', search: 'Little Manistee' },
    { name: 'Streamside Orvis',        base: 'https://streamsideorvis.com',       search: 'report' },
  ],
};

// Fetch all reports for a river — WP API first, HTML fallback, DNR always
export async function fetchRiverReports(riverId) {
  const outfitters = OUTFITTERS[riverId] || [];
  const results = [];

  // Fetch outfitter reports in parallel
  const outfitterResults = await Promise.allSettled(
    outfitters.map(async (o) => {
      // Try WP REST API first
      let posts = await fetchWpPosts(o.base, o.search);
      if (!posts) {
        // HTML fallback
        const reportUrl = `${o.base}/fishing-reports/`;
        posts = await fetchHtmlReport(reportUrl);
      }
      if (!posts) return null;
      return { source: o.name, url: o.base, posts: posts.slice(0, 1) };
    })
  );

  for (const r of outfitterResults) {
    if (r.status === 'fulfilled' && r.value) results.push(r.value);
  }

  // Always try MDNR
  const mdnr = await fetchMDNRReport(riverId);
  if (mdnr) results.push({ source: 'Michigan DNR', url: 'https://www.michigan.gov/dnr/things-to-do/fishing/weekly', posts: mdnr });

  return results;
}

// Fetch reports for all rivers (used by cron to build history)
export async function fetchAllRiverReports(riverIds) {
  const results = {};
  // Stagger requests to avoid hammering
  for (const id of riverIds) {
    results[id] = await fetchRiverReports(id);
    await new Promise(r => setTimeout(r, 300));
  }
  return results;
}
