// Michigan Trout Report — Conditions Rater
//
// Five-level scale in trout fishing lingo:
//
//  PRIME        — Textbook conditions. Drop everything and go.
//  FISHING WELL — Worth the drive. Above average day.
//  FAIR         — Fishable. Pick your spots, refine your presentation.
//  TOUGH        — Fish are off. High water, thermal stress, or cold snap.
//  BLOWN OUT    — Stay home. Unfishable or unsafe conditions.

export const RATINGS = {
  PRIME:        { label: 'Prime',        emoji: '🎣', color: '#2e7d32', tagline: 'Drop everything and go.' },
  FISHING_WELL: { label: 'Fishing Well', emoji: '✅', color: '#558b2f', tagline: 'Worth the drive.' },
  FAIR:         { label: 'Fair',         emoji: '🟡', color: '#f9a825', tagline: 'Fishable. Pick your spots.' },
  TOUGH:        { label: 'Tough',        emoji: '🟠', color: '#e65100', tagline: 'Fish are off. Long leader, small fly.' },
  BLOWN_OUT:    { label: 'Blown Out',    emoji: '🔴', color: '#b71c1c', tagline: 'Stay home. Fish another day.' },
};

// Convert Celsius to Fahrenheit
function cToF(c) { return c === null ? null : Math.round(c * 9/5 + 32); }

// Flow condition based on % of seasonal median
function flowCondition(flowCfs, stats) {
  if (flowCfs === null || flowCfs === undefined) return 'unknown';
  if (!stats?.p50) return 'unknown';
  const pct = (flowCfs / stats.p50) * 100;
  if (pct > 300) return 'blown_out';
  if (pct > 200) return 'very_high';
  if (pct > 150) return 'high';
  if (pct > 120) return 'elevated';
  if (pct > 80)  return 'normal';
  if (pct > 50)  return 'low';
  return 'very_low';
}

// Temp condition for trout
function tempCondition(tempC) {
  if (tempC === null) return 'unknown';
  const f = cToF(tempC);
  if (f < 33)  return 'frozen';    // at or near ice
  if (f < 38)  return 'ice_cold';  // lethargic fish
  if (f < 44)  return 'cold';      // slow but fishable
  if (f < 52)  return 'cool';      // fish waking up, good
  if (f < 65)  return 'prime';     // sweet spot
  if (f < 70)  return 'warm';      // fish stressed
  return 'hot';                     // thermal stress / C&R concern
}

// Combined rating
export function rateConditions(flow, stats, tempC) {
  const fc = flowCondition(flow, stats);
  const tc = tempCondition(tempC);

  // Blown out — flow overrides everything
  if (fc === 'blown_out') return 'BLOWN_OUT';
  if (fc === 'very_high' && (tc === 'frozen' || tc === 'ice_cold')) return 'BLOWN_OUT';

  // Very high flow
  if (fc === 'very_high') return 'TOUGH';

  // High flow
  if (fc === 'high') {
    if (tc === 'prime' || tc === 'cool') return 'FAIR';
    return 'TOUGH';
  }

  // Elevated flow
  if (fc === 'elevated') {
    if (tc === 'prime') return 'FISHING_WELL';
    if (tc === 'cool')  return 'FISHING_WELL';
    if (tc === 'cold')  return 'FAIR';
    if (tc === 'warm' || tc === 'hot') return 'FAIR';
    return 'FAIR';
  }

  // Normal flow — the bread and butter
  if (fc === 'normal') {
    if (tc === 'prime')    return 'PRIME';
    if (tc === 'cool')     return 'PRIME';
    if (tc === 'cold')     return 'FISHING_WELL';
    if (tc === 'ice_cold') return 'TOUGH';
    if (tc === 'frozen')   return 'BLOWN_OUT';
    if (tc === 'warm')     return 'FISHING_WELL';
    if (tc === 'hot')      return 'FAIR';
    return 'FISHING_WELL'; // unknown temp with normal flow
  }

  // Low flow
  if (fc === 'low') {
    if (tc === 'prime')    return 'FISHING_WELL'; // low clear water needs stealth
    if (tc === 'cool')     return 'FISHING_WELL';
    if (tc === 'cold')     return 'FAIR';
    if (tc === 'ice_cold') return 'TOUGH';
    if (tc === 'frozen')   return 'BLOWN_OUT';
    if (tc === 'warm')     return 'FAIR';
    if (tc === 'hot')      return 'TOUGH';
    return 'FAIR';
  }

  // Very low
  if (fc === 'very_low') {
    if (tc === 'prime' || tc === 'cool') return 'FAIR';
    return 'TOUGH';
  }

  // Unknown flow — lean on temp
  if (tc === 'prime' || tc === 'cool') return 'FISHING_WELL';
  if (tc === 'cold')  return 'FAIR';
  if (tc === 'hot' || tc === 'warm') return 'FAIR';
  return 'FAIR';
}

