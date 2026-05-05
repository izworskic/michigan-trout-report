// Michigan Trout Report: Historical Memory
//
// Daily snapshots stored in Redis:
//   trout:history:{riverId}:{YYYY-MM-DD} → { flow, flowPct, tempF, ratingKey, guideNotes, date }
//
// "Similar conditions" query:
//   Find past dates where flow% is within ±20% and temp within ±8°F of today.
//   Return what guides reported those days.

const HISTORY_TTL = 365 * 24 * 60 * 60; // 1 year
const MIN_HISTORY_FOR_PREDICTION = 14;    // days before we show predictions

// Store today's snapshot for a river
export async function storeSnapshot(redis, riverId, conditions, guideNotes) {
  if (!redis) return;
  const date = new Date().toISOString().slice(0, 10);
  const key = `trout:history:${riverId}:${date}`;

  const snapshot = {
    date,
    flow:     conditions.flow,
    flowPct:  conditions.flowPct,
    tempF:    conditions.tempF,
    gage:     conditions.gage,
    ratingKey: conditions.ratingKey,
    guideNotes: guideNotes || null,
    storedAt: new Date().toISOString(),
  };

  try {
    await redis.set(key, JSON.stringify(snapshot), { ex: HISTORY_TTL });
    // Also maintain an index of dates for this river
    const indexKey = `trout:history:index:${riverId}`;
    const existing = await redis.get(indexKey);
    const dates = existing
      ? (Array.isArray(existing) ? existing : JSON.parse(existing))
      : [];
    if (!dates.includes(date)) {
      dates.push(date);
      dates.sort();
      // Keep last 400 dates max
      const trimmed = dates.slice(-400);
      await redis.set(indexKey, JSON.stringify(trimmed), { ex: HISTORY_TTL });
    }
  } catch(e) {
    console.warn('[history] store error:', e.message);
  }
}

// Get historical snapshots for a river
export async function getHistory(redis, riverId, limit = 90) {
  if (!redis) return [];
  try {
    const indexKey = `trout:history:index:${riverId}`;
    const existing = await redis.get(indexKey);
    if (!existing) return [];
    // Upstash SDK auto-deserializes JSON: handle both string and array
    const dates = (Array.isArray(existing) ? existing : JSON.parse(existing)).slice(-limit);

    const snapshots = await Promise.all(
      dates.map(async date => {
        try {
          const val = await redis.get(`trout:history:${riverId}:${date}`);
          if (!val) return null;
          // Handle both raw string and auto-deserialized object
          return typeof val === 'string' ? JSON.parse(val) : val;
        } catch(e) { return null; }
      })
    );
    return snapshots.filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
  } catch(e) {
    console.warn('[history] get error:', e.message);
    return [];
  }
}

// Find past dates with similar conditions to today
export async function findSimilarDays(redis, riverId, currentFlow, currentFlowPct, currentTempF) {
  if (!redis) return { matches: [], totalDays: 0 };

  const history = await getHistory(redis, riverId, 365);
  if (!history.length) return { matches: [], totalDays: 0 };

  const today = new Date().toISOString().slice(0, 10);

  // Match on flow% (±20%) and temp (±8°F): both must match if available
  const matches = history.filter(snap => {
    if (snap.date === today) return false;

    let flowMatch = true;
    let tempMatch = true;

    if (currentFlowPct !== null && snap.flowPct !== null) {
      flowMatch = Math.abs(snap.flowPct - currentFlowPct) <= 20;
    }

    if (currentTempF !== null && snap.tempF !== null) {
      tempMatch = Math.abs(snap.tempF - currentTempF) <= 8;
    }

    // Also match by season (within 6 weeks of same calendar date)
    const snapMD  = snap.date.slice(5);
    const todayMD = today.slice(5);
    const snapDOY  = dayOfYear(snap.date);
    const todayDOY = dayOfYear(today);
    const dayDiff  = Math.abs(snapDOY - todayDOY);
    const seasonMatch = dayDiff <= 42 || dayDiff >= (365 - 42); // within 6 weeks

    return flowMatch && tempMatch && seasonMatch;
  });

  // Sort by most recent
  matches.sort((a, b) => b.date.localeCompare(a.date));

  return {
    matches:   matches.slice(0, 5),
    totalDays: history.length,
    hasEnough: history.length >= MIN_HISTORY_FOR_PREDICTION,
  };
}

function dayOfYear(dateStr) {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / (1000 * 60 * 60 * 24));
}

// Summary stats for a river's history
export async function getHistorySummary(redis, riverId) {
  if (!redis) return null;
  const history = await getHistory(redis, riverId, 365);
  if (!history.length) return { days: 0 };

  const withFlow = history.filter(h => h.flowPct !== null);
  const withTemp = history.filter(h => h.tempF !== null);
  const withNotes = history.filter(h => h.guideNotes);

  const ratingCounts = {};
  for (const h of history) {
    ratingCounts[h.ratingKey] = (ratingCounts[h.ratingKey] || 0) + 1;
  }

  return {
    days:         history.length,
    daysWithFlow: withFlow.length,
    daysWithTemp: withTemp.length,
    daysWithNotes: withNotes.length,
    ratingCounts,
    oldestDate:   history[history.length - 1]?.date,
    newestDate:   history[0]?.date,
  };
}
