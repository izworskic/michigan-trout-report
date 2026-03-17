// USGS Water Services — live readings + seasonal percentile stats
// parameterCd: 00060 = discharge (cfs), 00010 = water temp (°C), 00065 = gage height (ft)

const USGS_IV   = 'https://waterservices.usgs.gov/nwis/iv/';
const USGS_STAT = 'https://waterservices.usgs.gov/nwis/stat/';

async function fetchTimeout(url, ms = 12000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'MichiganTroutReport/1.0 (freighterviewfarms.com)' }
    });
    clearTimeout(id);
    return r;
  } catch(e) { clearTimeout(id); throw e; }
}

// Fetch live instantaneous values for a list of gauge IDs
export async function fetchLiveReadings(gaugeIds) {
  const sites = gaugeIds.join(',');
  // 00060=flow, 00010=temp, 00065=gage, 63680=turbidity FNU, 00300=dissolved oxygen
  const url = `${USGS_IV}?format=json&sites=${sites}&parameterCd=00060,00010,00065,63680,00300&siteStatus=active`;
  try {
    const r = await fetchTimeout(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    const series = d.value?.timeSeries || [];

    // Discard readings older than 48 hours (sensor outages / seasonal shutdowns)
    const STALE_MS = 48 * 60 * 60 * 1000;
    function isFresh(dt) {
      if (!dt) return false;
      return (Date.now() - new Date(dt).getTime()) < STALE_MS;
    }

    const readings = {};
    for (const s of series) {
      const siteId   = s.sourceInfo?.siteCode?.[0]?.value;
      const siteName = s.sourceInfo?.siteName;
      const param    = s.variable?.variableCode?.[0]?.value;
      const vals     = s.values?.[0]?.value || [];
      const latest   = vals.find(v => v.value !== '-999999') || vals[0];
      const raw      = latest ? parseFloat(latest.value) : null;
      const value    = (raw === null || isNaN(raw) || raw === -999999) ? null : raw;
      const dt       = latest?.dateTime || null;

      if (!readings[siteId]) readings[siteId] = {
        siteId, siteName,
        flow: null, temp_c: null, gage: null,
        turbidity_fnu: null, do_mgl: null,
        timestamp: null
      };

      // Flow — most reliable, always use
      if (param === '00060') {
        readings[siteId].flow = value;
        if (dt) readings[siteId].timestamp = dt;
      }
      // Temp, turbidity, DO — only if fresh (sensors go offline seasonally)
      if (param === '00010') {
        readings[siteId].temp_c = isFresh(dt) ? value : null;
        if (!isFresh(dt) && value !== null) console.log(`[usgs] stale temp ${siteId} (${dt?.slice(0,10)})`);
      }
      if (param === '00065') {
        readings[siteId].gage = isFresh(dt) ? value : null;
      }
      if (param === '63680') {
        readings[siteId].turbidity_fnu = isFresh(dt) ? value : null;
        if (!isFresh(dt) && value !== null) console.log(`[usgs] stale turbidity ${siteId} (${dt?.slice(0,10)})`);
      }
      if (param === '00300') {
        readings[siteId].do_mgl = isFresh(dt) ? value : null;
      }
    }
    return readings;
  } catch(e) {
    console.error('[usgs] live fetch error:', e.message);
    return {};
  }
}

// Fetch historical p10/p25/p50/p75/p90 for a gauge on today's month/day
export async function fetchSeasonalStats(gaugeId) {
  const url = `${USGS_STAT}?format=rdb&sites=${gaugeId}&statReportType=daily&statTypeCd=p10,p25,p50,p75,p90&parameterCd=00060`;
  try {
    const r = await fetchTimeout(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();

    const today = new Date();
    const mo = String(today.getMonth() + 1);
    const dy = String(today.getDate());

    for (const line of text.split('\n')) {
      if (line.startsWith('#') || line.startsWith('agency') || line.startsWith('5s')) continue;
      const parts = line.split('\t');
      if (parts.length < 13) continue;
      if (parts[5] === mo && parts[6] === dy) {
        return {
          gaugeId,
          p10: parseFloat(parts[9])  || null,
          p25: parseFloat(parts[10]) || null,
          p50: parseFloat(parts[11]) || null,
          p75: parseFloat(parts[12]) || null,
          p90: parseFloat(parts[13]) || null,
        };
      }
    }
    return { gaugeId, p10: null, p25: null, p50: null, p75: null, p90: null };
  } catch(e) {
    return { gaugeId, p10: null, p25: null, p50: null, p75: null, p90: null };
  }
}

// Fetch stats for multiple gauges in parallel (limit concurrency)
export async function fetchAllStats(gaugeIds) {
  const results = {};
  // Batch in groups of 5 to avoid hammering USGS
  for (let i = 0; i < gaugeIds.length; i += 5) {
    const batch = gaugeIds.slice(i, i + 5);
    const batchResults = await Promise.all(batch.map(id => fetchSeasonalStats(id)));
    for (const r of batchResults) results[r.gaugeId] = r;
  }
  return results;
}
