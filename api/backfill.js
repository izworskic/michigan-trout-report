// GET /api/backfill?secret=CRON_SECRET&days=14
// One-time endpoint to seed Redis with real historical USGS data.
// Fetches daily mean flow + temp for past N days, rates each day,
// stores in same format the cron uses — nothing downstream breaks.
//
// Safe to call multiple times: existing snapshots are overwritten with
// the same data (idempotent). Does NOT touch today's live cache.

import { Redis } from '@upstash/redis';
import { RIVERS } from '../lib/rivers.js';
import { fetchAllStats } from '../lib/usgs.js';
import { buildConditions } from '../lib/rater.js';

function makeRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const HISTORY_TTL = 365 * 24 * 60 * 60;
const UA = 'MichiganTroutReport/1.0 (+https://michigan-trout-report.vercel.app)';

// Fetch daily mean values (flow + temp) for multiple gauges over a date range
async function fetchDailyMeans(gaugeIds, startDate, endDate) {
  const sites = gaugeIds.join(',');
  const url = `https://waterservices.usgs.gov/nwis/dv/?format=json&sites=${sites}&parameterCd=00060,00010&startDT=${startDate}&endDT=${endDate}&statCd=00003`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA }
    });
    clearTimeout(t);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();

    // Build: { gaugeId: { 'YYYY-MM-DD': { flow, temp_c } } }
    const out = {};
    for (const s of (d.value?.timeSeries || [])) {
      const siteId = s.sourceInfo?.siteCode?.[0]?.value;
      const param  = s.variable?.variableCode?.[0]?.value;
      if (!out[siteId]) out[siteId] = {};

      for (const v of (s.values?.[0]?.value || [])) {
        const date = v.dateTime.slice(0, 10);
        const val  = parseFloat(v.value);
        if (v.value === '-999999' || isNaN(val)) continue;
        if (!out[siteId][date]) out[siteId][date] = { flow: null, temp_c: null };
        if (param === '00060') out[siteId][date].flow   = val;
        if (param === '00010') out[siteId][date].temp_c = val;
      }
    }
    return out;
  } catch(e) {
    console.error('[backfill] USGS fetch error:', e.message);
    return {};
  }
}

// Store a snapshot — same logic as lib/history.js storeSnapshot
async function storeSnapshot(redis, riverId, date, conditions, guideNotes = null) {
  const key = `trout:history:${riverId}:${date}`;
  const snapshot = {
    date,
    flow:      conditions.flow,
    flowPct:   conditions.flowPct,
    tempF:     conditions.tempF,
    gage:      conditions.gage,
    ratingKey: conditions.ratingKey,
    guideNotes,
    source:    'backfill',
    storedAt:  new Date().toISOString(),
  };

  await redis.set(key, JSON.stringify(snapshot), { ex: HISTORY_TTL });

  // Update index
  const indexKey = `trout:history:index:${riverId}`;
  let dates = [];
  try {
    const existing = await redis.get(indexKey);
    dates = existing ? (typeof existing === 'string' ? JSON.parse(existing) : existing) : [];
  } catch(e) { dates = []; }

  if (!dates.includes(date)) {
    dates.push(date);
    dates.sort();
    dates = dates.slice(-400);
    await redis.set(indexKey, JSON.stringify(dates), { ex: HISTORY_TTL });
  }

  return snapshot;
}

export default async function handler(req, res) {
  // Auth
  const secret = req.query?.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const days = Math.min(parseInt(req.query?.days || '14'), 30);
  const r    = makeRedis();
  if (!r) return res.status(500).json({ error: 'Redis not configured' });

  const log = [];
  const ts  = () => new Date().toISOString();

  try {
    // Date range: from N days ago to yesterday (not today — don't touch live data)
    const today     = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const startDay  = new Date(today); startDay.setDate(today.getDate() - days);

    const fmt = d => d.toISOString().slice(0, 10);
    const startDate = fmt(startDay);
    const endDate   = fmt(yesterday);

    log.push(`[${ts()}] Backfilling ${startDate} → ${endDate} (${days} days)`);

    // Primary gauge IDs for all rivers
    const primaryGauges = RIVERS.map(r => r.primaryGauge);
    log.push(`[${ts()}] Fetching daily means for ${primaryGauges.length} gauges`);

    // Fetch daily mean values and seasonal stats in parallel
    const [dailyMeans, allStats] = await Promise.all([
      fetchDailyMeans(primaryGauges, startDate, endDate),
      fetchAllStats(primaryGauges),
    ]);

    log.push(`[${ts()}] USGS data fetched — ${Object.keys(dailyMeans).length} gauges returned`);

    // Generate all dates in range
    const dates = [];
    const cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      dates.push(fmt(cur));
      cur.setDate(cur.getDate() + 1);
    }

    log.push(`[${ts()}] Processing ${dates.length} dates × ${RIVERS.length} rivers`);

    let stored = 0;
    let skipped = 0;
    const summary = {};

    for (const river of RIVERS) {
      summary[river.id] = { stored: 0, skipped: 0 };
      const gaugeData = dailyMeans[river.primaryGauge] || {};
      const stats     = allStats[river.primaryGauge]   || {};

      for (const date of dates) {
        const dayData = gaugeData[date];
        if (!dayData) { skipped++; summary[river.id].skipped++; continue; }

        // Build a reading object compatible with buildConditions
        const reading = {
          flow:   dayData.flow,
          temp_c: dayData.temp_c,
          gage:   null, // daily mean doesn't include gage height
          timestamp: date,
        };

        const conditions = buildConditions(reading, stats);
        await storeSnapshot(r, river.id, date, conditions, null);
        stored++;
        summary[river.id].stored++;
      }
    }

    log.push(`[${ts()}] Done — ${stored} snapshots stored, ${skipped} skipped (no data)`);

    return res.status(200).json({
      success: true,
      stored,
      skipped,
      dateRange: { start: startDate, end: endDate },
      days,
      summary,
      log,
    });

  } catch(e) {
    log.push(`[${ts()}] ERROR: ${e.message}`);
    return res.status(500).json({ success: false, error: e.message, log });
  }
}
