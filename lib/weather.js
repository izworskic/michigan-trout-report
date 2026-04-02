// Michigan Trout Report — NWS Weather Forecast
//
// Fetches 7-day and hourly forecasts from api.weather.gov for each river location.
// Grid points pre-computed from USGS gauge lat/lon — no API key required.
// Interprets forecast through a fishing lens: air temp trend, rain/flow impact,
// cloud cover (hatch timing), wind, and upcoming best windows.

const NWS_BASE = 'https://api.weather.gov';
const UA = 'MichiganTroutReport/1.0 (freighterviewfarms.com)';

// Pre-computed NWS grid points for each river's primary gauge location
// Derived from USGS site lat/lon → api.weather.gov/points/{lat},{lon}
export const RIVER_GRIDS = {
  'ausable':         { lat: 44.6600, lon: -84.1311, cwa: 'APX', gridX: 78,  gridY: 45 },
  'manistee':        { lat: 44.6931, lon: -84.8472, cwa: 'APX', gridX: 55,  gridY: 45 },
  'pere-marquette':  { lat: 43.9450, lon: -86.2786, cwa: 'GRR', gridX: 17,  gridY: 91 },
  'muskegon':        { lat: 43.4347, lon: -85.6653, cwa: 'GRR', gridX: 40,  gridY: 69 },
  'boardman':        { lat: 44.6753, lon: -85.6308, cwa: 'APX', gridX: 29,  gridY: 42 },
  'jordan':          { lat: 45.1011, lon: -85.0972, cwa: 'APX', gridX: 45,  gridY: 63 },
  'pigeon':          { lat: 45.1561, lon: -84.4675, cwa: 'APX', gridX: 66,  gridY: 68 },
  'rifle':           { lat: 44.0725, lon: -84.0200, cwa: 'APX', gridX: 84,  gridY: 18 },
  'little-manistee': { lat: 44.1711, lon: -86.1033, cwa: 'APX', gridX: 15,  gridY: 18 },
  // Phase 1 expansion rivers
  'escanaba-river':         { lat: 45.9089, lon: -87.2135, cwa: 'MQT', gridX: 161, gridY: 41 },
  'ford-river':             { lat: 45.7550, lon: -87.2021, cwa: 'MQT', gridX: 162, gridY: 34 },
  'cedar-river-up':         { lat: 45.5239, lon: -87.3950, cwa: 'MQT', gridX: 156, gridY: 22 },
  'paint-river-up':         { lat: 46.1058, lon: -88.3349, cwa: 'MQT', gridX: 124, gridY: 48 },
  'sturgeon-river-nahma':   { lat: 45.9430, lon: -86.7057, cwa: 'MQT', gridX: 178, gridY: 43 },
  'salmon-trout-eb':        { lat: 46.7858, lon: -87.8524, cwa: 'MQT', gridX: 138, gridY: 81 },
  'cisco-branch-ontonagon': { lat: 46.2533, lon: -89.4525, cwa: 'MQT', gridX: 87,  gridY: 53 },
  'pine-river-rudyard':     { lat: 46.1906, lon: -84.6122, cwa: 'APX', gridX: 57,  gridY: 116 },
  'menominee-river':        { lat: 45.4819, lon: -87.8022, cwa: 'MQT', gridX: 143, gridY: 20 },
  'sturgeon-river-loretto': { lat: 45.7761, lon: -87.8285, cwa: 'MQT', gridX: 141, gridY: 33 },
  'pine-river-oscoda':      { lat: 44.5117, lon: -83.4068, cwa: 'APX', gridX: 103, gridY: 40 },
  'chippewa-creek-evart':   { lat: 43.9258, lon: -85.2667, cwa: 'GRR', gridX: 51,  gridY: 92 },
  'muskegon-bridgeton':     { lat: 43.3472, lon: -85.9395, cwa: 'GRR', gridX: 31,  gridY: 64 },
  'bear-creek-muskegon':    { lat: 43.2886, lon: -86.2228, cwa: 'GRR', gridX: 21,  gridY: 61 },
  'east-branch-au-gres':    { lat: 44.1436, lon: -83.5856, cwa: 'APX', gridX: 99,  gridY: 23 },
  'dowagiac-river':         { lat: 42.0278, lon: -86.1075, cwa: 'IWX', gridX: 33,  gridY: 79 },
  'augusta-creek':          { lat: 42.3534, lon: -85.3539, cwa: 'GRR', gridX: 54,  gridY: 20 },
  'black-river-bangor':     { lat: 42.3542, lon: -86.1875, cwa: 'GRR', gridX: 25,  gridY: 18 },
  'red-cedar-river':        { lat: 42.6831, lon: -84.2191, cwa: 'GRR', gridX: 91,  gridY: 38 },
  'thornapple-caledonia':   { lat: 42.8111, lon: -85.4834, cwa: 'GRR', gridX: 48,  gridY: 40 },
  'dowagiac-creek':         { lat: 41.9836, lon: -86.0028, cwa: 'IWX', gridX: 37,  gridY: 77 },
  'chippewa-river-mp':      { lat: 43.6261, lon: -84.7078, cwa: 'GRR', gridX: 71,  gridY: 80 },
  'wolf-creek':             { lat: 43.4231, lon: -84.9503, cwa: 'GRR', gridX: 64,  gridY: 70 },
  'pigeon-river-olive':     { lat: 42.9328, lon: -86.0820, cwa: 'GRR', gridX: 27,  gridY: 45 },
  'tittabawassee-river':    { lat: 43.6770, lon: -84.3825, cwa: 'DTX', gridX: 16,  gridY: 92 },
  // Additional rivers — lat/lon from USGS gauge sites (for sun calculations)
  'black-river-up':         { lat: 46.5113, lon: -90.0746 },
  'presque-isle-river':     { lat: 46.6961, lon: -89.9740 },
  'sturgeon-river-up':      { lat: 46.5841, lon: -88.5760 },
  'ontonagon-river':        { lat: 46.7208, lon: -89.2071 },
  'trap-rock-river':        { lat: 47.2285, lon: -88.3854 },
  'silver-river':           { lat: 46.8041, lon: -88.3171 },
  'salmon-trout-river':     { lat: 46.7821, lon: -87.8776 },
  'au-train-river':         { lat: 46.3408, lon: -86.8502 },
  'miners-river':           { lat: 46.4878, lon: -86.5405 },
  'tahquamenon-river':      { lat: 46.5746, lon: -85.2696 },
  'black-river-schoolcraft': { lat: 46.1178, lon: -85.3661 },
  'iron-river':             { lat: 46.0586, lon: -88.6274 },
  'michigamme-river':       { lat: 46.1138, lon: -88.2160 },
  'brule-river':            { lat: 45.9608, lon: -88.3160 },
  'sturgeon-river-nlp':     { lat: 45.2745, lon: -84.6000 },
  'platte-river':           { lat: 44.6681, lon: -86.0348 },
  'betsie-river':           { lat: 44.5300, lon: -85.9500 },
  'thunder-bay-river':      { lat: 45.1242, lon: -83.6355 },
  'white-river':            { lat: 43.4642, lon: -86.2326 },
  'little-muskegon-river':  { lat: 43.4309, lon: -85.5956 },
  'clam-river':             { lat: 44.2006, lon: -85.0528 },
  'rogue-river':            { lat: 43.0822, lon: -85.5909 },
  'flat-river':             { lat: 43.0700, lon: -85.2700 },
  'thornapple-river':       { lat: 42.6159, lon: -85.2364 },
  'looking-glass-river':    { lat: 42.8281, lon: -84.7594 },
  'maple-river-lp':         { lat: 43.1098, lon: -84.6931 },
  'pine-river-midland':     { lat: 43.5645, lon: -84.3692 },
  'au-gres-river':          { lat: 44.0802, lon: -83.6859 },
};

