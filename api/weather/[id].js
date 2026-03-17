// GET /api/weather/[id]
// Returns NWS forecast for a river location, cached 2 hours in Redis.

import { Redis } from '@upstash/redis';
import { fetchRiverWeather } from '../../lib/weather.js';

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const CACHE_TTL = 2 * 60 * 60; // 2 hours

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  const redis  = makeRedis();
  const key    = `trout:weather:${id}:${new Date().toISOString().slice(0, 13)}`; // hourly bucket

  // Cache check
  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json({ success: true, cached: true, ...parsed });
      }
    } catch(e) { /* non-fatal */ }
  }

  try {
    const weather = await fetchRiverWeather(id);
    if (!weather) return res.status(404).json({ success: false, error: 'No weather data for this river' });

    const payload = { weather, id, fetchedAt: new Date().toISOString() };

    if (redis) {
      try { await redis.set(key, JSON.stringify(payload), { ex: CACHE_TTL }); }
      catch(e) { /* non-fatal */ }
    }

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({ success: true, cached: false, ...payload });
  } catch(e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
