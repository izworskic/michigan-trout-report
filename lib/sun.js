// Michigan Trout Report — Sun Times & Spinner Fall Estimator
//
// NOAA simplified solar position algorithm for sunrise/sunset.
// Spinner fall estimates based on sunset time + water temperature.

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/**
 * Calculate sunrise and sunset for a given date and location.
 * Returns times in Eastern Time (UTC-4 EDT or UTC-5 EST).
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees  
 * @param {Date} date - Date to calculate for
 * @returns {{ sunrise: string, sunset: string, dayLength: string, goldenMorning: string, goldenEvening: string }}
 */
export function calcSunTimes(lat, lon, date) {
  // Julian day number
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const JD = 367 * y - Math.floor(7 * (y + Math.floor((m + 9) / 12)) / 4) +
    Math.floor(275 * m / 9) + d + 1721013.5;

  // Julian century
  const T = (JD - 2451545.0) / 36525.0;

  // Solar coordinates
  const L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360;
  const M = (357.52911 + T * (35999.05029 - 0.0001537 * T)) % 360;
  const Mrad = M * RAD;
  const C = (1.914602 - T * (0.004817 + 0.000014 * T)) * Math.sin(Mrad) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad) +
    0.000289 * Math.sin(3 * Mrad);
  const sunLon = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = sunLon - 0.00569 - 0.00478 * Math.sin(omega * RAD);

  // Obliquity
  const e0 = 23.0 + (26.0 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const e = e0 + 0.00256 * Math.cos(omega * RAD);

  // Declination
  const decl = Math.asin(Math.sin(e * RAD) * Math.sin(lambda * RAD)) * DEG;

  // Equation of time (minutes)
  const y2 = Math.tan(e * RAD / 2) ** 2;
  const L0rad = L0 * RAD;
  const ecc = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const EqT = 4 * DEG * (
    y2 * Math.sin(2 * L0rad) -
    2 * ecc * Math.sin(Mrad) +
    4 * ecc * y2 * Math.sin(Mrad) * Math.cos(2 * L0rad) -
    0.5 * y2 * y2 * Math.sin(4 * L0rad) -
    1.25 * ecc * ecc * Math.sin(2 * Mrad)
  );

  // Hour angle for sunrise/sunset (standard: -0.8333 deg for atmospheric refraction)
  const cosHA = (Math.cos(90.833 * RAD) - Math.sin(lat * RAD) * Math.sin(decl * RAD)) /
    (Math.cos(lat * RAD) * Math.cos(decl * RAD));

  if (cosHA > 1) return { sunrise: 'No sunrise', sunset: 'No sunset', dayLength: '0h', goldenMorning: '', goldenEvening: '', spinnerWindow: '' };
  if (cosHA < -1) return { sunrise: 'Midnight sun', sunset: 'Midnight sun', dayLength: '24h', goldenMorning: '', goldenEvening: '', spinnerWindow: '' };

  const HA = Math.acos(cosHA) * DEG;

  // Solar noon in minutes from midnight UTC
  const solarNoon = 720 - 4 * lon - EqT;

  // Sunrise and sunset in minutes from midnight UTC
  const sunriseUTC = solarNoon - HA * 4;
  const sunsetUTC = solarNoon + HA * 4;

  // Convert to Eastern Time (check if DST)
  const isDST = isEasternDST(date);
  const offset = isDST ? -4 : -5; // EDT = UTC-4, EST = UTC-5
  const sunriseET = sunriseUTC + offset * 60;
  const sunsetET = sunsetUTC + offset * 60;

  const fmt = (mins) => {
    let h = Math.floor(mins / 60);
    let m = Math.round(mins % 60);
    if (m === 60) { h++; m = 0; }
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const dayMins = sunsetET - sunriseET;
  const dayH = Math.floor(dayMins / 60);
  const dayM = Math.round(dayMins % 60);

  return {
    sunrise: fmt(sunriseET),
    sunset: fmt(sunsetET),
    sunriseMin: Math.round(sunriseET),
    sunsetMin: Math.round(sunsetET),
    dayLength: `${dayH}h ${dayM}m`,
    goldenMorning: `${fmt(sunriseET - 30)} to ${fmt(sunriseET + 60)}`,
    goldenEvening: `${fmt(sunsetET - 90)} to ${fmt(sunsetET)}`,
  };
}

/**
 * Estimate spinner fall timing based on sunset and water temperature.
 * Spinners are mayfly adults that fall to the water to lay eggs, typically at dusk.
 * @param {number} sunsetMin - Sunset time in minutes from midnight ET
 * @param {number|null} waterTempF - Current water temperature in Fahrenheit
 * @returns {{ start: string, peak: string, advice: string }}
 */
export function estimateSpinnerFall(sunsetMin, waterTempF) {
  const fmt = (mins) => {
    let h = Math.floor(mins / 60);
    let m = Math.round(mins % 60);
    if (m === 60) { h++; m = 0; }
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  // Spinner fall timing depends on temperature
  // Warm water (>65F): spinners fall close to dark, 15-30 min before sunset
  // Moderate (55-65F): 30-60 min before sunset
  // Cold (<55F): 60-90 min before sunset (or may not happen)
  // Very cold (<45F): unlikely spinner activity

  if (waterTempF !== null && waterTempF < 45) {
    return {
      start: null,
      peak: null,
      advice: 'Water too cold for significant spinner activity. Focus on nymphs.',
    };
  }

  let offsetMin;
  let description;

  if (waterTempF === null) {
    // No temp data: use seasonal estimate based on month
    const month = new Date().getMonth() + 1; // 1-12
    if (month <= 4 || month >= 11) {
      // Nov-Apr: cold water, likely no spinners
      offsetMin = 75;
      description = 'No water temp data. Early/late season: expect spinners well before sunset if at all. Focus on nymphs.';
    } else if (month >= 6 && month <= 8) {
      // Jun-Aug: warm
      offsetMin = 25;
      description = 'No water temp data. Summer evenings typically bring spinners 20 to 40 minutes before dark.';
    } else {
      // May, Sep-Oct: moderate
      offsetMin = 45;
      description = 'No water temp data. Shoulder season: spinners typically start 30 to 60 minutes before sunset.';
    }
  } else if (waterTempF >= 65) {
    offsetMin = 20;
    description = 'Warm water pushes spinners close to dark. Fish the last 30 minutes of light.';
  } else if (waterTempF >= 55) {
    offsetMin = 45;
    description = 'Moderate temps bring spinners 30 to 60 minutes before sunset. Best window of the day for surface takes.';
  } else {
    offsetMin = 75;
    description = 'Cool water triggers early spinner falls. Start watching an hour before sunset.';
  }

  const startMin = sunsetMin - offsetMin - 15;
  const peakMin = sunsetMin - offsetMin + 10;

  return {
    start: fmt(startMin),
    peak: fmt(peakMin),
    advice: description,
  };
}

// Simple Eastern DST check (second Sunday March to first Sunday November)
function isEasternDST(date) {
  const y = date.getFullYear();
  const mar = new Date(y, 2, 1);
  const marchSecondSunday = 8 + (7 - mar.getDay()) % 7;
  const nov = new Date(y, 10, 1);
  const novFirstSunday = 1 + (7 - nov.getDay()) % 7;
  const dstStart = new Date(y, 2, marchSecondSunday, 2);
  const dstEnd = new Date(y, 10, novFirstSunday, 2);
  return date >= dstStart && date < dstEnd;
}
