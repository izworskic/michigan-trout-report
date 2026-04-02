// GET /api/hex
// Returns live hex hatch probability for the AuSable River
// Combines USGS water temp, NWS weather, sunset, and moon phase

import { RIVERS } from '../lib/rivers.js';
import { fetchLiveReadings, fetchAllStats } from '../lib/usgs.js';
import { buildConditions } from '../lib/rater.js';
import { fetchRiverWeather, RIVER_GRIDS } from '../lib/weather.js';
import { buildHexReport, getHexSeasonPhase, daysUntilHex, getMoonPhase } from '../lib/hex.js';
import { Redis } from '@upstash/redis';

function makeRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const riverId = 'ausable';
  const river = RIVERS.find(r => r.id === riverId);
  if (!river) return res.status(500).json({ error: 'AuSable not found in river config' });

  const redis = makeRedis();
  const now = new Date();
  const cacheKey = `trout:hex:${now.toISOString().slice(0, 13)}`; // cache 1hr

  // Check cache
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json({ success: true, cached: true, ...parsed });
      }
    } catch (e) { /* non-fatal */ }
  }

  try {
    // Fetch live data in parallel
    const [reading, stats, weather] = await Promise.all([
      fetchLiveReadings(river),
      fetchAllStats(river),
      fetchRiverWeather(riverId),
    ]);

    const conditions = buildConditions(reading, stats);

    // Extract wind speed from weather
    let windMph = null;
    let airTempAtSunset = null;
    let cloudCover = null;

    if (weather?.today) {
      // Parse wind speed from NWS string like "10 to 15 mph"
      const windMatch = weather.today.wind?.match(/(\d+)/);
      windMph = windMatch ? parseInt(windMatch[1]) : null;
      cloudCover = weather.today.cloud?.cover || null;
    }

    // Try to get evening air temp from hourly forecast
    if (weather?.hourly?.length) {
      // Find the hour closest to sunset (~8pm ET in summer)
      const eveningHour = weather.hourly.find(h => {
        const hour = new Date(h.time).getHours();
        return hour >= 19 && hour <= 21;
      });
      if (eveningHour) {
        airTempAtSunset = eveningHour.tempF;
        // Update wind with evening-specific data
        const ewMatch = eveningHour.wind?.match(/(\d+)/);
        if (ewMatch) windMph = parseInt(ewMatch[1]);
      }
    }

    // Also get the tonight forecast for air temp
    if (!airTempAtSunset && weather?.tonight?.tempF) {
      airTempAtSunset = weather.tonight.tempF;
    }

    const grid = RIVER_GRIDS[riverId] || RIVER_GRIDS['ausable'];

    const report = buildHexReport({
      waterTempF: conditions.tempF,
      airTempAtSunset,
      windMph,
      cloudCover,
      flowPct: conditions.flowPct,
      lat: grid?.lat || 44.66,
      lon: grid?.lon || -84.13,
      date: now,
    });

    // Water temp trend: last 7 days from Redis snapshots
    let tempTrend = null;
    if (redis) {
      try {
        const days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const dk = `trout:daily:${d.toISOString().slice(0, 10)}`;
          const snap = await redis.get(dk);
          if (snap) {
            const parsed = typeof snap === 'string' ? JSON.parse(snap) : snap;
            const aus = parsed?.rivers?.find(r => r.id === 'ausable');
            if (aus?.conditions?.tempF) {
              days.push({ date: d.toISOString().slice(0, 10), tempF: aus.conditions.tempF });
            }
          }
        }
        if (days.length >= 2) tempTrend = days;
      } catch (e) { /* non-fatal */ }
    }

    const payload = {
      report,
      conditions: {
        waterTempF: conditions.tempF,
        flow: conditions.flow,
        flowPct: conditions.flowPct,
        ratingKey: conditions.ratingKey,
      },
      weather: weather ? {
        tonight: weather.tonight,
        today: weather.today,
      } : null,
      tempTrend,
      generatedAt: now.toISOString(),
    };

    // Cache
    if (redis) {
      try { await redis.set(cacheKey, JSON.stringify(payload), { ex: 3600 }); }
      catch (e) { /* non-fatal */ }
    }

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({ success: true, cached: false, ...payload });

  } catch (e) {
    console.error('[hex]', e.message);

    // Even if live data fails, return moon/sun/season info
    const grid = RIVER_GRIDS[riverId] || RIVER_GRIDS['ausable'];
    const fallback = buildHexReport({
      lat: grid?.lat || 44.66,
      lon: grid?.lon || -84.13,
      date: now,
    });
    return res.status(200).json({
      success: true,
      partial: true,
      report: fallback,
      conditions: null,
      weather: null,
      tempTrend: null,
      generatedAt: now.toISOString(),
    });
  }
}