async function timedFetch(url, ms = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Accept': 'application/geo+json' }
    });
    clearTimeout(t);
    return r;
  } catch(e) { clearTimeout(t); throw e; }
}

// Fetch 7-day forecast for a river
async function fetchForecast(riverId) {
  const grid = RIVER_GRIDS[riverId];
  if (!grid) return null;
  const url = `${NWS_BASE}/gridpoints/${grid.cwa}/${grid.gridX},${grid.gridY}/forecast`;
  try {
    const r = await timedFetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    return d.properties?.periods || [];
  } catch(e) {
    console.error(`[weather] forecast error for ${riverId}:`, e.message);
    return null;
  }
}

// Fetch hourly forecast (next 24h)
async function fetchHourly(riverId) {
  const grid = RIVER_GRIDS[riverId];
  if (!grid) return null;
  const url = `${NWS_BASE}/gridpoints/${grid.cwa}/${grid.gridX},${grid.gridY}/forecast/hourly`;
  try {
    const r = await timedFetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    return (d.properties?.periods || []).slice(0, 24);
  } catch(e) {
    console.error(`[weather] hourly error for ${riverId}:`, e.message);
    return null;
  }
}

// ── Fishing interpretation ─────────────────────────────────────────────────

function interpretPrecip(pct) {
  if (pct === null || pct === undefined) return null;
  if (pct >= 70) return { level: 'high',   label: 'Heavy rain likely',     flowImpact: 'Expect rising, off-color water in 12-24h. Flow will climb.' };
  if (pct >= 40) return { level: 'medium', label: 'Rain possible',          flowImpact: 'Minor flow rise possible. Monitor before the trip.' };
  if (pct >= 20) return { level: 'low',    label: 'Slight chance of rain',  flowImpact: 'Minimal flow impact expected.' };
  return           { level: 'none',   label: 'Dry',                   flowImpact: 'No rain impact on flow.' };
}

