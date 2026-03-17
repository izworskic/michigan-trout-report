// GET /api/generate
// Fetches USGS data, rates conditions, generates AI brief.
// Cached in Upstash Redis until midnight — one AI call per day.

import { Redis } from '@upstash/redis';
import { RIVERS, ALL_GAUGE_IDS } from '../lib/rivers.js';
import { fetchLiveReadings, fetchAllStats } from '../lib/usgs.js';
import { buildConditions } from '../lib/rater.js';
import { generateBrief } from '../lib/generator.js';

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

let memCache = { payload: null, dateKey: null };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const forceRefresh = req.query?.refresh === '1';
  if (forceRefresh) {
    if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const today    = todayUTC();
  const redisKey = `trout:daily:${today}`;
  const ttl      = secondsUntilMidnight();
  const r        = makeRedis();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  try {
    // 1. Redis cache
    if (!forceRefresh && r) {
      try {
        const cached = await r.get(redisKey);
        if (cached) {
          const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
          res.setHeader('X-Cache', 'HIT-REDIS');
          return res.status(200).json({ success: true, cached: true, ...parsed });
        }
      } catch(e) { console.warn('[redis] get error:', e.message); }
    }

    // 2. Memory cache
    if (!forceRefresh && memCache.payload && memCache.dateKey === today) {
      res.setHeader('X-Cache', 'HIT-MEMORY');
      return res.status(200).json({ success: true, cached: true, ...memCache.payload });
    }

    // 3. Fresh fetch
    console.log('[generate] Fetching USGS data for', today);

    // Fetch all live readings and seasonal stats in parallel
    const [liveReadings, allStats] = await Promise.all([
      fetchLiveReadings(ALL_GAUGE_IDS),
      fetchAllStats(ALL_GAUGE_IDS),
    ]);

    // Build per-river conditions using primary gauge
    const riverData = RIVERS.map(river => {
      const reading = liveReadings[river.primaryGauge] || {};
      const stats   = allStats[river.primaryGauge]    || {};
      const conditions = buildConditions(reading, stats);

      // Also build all-gauge data for detail view
      const allGauges = river.gauges.map(g => ({
        ...g,
        conditions: buildConditions(liveReadings[g.id] || {}, allStats[g.id] || {}),
      }));

      return {
        id:         river.id,
        name:       river.name,
        region:     river.region,
        notes:      river.notes,
        conditions,
        allGauges,
      };
    });

    // Generate AI brief
    let brief = null;
    try {
      brief = await generateBrief(riverData);
    } catch(e) {
      console.error('[generate] Brief failed (non-fatal):', e.message);
    }

    const payload = {
      rivers:       riverData,
      brief,
      generated_at: new Date().toISOString(),
      date:         today,
    };

    // Cache
    if (r) {
      try { await r.set(redisKey, JSON.stringify(payload), { ex: ttl + 120 }); }
      catch(e) { console.warn('[redis] set error:', e.message); }
    }
    memCache = { payload, dateKey: today };

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({ success: true, cached: false, ...payload });

  } catch(e) {
    console.error('[generate] Fatal:', e.message);
    if (memCache.payload) {
      return res.status(200).json({ success: true, cached: true, stale: true, ...memCache.payload });
    }
    return res.status(500).json({ success: false, error: e.message });
  }
}
