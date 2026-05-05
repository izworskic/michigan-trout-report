// Michigan Trout Report: Hex Hatch Tracker Engine
//
// Hexagenia limbata emergence probability calculator for the AuSable River.
// Combines live USGS water temp, NWS weather, sunset time, and moon phase
// into a 0-100 probability score with go/no-go recommendation.

import { calcSunTimes, estimateSpinnerFall } from './sun.js';

// ── Moon Phase Calculator ──────────────────────────────────────────────────
// Simplified algorithm based on known new moon reference (Jan 6 2000 18:14 UTC)
const LUNAR_CYCLE = 29.53058770576;
const REF_NEW_MOON = new Date('2000-01-06T18:14:00Z').getTime();

export function getMoonPhase(date) {
  const diff = date.getTime() - REF_NEW_MOON;
  const days = diff / (1000 * 60 * 60 * 24);
  const cycles = days / LUNAR_CYCLE;
  const phase = cycles - Math.floor(cycles); // 0-1 through the cycle

  // Illumination: 0 at new, 1 at full, 0 at new again
  const illumination = Math.round((1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100);

  let name;
  if (phase < 0.0625)      name = 'New Moon';
  else if (phase < 0.1875) name = 'Waxing Crescent';
  else if (phase < 0.3125) name = 'First Quarter';
  else if (phase < 0.4375) name = 'Waxing Gibbous';
  else if (phase < 0.5625) name = 'Full Moon';
  else if (phase < 0.6875) name = 'Waning Gibbous';
  else if (phase < 0.8125) name = 'Last Quarter';
  else if (phase < 0.9375) name = 'Waning Crescent';
  else                     name = 'New Moon';

  const emoji = phase < 0.125 ? '🌑' : phase < 0.25 ? '🌒' : phase < 0.375 ? '🌓' :
    phase < 0.5 ? '🌔' : phase < 0.625 ? '🌕' : phase < 0.75 ? '🌖' :
    phase < 0.875 ? '🌗' : '🌘';

  return { phase, name, emoji, illumination };
}

// ── Hex Hatch Season Detection ─────────────────────────────────────────────
const HEX_SEASON_START_MONTH = 6;  // June
const HEX_SEASON_START_DAY = 10;
const HEX_SEASON_END_MONTH = 7;    // July
const HEX_SEASON_END_DAY = 20;
const HEX_BUILDUP_START_DAY = 1;   // June 1 = buildup phase

export function getHexSeasonPhase(date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);

  // Season start/end as day-of-year for comparison
  const startDOY = Math.floor((new Date(date.getFullYear(), HEX_SEASON_START_MONTH - 1, HEX_SEASON_START_DAY) - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const endDOY = Math.floor((new Date(date.getFullYear(), HEX_SEASON_END_MONTH - 1, HEX_SEASON_END_DAY) - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const buildupDOY = Math.floor((new Date(date.getFullYear(), HEX_SEASON_START_MONTH - 1, HEX_BUILDUP_START_DAY) - new Date(date.getFullYear(), 0, 0)) / 86400000);

  if (dayOfYear >= startDOY && dayOfYear <= endDOY) {
    return 'active';
  } else if (m === 6 && d >= HEX_BUILDUP_START_DAY && d < HEX_SEASON_START_DAY) {
    return 'building';
  } else if (m === 7 && d > HEX_SEASON_END_DAY && d <= 31) {
    return 'winding_down';
  } else {
    return 'dormant';
  }
}

// ── Days Until Hex Season ──────────────────────────────────────────────────
export function daysUntilHex(date) {
  const year = date.getFullYear();
  const hexStart = new Date(year, HEX_SEASON_START_MONTH - 1, HEX_SEASON_START_DAY);
  if (date > hexStart) {
    // Already past this year's start
    const nextYear = new Date(year + 1, HEX_SEASON_START_MONTH - 1, HEX_SEASON_START_DAY);
    return Math.ceil((nextYear - date) / 86400000);
  }
  return Math.ceil((hexStart - date) / 86400000);
}

// ── Hex Probability Score (0-100) ──────────────────────────────────────────
// Inputs: waterTempF, airTempF (at sunset), windMph, moonIllum (0-100), 
//         date (for season timing), cloudCover ('clear','cloudy','overcast','rain')
export function calculateHexScore({
  waterTempF = null,
  airTempAtSunset = null,
  windMph = null,
  moonIllumination = 50,
  date = new Date(),
  cloudCover = null,
  flowPct = null,
}) {
  const phase = getHexSeasonPhase(date);
  if (phase === 'dormant') return { score: 0, phase, components: {}, verdict: 'dormant' };

  const components = {};

  // 1. Water Temperature (0-30 pts)
  // Hex nymphs emerge when water hits 62-68°F. Peak at 65°F.
  if (waterTempF !== null) {
    if (waterTempF < 55) components.waterTemp = { pts: 0, label: `${waterTempF}°F: too cold`, status: 'bad' };
    else if (waterTempF < 60) components.waterTemp = { pts: 8, label: `${waterTempF}°F: approaching`, status: 'building' };
    else if (waterTempF < 62) components.waterTemp = { pts: 18, label: `${waterTempF}°F: nearly there`, status: 'close' };
    else if (waterTempF <= 68) components.waterTemp = { pts: 30, label: `${waterTempF}°F: prime hex range`, status: 'prime' };
    else if (waterTempF <= 72) components.waterTemp = { pts: 22, label: `${waterTempF}°F: warm, still possible`, status: 'ok' };
    else components.waterTemp = { pts: 5, label: `${waterTempF}°F: too warm`, status: 'bad' };
  } else {
    components.waterTemp = { pts: 10, label: 'No temp data', status: 'unknown' };
  }

  // 2. Air Temperature at sunset (0-15 pts)
  if (airTempAtSunset !== null) {
    if (airTempAtSunset < 55) components.airTemp = { pts: 2, label: `${airTempAtSunset}°F air: chilly`, status: 'bad' };
    else if (airTempAtSunset < 60) components.airTemp = { pts: 8, label: `${airTempAtSunset}°F air: cool`, status: 'ok' };
    else if (airTempAtSunset < 70) components.airTemp = { pts: 15, label: `${airTempAtSunset}°F air: ideal`, status: 'prime' };
    else if (airTempAtSunset < 80) components.airTemp = { pts: 12, label: `${airTempAtSunset}°F air: warm`, status: 'ok' };
    else components.airTemp = { pts: 6, label: `${airTempAtSunset}°F air: hot`, status: 'ok' };
  } else {
    components.airTemp = { pts: 7, label: 'No forecast', status: 'unknown' };
  }

  // 3. Wind (0-20 pts)
  // Hex are large flies; they can emerge in moderate wind but
  // the fishing is dramatically better in calm conditions
  if (windMph !== null) {
    if (windMph <= 3) components.wind = { pts: 20, label: `${windMph} mph: dead calm`, status: 'prime' };
    else if (windMph <= 7) components.wind = { pts: 15, label: `${windMph} mph: light`, status: 'ok' };
    else if (windMph <= 12) components.wind = { pts: 8, label: `${windMph} mph: moderate`, status: 'fair' };
    else if (windMph <= 18) components.wind = { pts: 3, label: `${windMph} mph: windy`, status: 'bad' };
    else components.wind = { pts: 0, label: `${windMph} mph: too windy`, status: 'bad' };
  } else {
    components.wind = { pts: 10, label: 'No wind data', status: 'unknown' };
  }

  // 4. Moon Phase (0-15 pts)
  // Darker nights = better hex fishing. Full moon = fish can see too well,
  // they get pickier, and emergence may be suppressed.
  const moonPts = Math.round(15 * (1 - moonIllumination / 100));
  const moonStatus = moonIllumination < 30 ? 'prime' : moonIllumination < 60 ? 'ok' : 'bad';
  components.moon = { pts: moonPts, label: `${moonIllumination}% illuminated`, status: moonStatus };

  // 5. Season Timing (0-10 pts)
  // Peak probability late June
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if (phase === 'building') components.season = { pts: 3, label: 'Pre-season buildup', status: 'building' };
  else if (phase === 'winding_down') components.season = { pts: 4, label: 'Winding down', status: 'fair' };
  else if (m === 6 && d >= 20 && d <= 30) components.season = { pts: 10, label: 'Peak hex window', status: 'prime' };
  else if (m === 6 && d >= 15) components.season = { pts: 8, label: 'Early hex season', status: 'ok' };
  else if (m === 7 && d <= 10) components.season = { pts: 8, label: 'Mid-season', status: 'ok' };
  else components.season = { pts: 5, label: 'Late season', status: 'fair' };

  // 6. Flow / Recent conditions (0-10 pts)
  if (flowPct !== null) {
    if (flowPct >= 50 && flowPct <= 120) components.flow = { pts: 10, label: `${flowPct}% of median: ideal`, status: 'prime' };
    else if (flowPct < 50) components.flow = { pts: 5, label: `${flowPct}% of median: low`, status: 'fair' };
    else if (flowPct <= 180) components.flow = { pts: 6, label: `${flowPct}% of median: elevated`, status: 'fair' };
    else components.flow = { pts: 2, label: `${flowPct}% of median: high water`, status: 'bad' };
  } else {
    components.flow = { pts: 5, label: 'No flow data', status: 'unknown' };
  }

  // Total score
  const score = Object.values(components).reduce((sum, c) => sum + c.pts, 0);

  // Verdict
  let verdict, message;
  if (phase === 'building') {
    verdict = 'building';
    message = waterTempF && waterTempF >= 58
      ? `Water temp at ${waterTempF}°F and climbing. The hex are getting restless. Could pop any night now.`
      : `Still building toward emergence temperature. The magic number is 62°F.`;
  } else if (score >= 80) {
    verdict = 'tonight';
    message = 'All conditions aligned. This is a hex night. Be on the water by 9 PM. Fish extended-body duns in the dark to the sound of slurping browns.';
  } else if (score >= 60) {
    verdict = 'likely';
    message = 'Strong probability tonight. Hex should emerge. Get there early and stake out your spot.';
  } else if (score >= 40) {
    verdict = 'possible';
    message = 'Conditions are marginal. Hex may emerge in scattered numbers. Worth a trip if you are nearby.';
  } else if (score >= 20) {
    verdict = 'unlikely';
    message = 'Conditions are not favorable. Hex emergence unlikely tonight. Check back tomorrow.';
  } else {
    verdict = 'no';
    message = phase === 'winding_down'
      ? 'Hex season winding down. Sulphurs and tricos are taking over the evening hatch.'
      : 'Conditions are well below hex emergence thresholds.';
  }

  return { score, phase, components, verdict, message };
}

// ── Hex Emergence Window Estimate ──────────────────────────────────────────
export function estimateHexWindow(sunsetTime, waterTempF) {
  // Hex emerge after dark. Warmer = later start. Cooler = earlier.
  // Typical: 30 min after sunset (cool nights) to 90 min after (warm nights)
  if (!sunsetTime) return null;

  const sunsetMin = typeof sunsetTime === 'number' ? sunsetTime : null;
  if (sunsetMin === null) return null;

  let offsetMin;
  if (waterTempF && waterTempF >= 68) offsetMin = 75; // Very warm: late start
  else if (waterTempF && waterTempF >= 64) offsetMin = 50; // Prime: moderate
  else offsetMin = 30; // Cooler: earlier start

  const startMin = sunsetMin + offsetMin;
  const peakMin = startMin + 30;
  const endMin = peakMin + 60;

  const fmt = (mins) => {
    let h = Math.floor(mins / 60);
    let m = Math.round(mins % 60);
    if (m === 60) { h++; m = 0; }
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  return {
    start: fmt(startMin),
    peak: fmt(peakMin),
    end: fmt(endMin),
    advice: waterTempF >= 64
      ? 'Prime emergence window. Position yourself before the start time. Once you hear the first slurp, the clock is ticking.'
      : 'Earlier emergence expected in cooler water. Hex may be sparse. Be patient and listen.',
  };
}

// ── Build Full Hex Report ──────────────────────────────────────────────────
export function buildHexReport({
  waterTempF = null,
  airTempAtSunset = null,
  windMph = null,
  cloudCover = null,
  flowPct = null,
  lat = 44.66,      // AuSable default
  lon = -84.13,
  date = new Date(),
}) {
  const moon = getMoonPhase(date);
  const sun = calcSunTimes(lat, lon, date);
  const phase = getHexSeasonPhase(date);

  const hexScore = calculateHexScore({
    waterTempF,
    airTempAtSunset,
    windMph,
    moonIllumination: moon.illumination,
    date,
    cloudCover,
    flowPct,
  });

  const hexWindow = (phase === 'active' || phase === 'building')
    ? estimateHexWindow(sun.sunsetMin, waterTempF)
    : null;

  return {
    ...hexScore,
    moon,
    sun: {
      sunrise: sun.sunrise,
      sunset: sun.sunset,
      dayLength: sun.dayLength,
      sunsetMin: sun.sunsetMin,
    },
    hexWindow,
    daysUntil: phase === 'dormant' ? daysUntilHex(date) : 0,
    waterTempF,
    date: date.toISOString().slice(0, 10),
  };
}
