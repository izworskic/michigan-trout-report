// GET /api/weekend
// Returns the best 5 rivers for Saturday and Sunday
// Combines current conditions + NWS weather forecast + trend direction
// Cached 6 hours in Redis

import { Redis } from '@upstash/redis';
import { RIVERS } from '../lib/rivers.js';
import { fetchLiveReadings, fetchAllStats } from '../lib/usgs.js';
import { buildConditions, RATINGS } from '../lib/rater.js';
import { RIVER_GRIDS } from '../lib/weather.js';

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const CACHE_TTL = 6 * 60 * 60; // 6 hours
const NWS_BASE = 'https://api.weather.gov';
const UA = 'MichiganTroutReport/1.0 (freighterviewfarms.com)';

const SCORE = { PRIME: 5, FISHING_WELL: 4, FAIR: 3, TOUGH: 2, BLOWN_OUT: 1 };

function getNextWeekendDays() {
  const now = new Date();
  const dow = now.getUTCDay(); // 0=Sun, 6=Sat
  let satOffset, sunOffset;
  if (dow === 6) { satOffset = 0; sunOffset = 1; }        // Saturday: today + tomorrow
  else if (dow === 0) { satOffset = 6; sunOffset = 0; }   // Sunday: today + next Sat
  else { satOffset = 6 - dow; sunOffset = 7 - dow; }      // Weekday: this coming Sat/Sun
  
  const sat = new Date(now); sat.setUTCDate(sat.getUTCDate() + satOffset);
  const sun = new Date(now); sun.setUTCDate(sun.getUTCDate() + sunOffset);
  return {
    saturday: { date: sat.toISOString().slice(0, 10), dayName: 'Saturday', offset: satOffset },
    sunday:   { date: sun.toISOString().slice(0, 10), dayName: 'Sunday',   offset: sunOffset },
  };
}

// Fetch NWS 7-day forecast for a river and extract weekend days
async function fetchWeekendWeather(riverId) {
  const grid = RIVER_GRIDS[riverId];
  if (!grid) return null;
  const url = `${NWS_BASE}/gridpoints/${grid.cwa}/${grid.gridX},${grid.gridY}/forecast`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Accept': 'application/geo+json' }
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const d = await r.json();
    return d.properties?.periods || [];
  } catch(e) { return null; }
}

function findPeriod(periods, dayName) {
  // NWS periods have names like "Saturday", "Saturday Night", "Sunday"
  return periods?.find(p => p.name === dayName && p.isDaytime) || null;
}

function rainImpactOnFlow(rainPct, currentFlowPct) {
  // Project whether rain will push flow higher
  if (rainPct >= 70 && currentFlowPct >= 100) return 'rising_high';
  if (rainPct >= 70) return 'rising';
  if (rainPct >= 40 && currentFlowPct >= 130) return 'rising';
  if (rainPct >= 40) return 'slight_rise';
  return 'stable';
}

