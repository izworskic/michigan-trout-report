// Separate independent weather and daylight from measured river recommendations.
export function supportsFishingAdvice(c) {
  return c?.evidenceState === 'complete' && ['PRIME','FISHING_WELL','FAIR'].includes(c.ratingKey);
}
export function weatherForEvidence(weather, supported) {
  if (!weather || supported) return weather;
  const period = p => {
    if (!p) return p;
    const {cloud, wind_int, ...raw}=p;
    return raw;
  };
  return {...weather,today:period(weather.today),tonight:period(weather.tonight),week:weather.week?.map(period),hourly:weather.hourly?.map(period),bestWindow:null,flowTrend:null};
}
export function sunForEvidence(sun, supported) {
  if (!sun || supported) return sun;
  return {...sun,goldenMorning:null,goldenEvening:null,spinner:null};
}