// Build full conditions object for a gauge reading
export function buildConditions(reading, stats) {
  const flow    = reading?.flow;
  const tempC   = reading?.temp_c;
  const tempF   = cToF(tempC);
  const gage    = reading?.gage;
  const turbidity = reading?.turbidity_fnu ?? null;
  const do_mgl    = reading?.do_mgl ?? null;
  const ratingKey = rateConditions(flow, stats, tempC);
  const rating    = RATINGS[ratingKey];

  let flowPct = null;
  let flowLabel = 'Unknown';
  if (flow !== null && stats?.p50) {
    flowPct = Math.round((flow / stats.p50) * 100);
    if (flowPct > 300)      flowLabel = 'Way above normal';
    else if (flowPct > 200) flowLabel = 'Very high';
    else if (flowPct > 150) flowLabel = 'High';
    else if (flowPct > 120) flowLabel = 'Above normal';
    else if (flowPct > 80)  flowLabel = 'Normal';
    else if (flowPct > 50)  flowLabel = 'Below normal';
    else                    flowLabel = 'Very low';
  }

  let tempLabel = 'Unknown';
  if (tempF !== null) {
    if (tempF < 33)       tempLabel = 'Near freezing';
    else if (tempF < 38)  tempLabel = 'Ice cold — fish lethargic';
    else if (tempF < 44)  tempLabel = 'Cold';
    else if (tempF < 52)  tempLabel = 'Cool — fish waking up';
    else if (tempF < 65)  tempLabel = 'Prime range';
    else if (tempF < 70)  tempLabel = 'Warm — fish stressed';
    else                  tempLabel = 'Too warm — C&R caution';
  }

  // Turbidity interpretation (FNU)
  let turbidityLabel = null;
  let turbidityNote  = null;
  if (turbidity !== null) {
    if (turbidity < 1)       { turbidityLabel = 'Crystal clear';      turbidityNote = 'Exceptional visibility. Small flies, fine tippet, maximum stealth.'; }
    else if (turbidity < 5)  { turbidityLabel = 'Clear';              turbidityNote = 'Excellent visibility. Standard presentation.'; }
    else if (turbidity < 12) { turbidityLabel = 'Slightly off-color'; turbidityNote = 'Minor tint. Fish still feeding well. Can go slightly larger on flies.'; }
    else if (turbidity < 25) { turbidityLabel = 'Turbid';             turbidityNote = 'Reduced visibility. Switch to larger, darker flies. Streamers and egg patterns effective.'; }
    else if (turbidity < 50) { turbidityLabel = 'Muddy';              turbidityNote = 'Poor visibility. Fish tight to banks in slower water. Bright attractor patterns only.'; }
    else                     { turbidityLabel = 'Very muddy';         turbidityNote = 'Difficult conditions. Consider other water.'; }
  }

  // Dissolved oxygen interpretation (mg/L)
  let doLabel = null;
  let doNote  = null;
  if (do_mgl !== null) {
    if (do_mgl >= 12)        { doLabel = 'Excellent'; doNote = 'Highly oxygenated water. Fish are active and feeding.'; }
    else if (do_mgl >= 9)    { doLabel = 'Good';      doNote = 'Good oxygen levels. Normal fish activity.'; }
    else if (do_mgl >= 7)    { doLabel = 'Adequate';  doNote = 'Acceptable oxygen. Fish may be less active.'; }
    else if (do_mgl >= 5)    { doLabel = 'Low';       doNote = 'Low oxygen. Fish stressed, feeding reduced.'; }
    else                     { doLabel = 'Very low';  doNote = 'Critically low oxygen. Avoid fishing — fish health at risk.'; }
  }

  return {
    ratingKey,
    rating,
    flow: flow !== null ? Math.round(flow) : null,
    flowPct,
    flowLabel,
    tempC,
    tempF,
    tempLabel,
    gage: gage !== null && gage !== undefined ? Math.round(gage * 100) / 100 : null,
    turbidity_fnu: turbidity,
    turbidityLabel,
    turbidityNote,
    do_mgl: do_mgl !== null ? Math.round(do_mgl * 10) / 10 : null,
    doLabel,
    doNote,
    stats: stats ? { p25: stats.p25, p50: stats.p50, p75: stats.p75 } : null,
    timestamp: reading?.timestamp || null,
  };
}