function projectRating(currentRating, rainPct, currentFlowPct, airTempF) {
  // Simple projection: current rating adjusted by weather
  let score = SCORE[currentRating] || 3;
  
  const impact = rainImpactOnFlow(rainPct, currentFlowPct);
  if (impact === 'rising_high') score -= 2;
  else if (impact === 'rising') score -= 1;
  
  // High wind penalty (implied by certain forecast words)
  // Warm air can be good for hatches
  if (airTempF >= 50 && airTempF <= 70 && rainPct < 40) score += 0.5;
  if (airTempF < 35) score -= 0.5;
  
  // Clamp
  score = Math.max(1, Math.min(5, Math.round(score)));
  const keys = ['BLOWN_OUT', 'TOUGH', 'FAIR', 'FISHING_WELL', 'PRIME'];
  return keys[score - 1];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const redis = makeRedis();
  const weekend = getNextWeekendDays();
  const cacheKey = `trout:weekend:${weekend.saturday.date}`;

  // Try cache
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json({ success: true, cached: true, ...parsed });
      }
    } catch(e) {}
  }

  try {
    // Fetch current conditions
    const gaugeIds = [...new Set(RIVERS.map(r => r.primaryGauge))];
    const [liveReadings, allStats] = await Promise.all([
      fetchLiveReadings(gaugeIds),
      fetchAllStats(gaugeIds),
    ]);

    // Fetch weather for rivers that have grid data (parallel, batched)
    const riversWithGrids = RIVERS.filter(r => RIVER_GRIDS[r.id]);
    // Only fetch weather for top-tier rivers to stay within NWS rate limits
    const tier1Rivers = riversWithGrids.filter(r => r.tier <= 2).slice(0, 25);
    
    const weatherResults = {};
    // Batch in groups of 5 with delay
    for (let i = 0; i < tier1Rivers.length; i += 5) {
      const batch = tier1Rivers.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(r => fetchWeekendWeather(r.id).then(periods => ({ id: r.id, periods })))
      );
      results.forEach(r => { if (r.periods) weatherResults[r.id] = r.periods; });
      if (i + 5 < tier1Rivers.length) await new Promise(r => setTimeout(r, 300));
    }

    // Build projections for each river
    const projections = RIVERS.map(river => {
      const reading = liveReadings[river.primaryGauge] || {};
      const stats = allStats[river.primaryGauge] || {};
      const conditions = buildConditions(reading, stats);
      const periods = weatherResults[river.id];

      const satPeriod = findPeriod(periods, 'Saturday');
      const sunPeriod = findPeriod(periods, 'Sunday');

      // Saturday projection
      const satRain = satPeriod?.probabilityOfPrecipitation?.value ?? 20;
      const satTemp = satPeriod?.temperature ?? null;
      const satWind = satPeriod?.windSpeed || '';
      const satForecast = satPeriod?.shortForecast || '';
      const satProjected = conditions.ratingKey
        ? projectRating(conditions.ratingKey, satRain, conditions.flowPct || 100, satTemp || 50)
        : null;

      // Sunday projection
      const sunRain = sunPeriod?.probabilityOfPrecipitation?.value ?? 20;
      const sunTemp = sunPeriod?.temperature ?? null;
      const sunWind = sunPeriod?.windSpeed || '';
      const sunForecast = sunPeriod?.shortForecast || '';
      const sunProjected = conditions.ratingKey
        ? projectRating(conditions.ratingKey, sunRain, conditions.flowPct || 100, sunTemp || 50)
        : null;

      return {
        id: river.id,
        name: river.name,
        region: river.region,
        species: river.species,
        current: {
          ratingKey: conditions.ratingKey,
          flow: conditions.flow,
          flowPct: conditions.flowPct,
          tempF: conditions.tempF,
        },
        saturday: satProjected ? {
          projectedRating: satProjected,
          score: SCORE[satProjected] || 0,
          rain: satRain,
          airTemp: satTemp,
          wind: satWind,
          forecast: satForecast,
        } : null,
        sunday: sunProjected ? {
          projectedRating: sunProjected,
          score: SCORE[sunProjected] || 0,
          rain: sunRain,
          airTemp: sunTemp,
          wind: sunWind,
          forecast: sunForecast,
        } : null,
      };
    });

    // Rank: best 5 for each day
    const satRanked = projections
      .filter(p => p.saturday && p.saturday.score >= 3)
      .sort((a, b) => (b.saturday.score - a.saturday.score) || a.name.localeCompare(b.name))
      .slice(0, 5);

    const sunRanked = projections
      .filter(p => p.sunday && p.sunday.score >= 3)
      .sort((a, b) => (b.sunday.score - a.sunday.score) || a.name.localeCompare(b.name))
      .slice(0, 5);

    const payload = {
      weekend,
      saturday: {
        date: weekend.saturday.date,
        dayName: 'Saturday',
        topRivers: satRanked.map(p => ({
          id: p.id, name: p.name, region: p.region, species: p.species,
          currentRating: p.current.ratingKey,
          projectedRating: p.saturday.projectedRating,
          rain: p.saturday.rain,
          airTemp: p.saturday.airTemp,
          forecast: p.saturday.forecast,
          flow: p.current.flow,
          tempF: p.current.tempF,
        })),
      },
      sunday: {
        date: weekend.sunday.date,
        dayName: 'Sunday',
        topRivers: sunRanked.map(p => ({
          id: p.id, name: p.name, region: p.region, species: p.species,
          currentRating: p.current.ratingKey,
          projectedRating: p.sunday.projectedRating,
          rain: p.sunday.rain,
          airTemp: p.sunday.airTemp,
          forecast: p.sunday.forecast,
          flow: p.current.flow,
          tempF: p.current.tempF,
        })),
      },
      generatedAt: new Date().toISOString(),
    };

    if (redis) {
      try { await redis.set(cacheKey, JSON.stringify(payload), { ex: CACHE_TTL }); }
      catch(e) {}
    }

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({ success: true, cached: false, ...payload });

  } catch(e) {
    console.error('[weekend]', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
