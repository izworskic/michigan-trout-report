// HTML availability does not depend on private state or optional source latency.
import { buildConditions } from './rater.js';
const finite = n => typeof n === 'number' && Number.isFinite(n);
export const PAGE_SOURCE_BUDGET_MS = 4000;
export async function withinBudget(work, fallback, ms) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(work).catch(() => fallback),
      new Promise(resolve => { timer = setTimeout(() => resolve(fallback), ms); }),
    ]);
  } finally { clearTimeout(timer); }
}
export async function loadPageConditions(gaugeId, {fetchLiveReadings,fetchAllStats,timeoutMs=PAGE_SOURCE_BUDGET_MS}) {
  const opts = {timeoutMs};
  const [readings, stats] = await Promise.all([
    withinBudget(() => fetchLiveReadings([gaugeId], opts), {}, timeoutMs),
    withinBudget(() => fetchAllStats([gaugeId], opts), {}, timeoutMs),
  ]);
  const raw=readings?.[gaugeId]||{}, s=stats?.[gaugeId]||{};
  const cfs=finite(raw.flow)&&raw.flow>=0?raw.flow:null;
  const tempC=finite(raw.temp_c)?raw.temp_c:null;
  const gaugeHeight=finite(raw.gage)?raw.gage:null;
  const hasData=[cfs,tempC,gaugeHeight].some(finite);
  const canRate=cfs!==null&&tempC!==null&&finite(s.p50)&&s.p50>0;
  return {cfs,tempC,gaugeHeight,hasData,complete:canRate&&gaugeHeight!==null,
    rating:canRate?buildConditions({flow:cfs,temp_c:tempC,gage:gaugeHeight},s).rating:null,
    flowTimestamp:cfs!==null&&typeof raw.timestamp==='string'&&Number.isFinite(Date.parse(raw.timestamp))?raw.timestamp:null};
}
export function pageCacheControl(c) {
  return c.complete?'public, s-maxage=1800, stale-while-revalidate=1800':'public, s-maxage=60, stale-while-revalidate=120';
}