function interpretCloud(forecast) {
  const f = (forecast || '').toLowerCase();
  if (/sunny|clear|mostly sunny/.test(f))  return { cover: 'sunny',    hatchTip: 'Full sun suppresses hatches midday. Best activity early morning and evening.' };
  if (/partly cloudy|partly sunny/.test(f)) return { cover: 'partial',  hatchTip: 'Partly cloudy: good hatch conditions. BWO and caddis may emerge during cloud breaks.' };
  if (/mostly cloudy|cloudy|overcast/.test(f)) return { cover: 'cloudy', hatchTip: 'Overcast: ideal hatch conditions. BWO and midges can hatch throughout the day.' };
  if (/rain|shower|drizzle/.test(f))       return { cover: 'rain',     hatchTip: 'Light rain often triggers excellent caddis and BWO activity.' };
  if (/snow/.test(f))                      return { cover: 'snow',     hatchTip: 'Snow suppresses most hatches. Midge activity possible midday.' };
  return { cover: 'variable', hatchTip: 'Variable conditions — watch for cloud breaks to time hatch activity.' };
}

function interpretWind(windSpeed, windDir) {
  if (!windSpeed) return null;
  // Extract max mph from strings like "5 to 15 mph" or "15 mph"
  const nums = (windSpeed.match(/\d+/g) || []).map(Number);
  const maxMph = nums.length ? Math.max(...nums) : 0;
  if (maxMph >= 25) return { level: 'high',   label: `${windSpeed} ${windDir || ''}`.trim(), tip: 'High wind: difficult casting and dry fly presentation. Switch to nymphs or streamers.' };
  if (maxMph >= 15) return { level: 'medium', label: `${windSpeed} ${windDir || ''}`.trim(), tip: 'Moderate wind: challenging dry fly work. Fish sheltered banks and pools.' };
  if (maxMph >= 8)  return { level: 'light',  label: `${windSpeed} ${windDir || ''}`.trim(), tip: 'Light wind: manageable. Will put some chop on the surface that can help conceal your approach.' };
  return               { level: 'calm',   label: `${windSpeed} ${windDir || ''}`.trim(), tip: 'Calm: ideal conditions for dry fly and precise presentations. Approach with extra stealth — fish can see you easily.' };
}

