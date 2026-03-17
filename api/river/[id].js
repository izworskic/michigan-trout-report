// GET /api/river/[id]
// Returns full detail for one river: all gauges, guide reports, similar history.
// Cached in Redis for 6 hours (guide reports don't change that fast).

import { Redis } from '@upstash/redis';
import { RIVERS } from '../../lib/rivers.js';
import { fetchLiveReadings, fetchAllStats } from '../../lib/usgs.js';
import { buildConditions } from '../../lib/rater.js';
import { fetchRiverReports } from '../../lib/outfitters.js';
import { synthesizeReports } from '../../lib/synthesizer.js';
import { findSimilarDays, getHistory } from '../../lib/history.js';

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const CACHE_TTL = 6 * 60 * 60; // 6 hours

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  const river = RIVERS.find(r => r.id === id);
  if (!river) return res.status(404).json({ error: 'River not found' });

  const r = makeRedis();
  const cacheKey = `trout:detail:${id}:${new Date().toISOString().slice(0, 10)}`;

  // Try cache
  if (r) {
    try {
      const cached = await r.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json({ success: true, cached: true, ...parsed });
      }
    } catch(e) { /* non-fatal */ }
  }

  try {
    // All gauge IDs for this river
    const gaugeIds = river.gauges.map(g => g.id);

    // Fetch live data + stats + outfitter reports in parallel
    const [liveReadings, allStats, rawReports] = await Promise.all([
      fetchLiveReadings(gaugeIds),
      fetchAllStats(gaugeIds),
      fetchRiverReports(id),
    ]);

    // Build per-gauge conditions
    const gauges = river.gauges.map(g => ({
      ...g,
      conditions: buildConditions(liveReadings[g.id] || {}, allStats[g.id] || {}),
    }));

    // Primary gauge conditions
    const primaryConditions = buildConditions(
      liveReadings[river.primaryGauge] || {},
      allStats[river.primaryGauge] || {}
    );

    // Synthesize guide reports
    const synthesis = await synthesizeReports(id, river.name, rawReports);

    // Similar historical days
    const { matches: similarDays, totalDays, hasEnough } = await findSimilarDays(
      r,
      id,
      primaryConditions.flow,
      primaryConditions.flowPct,
      primaryConditions.tempF
    );

    const payload = {
      id:              river.id,
      name:            river.name,
      region:          river.region,
      notes:           river.notes,
      primaryConditions,
      gauges,
      reports: {
        sources:   rawReports,
        synthesis: synthesis || null,
        fetchedAt: new Date().toISOString(),
      },
      history: {
        similarDays,
        totalDays,
        hasEnough,
        message: hasEnough
          ? `Based on ${totalDays} days of data`
          : totalDays === 0
            ? 'Building historical data — check back after a few weeks'
            : `${totalDays} day${totalDays === 1 ? '' : 's'} of data collected — more coming`,
      },
      generatedAt: new Date().toISOString(),
    };

    // Cache for 6 hours
    if (r) {
      try { await r.set(cacheKey, JSON.stringify(payload), { ex: CACHE_TTL }); }
      catch(e) { /* non-fatal */ }
    }

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({ success: true, cached: false, ...payload });

  } catch(e) {
    console.error(`[river/${id}]`, e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
