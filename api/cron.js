// Daily cron — 8am CT (13:00 UTC), set in vercel.json
// Fetches USGS data, generates AI brief, caches to Redis.

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

export default async function handler(req, res) {
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const log = [];
  const ts  = () => new Date().toISOString();

  try {
    log.push(`[${ts()}] Cron starting — Michigan Trout Report daily run`);

    const [liveReadings, allStats] = await Promise.all([
      fetchLiveReadings(ALL_GAUGE_IDS),
      fetchAllStats(ALL_GAUGE_IDS),
    ]);
    log.push(`[${ts()}] USGS data fetched — ${Object.keys(liveReadings).length} gauges`);

    const riverData = RIVERS.map(river => {
      const reading  = liveReadings[river.primaryGauge] || {};
      const stats    = allStats[river.primaryGauge]    || {};
      const conditions = buildConditions(reading, stats);
      const allGauges  = river.gauges.map(g => ({
        ...g,
        conditions: buildConditions(liveReadings[g.id] || {}, allStats[g.id] || {}),
      }));
      return { id: river.id, name: river.name, region: river.region, notes: river.notes, conditions, allGauges };
    });

    const brief = await generateBrief(riverData);
    log.push(`[${ts()}] Brief generated`);

    const today   = todayUTC();
    const ttl     = secondsUntilMidnight() + 120;
    const payload = { rivers: riverData, brief, generated_at: new Date().toISOString(), date: today };

    const r = makeRedis();
    if (r) {
      await r.set(`trout:daily:${today}`, JSON.stringify(payload), { ex: ttl });
      log.push(`[${ts()}] Cached to Redis`);
    }

    return res.status(200).json({ success: true, log });
  } catch(e) {
    log.push(`[${ts()}] ERROR: ${e.message}`);
    return res.status(500).json({ success: false, error: e.message, log });
  }
}