function findBestWindow(periods) {
  if (!periods?.length) return null;
  // Score each period for fishing quality
  const scored = periods.slice(0, 8).map(p => {
    let score = 0;
    const temp = p.temperature;
    const unit = p.temperatureUnit;
    const tempF = unit === 'C' ? temp * 9/5 + 32 : temp;
    const rain = p.probabilityOfPrecipitation?.value || 0;
    const forecast = (p.shortForecast || '').toLowerCase();
    const isDaytime = p.isDaytime;

    // Temperature scoring
    if (tempF >= 45 && tempF <= 65) score += 3;
    else if (tempF >= 38 && tempF < 45) score += 1;
    else if (tempF > 65 && tempF <= 72) score += 2;

    // Rain scoring (a little rain is fine, heavy rain is bad)
    if (rain <= 20) score += 2;
    else if (rain <= 40) score += 1;
    else if (rain >= 70) score -= 2;

    // Cloud scoring
    if (/mostly cloudy|overcast|cloudy/.test(forecast)) score += 2;
    if (/partly/.test(forecast)) score += 1;
    if (/rain|shower/.test(forecast) && rain < 60) score += 1; // light rain can be great

    // Daytime preference
    if (isDaytime) score += 1;

    // Evening bonus (hatch timing)
    const name = (p.name || '').toLowerCase();
    if (/evening|afternoon/.test(name)) score += 1;

    return { ...p, score, tempF: Math.round(tempF) };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return null;

  return {
    name:      best.name,
    tempF:     best.tempF,
    forecast:  best.shortForecast,
    rain:      best.probabilityOfPrecipitation?.value || 0,
    wind:      best.windSpeed,
    score:     best.score,
  };
}

// ── Main export ────────────────────────────────────────────────────────────

export async function fetchRiverWeather(riverId) {
  const [periods, hourly] = await Promise.all([
    fetchForecast(riverId),
    fetchHourly(riverId),
  ]);

  if (!periods) return null;

  // Today and tonight
  const today   = periods.find(p => p.isDaytime) || periods[0];
  const tonight = periods.find(p => !p.isDaytime) || periods[1];

  // Next 7 days (daytime only)
  const week = periods.filter(p => p.isDaytime).slice(0, 7).map(p => {
    const tempF = p.temperatureUnit === 'C' ? Math.round(p.temperature * 9/5 + 32) : p.temperature;
    const rain  = p.probabilityOfPrecipitation?.value || 0;
    return {
      name:     p.name,
      tempF,
      tempLow:  null, // filled below
      forecast: p.shortForecast,
      rain,
      wind:     p.windSpeed,
      cloud:    interpretCloud(p.shortForecast),
      precip:   interpretPrecip(rain),
      wind_int: interpretWind(p.windSpeed, p.windDirection),
    };
  });

  // Add overnight lows to each day
  const nights = periods.filter(p => !p.isDaytime);
  week.forEach((day, i) => {
    const night = nights[i];
    if (night) {
      day.tempLow = night.temperatureUnit === 'C'
        ? Math.round(night.temperature * 9/5 + 32)
        : night.temperature;
    }
  });

  // Today's interpretation
  const todayTempF  = today.temperatureUnit === 'C' ? Math.round(today.temperature * 9/5 + 32) : today.temperature;
  const todayRain   = today.probabilityOfPrecipitation?.value || 0;
  const todayCloud  = interpretCloud(today.shortForecast);
  const todayPrecip = interpretPrecip(todayRain);
  const todayWind   = interpretWind(today.windSpeed, today.windDirection);

  // Best upcoming window
  const bestWindow = findBestWindow(periods);

  // Hourly summary for today (next 12h)
  const hourlyToday = (hourly || []).slice(0, 12).map(h => ({
    time:    h.startTime,
    tempF:   h.temperatureUnit === 'C' ? Math.round(h.temperature * 9/5 + 32) : h.temperature,
    rain:    h.probabilityOfPrecipitation?.value || 0,
    wind:    h.windSpeed,
    short:   h.shortForecast,
  }));

  // Rain trend — is flow likely to rise?
  const rainNext48 = periods.slice(0, 4).map(p => p.probabilityOfPrecipitation?.value || 0);
  const maxRainNext48 = Math.max(...rainNext48);
  let flowTrend = 'stable';
  if (maxRainNext48 >= 70) flowTrend = 'rising_likely';
  else if (maxRainNext48 >= 40) flowTrend = 'rising_possible';

  return {
    today: {
      name:      today.name,
      tempF:     todayTempF,
      forecast:  today.shortForecast,
      detail:    today.detailedForecast,
      rain:      todayRain,
      wind:      today.windSpeed,
      cloud:     todayCloud,
      precip:    todayPrecip,
      wind_int:  todayWind,
    },
    tonight: tonight ? {
      name:    tonight.name,
      tempF:   tonight.temperatureUnit === 'C' ? Math.round(tonight.temperature * 9/5 + 32) : tonight.temperature,
      forecast: tonight.shortForecast,
      rain:    tonight.probabilityOfPrecipitation?.value || 0,
    } : null,
    week,
    bestWindow,
    flowTrend,
    maxRainNext48,
    hourly: hourlyToday,
    fetchedAt: new Date().toISOString(),
  };
}

// Fetch weather for all rivers — used by cron
export async function fetchAllWeather(riverIds) {
  const out = {};
  for (const id of riverIds) {
    out[id] = await fetchRiverWeather(id);
    await new Promise(r => setTimeout(r, 200));
  }
  return out;
}
