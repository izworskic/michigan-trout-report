// Michigan Trout River — Hatch Chart & Fly Recommendation Knowledge Base
//
// Sourced from: Gates Au Sable Lodge hatch charts, Little Forks,
// Orvis Michigan guides, NRSA entomological data, Michigan DNR fisheries,
// and decades of published AuSable / Michigan trout literature.
//
// Water temperature ranges drive hatch activity more than calendar dates,
// but month provides the seasonal context for emergence timing.

// ── Temperature-based activity zones ──────────────────────────────────────
export function getTempZone(tempF) {
  if (tempF === null) return 'unknown';
  if (tempF < 34)  return 'frozen';     // near-ice, fish comatose
  if (tempF < 40)  return 'ice_cold';   // midge only, slow dead drift
  if (tempF < 46)  return 'cold';       // BWO, midge, stonefly nymphs
  if (tempF < 52)  return 'cool';       // BWO, Hendrickson emerging, nymphs active
  if (tempF < 58)  return 'prime_low';  // Hendrickson, caddis, nymphs fishing great
  if (tempF < 64)  return 'prime';      // Sulphur, caddis, peak trout activity
  if (tempF < 68)  return 'prime_high'; // Sulphur, terrestrials, fish active
  if (tempF < 72)  return 'warm';       // Trico, terrestrials, fish early/late
  return 'hot';                          // thermal stress, C&R caution
}

// ── Michigan hatch calendar ─────────────────────────────────────────────────
// month: 1-12, tempRange: [min°F, max°F], timeOfDay: 'morning'|'midday'|'afternoon'|'evening'|'night'|'all'
export const MICHIGAN_HATCHES = [
  // ── Winter / Pre-season ──
  {
    name: 'Midge',
    latin: 'Chironomidae',
    months: [1,2,3,4,10,11,12],
    tempRange: [34, 55],
    timeOfDay: 'midday',
    patterns: [
      { name: 'Mercury Midge', sizes: [20,22,24], style: 'nymph' },
      { name: 'Zebra Midge', sizes: [20,22,24], style: 'nymph' },
      { name: 'Griffith\'s Gnat', sizes: [20,22], style: 'dry' },
      { name: 'Midge Cluster', sizes: [18,20], style: 'dry' },
    ],
    presentation: 'dead drift nymph under indicator in slow pools and eddies. Fish near bottom.',
    notes: 'Year-round on Michigan rivers. Primary food source in cold water. Size down to 24 in clear conditions.',
  },
  {
    name: 'Little Black Stonefly',
    latin: 'Capniidae / Leuctridae',
    months: [2,3,4],
    tempRange: [36, 46],
    timeOfDay: 'afternoon',
    patterns: [
      { name: 'Little Black Stonefly', sizes: [14,16,18], style: 'dry' },
      { name: 'Black Stonefly Nymph', sizes: [14,16], style: 'nymph' },
    ],
    presentation: 'Dead drift dry along banks where stoneflies crawl out. Nymph close to bottom in riffles.',
    notes: 'Often the first hatch of Michigan trout season. Look for adults crawling on streamside vegetation.',
  },

  // ── Early Spring ──
  {
    name: 'Blue-Winged Olive (Baetis)',
    latin: 'Baetis spp.',
    months: [3,4,5,9,10,11],
    tempRange: [42, 56],
    timeOfDay: 'midday',
    patterns: [
      { name: 'Parachute BWO', sizes: [16,18,20], style: 'dry' },
      { name: 'Sparkle Dun BWO', sizes: [16,18,20], style: 'dry' },
      { name: 'RS2', sizes: [18,20], style: 'emerger' },
      { name: 'Pheasant Tail Nymph', sizes: [16,18,20], style: 'nymph' },
    ],
    presentation: 'Small flies, long fluorocarbon tippet (5X-6X). Rise forms during overcast conditions. Fish emergers just subsurface during heavy hatches.',
    notes: 'Heaviest on cloudy, drizzly days. Spring and fall. Two generations — watch for both early and late season. AuSable, Manistee, Boardman all excellent.',
  },
  {
    name: 'Hendrickson',
    latin: 'Ephemerella subvaria',
    months: [4,5],
    tempRange: [48, 58],
    timeOfDay: 'afternoon',
    patterns: [
      { name: 'Hendrickson Dry', sizes: [12,14], style: 'dry' },
      { name: 'Red Quill', sizes: [12,14], style: 'dry' },
      { name: 'Hendrickson Nymph', sizes: [12,14], style: 'nymph' },
      { name: 'A.K. Best Quill Body', sizes: [12,14], style: 'dry' },
    ],
    presentation: 'Classic dry fly fishing. Fish rise lanes in flat water. Nymph the riffles before hatch. Afternoon emergence, 2-4pm peak.',
    notes: 'The opener hatch on the AuSable. One of Michigan\'s most anticipated. Female (Red Quill) and male (Hendrickson) differ in color — carry both. Spinners fall at dusk.',
  },
  {
    name: 'Early Brown Stonefly',
    latin: 'Rhyacophilidae',
    months: [4,5],
    tempRange: [44, 54],
    timeOfDay: 'morning',
    patterns: [
      { name: 'Elk Hair Caddis (brown)', sizes: [14,16], style: 'dry' },
      { name: 'Hare\'s Ear Nymph', sizes: [12,14], style: 'nymph' },
    ],
    presentation: 'Swing wet fly or nymph in riffles. Adults skitter on surface — try skating a dry.',
    notes: 'Often overlooked but fish actively feed on these.',
  },

  // ── Late Spring ──
  {
    name: 'Grannom Caddis',
    latin: 'Brachycentrus spp.',
    months: [4,5],
    tempRange: [48, 60],
    timeOfDay: 'afternoon',
    patterns: [
      { name: 'Elk Hair Caddis', sizes: [14,16], style: 'dry' },
      { name: 'X-Caddis', sizes: [14,16], style: 'emerger' },
      { name: 'LaFontaine Sparkle Pupa', sizes: [14,16], style: 'emerger' },
      { name: 'Caddis Larva (green)', sizes: [14,16], style: 'nymph' },
    ],
    presentation: 'Skitter the Elk Hair Caddis across the surface. Swing the pupa through riffles on the rise. Fish can be selective — try the X-Caddis in the film.',
    notes: 'Heavy caddis hatches in May on AuSable, Manistee, Pere Marquette. Some of the most explosive surface feeding of the year.',
  },
  {
    name: 'March Brown / Gray Fox',
    latin: 'Maccaffertium vicarium',
    months: [5,6],
    tempRange: [52, 62],
    timeOfDay: 'afternoon',
    patterns: [
      { name: 'March Brown Dry', sizes: [10,12], style: 'dry' },
      { name: 'Gray Fox Parachute', sizes: [10,12,14], style: 'dry' },
      { name: 'March Brown Nymph', sizes: [10,12], style: 'nymph' },
    ],
    presentation: 'Big dry flies. Fish the flat water edges and riffles. Nymph the deeper runs in the morning, switch to dries in the afternoon.',
    notes: 'A big mayfly — exciting takes. Spinner fall can be outstanding in calm conditions.',
  },

  // ── Peak Season ──
  {
    name: 'Sulphur',
    latin: 'Ephemerella dorothea / invaria',
    months: [5,6,7],
    tempRange: [54, 68],
    timeOfDay: 'evening',
    patterns: [
      { name: 'Sulphur Comparadun', sizes: [14,16,18], style: 'dry' },
      { name: 'Sulphur Parachute', sizes: [14,16], style: 'dry' },
      { name: 'Sulphur Sparkle Dun', sizes: [16,18], style: 'emerger' },
      { name: 'Sulphur Nymph', sizes: [14,16], style: 'nymph' },
      { name: 'Sulphur CDC Dun', sizes: [16,18], style: 'dry' },
    ],
    presentation: 'Evening hatch, 7-9pm. Fish rise lanes in flat water. Emerger patterns during heaviest activity. Spinner falls (#16-18 Rusty Spinner) after dark. Long fine tippet (5X-6X). Light presentation critical.',
    notes: 'THE hatch on the AuSable Holy Water. Multi-week season. Fish can become extremely selective. Match size carefully — small is usually right. One of Michigan\'s most important hatches.',
  },
  {
    name: 'American March Brown Spinner',
    latin: 'Maccaffertium vicarium',
    months: [5,6],
    tempRange: [52, 65],
    timeOfDay: 'evening',
    patterns: [
      { name: 'Rusty Spinner', sizes: [10,12], style: 'spinner' },
      { name: 'March Brown Spinner', sizes: [10,12], style: 'spinner' },
    ],
    presentation: 'Spent wing flat on surface. Fish the calm edges. Difficult to see — watch the rises.',
    notes: 'Spinner falls often produce the largest fish of the day.',
  },
  {
    name: 'Light Cahill',
    latin: 'Stenacron interpunctatum',
    months: [6,7],
    tempRange: [56, 68],
    timeOfDay: 'evening',
    patterns: [
      { name: 'Light Cahill', sizes: [14,16], style: 'dry' },
      { name: 'Cream Comparadun', sizes: [14,16], style: 'dry' },
    ],
    presentation: 'Evening dry fly. Fish the flat runs at dusk.',
    notes: 'Reliable mid-season hatch. Cream colored — good match to the natural.',
  },

  // ── The Hex ──────────────────────────────────────────────────────────────
  {
    name: 'Hexagenia (Hex)',
    latin: 'Hexagenia limbata',
    months: [6,7],
    tempRange: [60, 72],
    timeOfDay: 'night',
    patterns: [
      { name: 'Hex Wiggle Nymph', sizes: [4,6], style: 'nymph' },
      { name: 'Extended Body Hex Dun', sizes: [4,6,8], style: 'dry' },
      { name: 'Para-Hex', sizes: [4,6], style: 'dry' },
      { name: 'Hex Spinner', sizes: [4,6], style: 'spinner' },
    ],
    presentation: 'Night fishing. Listen for the "slurp" of big fish. Fish duns on the surface after dark, 10pm-2am. Bring a headlamp but use it sparingly. Wade slowly — fish are right at your feet. Big tippet (3X-4X) for big fish.',
    notes: 'The most celebrated hatch in Michigan fly fishing. Late June on the AuSable Holy Water. Draws anglers from across the country. Brings the largest brown trout to the surface. Emerge in mass on warm, calm evenings. The nymph migration starts earlier — swing a Hex wiggle nymph in deep pools at dusk before the hatch.',
  },

  // ── Summer ──
  {
    name: 'Trico',
    latin: 'Tricorythodes spp.',
    months: [7,8,9],
    tempRange: [58, 72],
    timeOfDay: 'morning',
    patterns: [
      { name: 'CDC Trico Spinner', sizes: [20,22,24], style: 'spinner' },
      { name: 'Trico Dun', sizes: [20,22,24], style: 'dry' },
      { name: 'Poly Wing Trico', sizes: [20,22], style: 'spinner' },
    ],
    presentation: 'Early morning spinner fall, first light to 9am. Tiny flies — 6X tippet minimum, 7X ideal. Long leaders. Sipping rises. Choose a single rising fish and be patient.',
    notes: 'The summer hatch challenge. Tiny flies, technical fishing. Spinner falls produce long feeding sessions. AuSable tailwater stretches especially productive.',
  },
  {
    name: 'Terrestrials',
    latin: 'Beetles, ants, hoppers, crickets',
    months: [6,7,8,9],
    tempRange: [58, 74],
    timeOfDay: 'afternoon',
    patterns: [
      { name: 'Foam Beetle', sizes: [12,14,16], style: 'dry' },
      { name: 'Chernobyl Ant', sizes: [10,12], style: 'dry' },
      { name: 'Dave\'s Hopper', sizes: [8,10,12], style: 'dry' },
      { name: 'Parachute Ant', sizes: [14,16,18], style: 'dry' },
      { name: 'Elk Hair Cricket', sizes: [10,12], style: 'dry' },
    ],
    presentation: 'Fish along grassy banks and undercut banks. Drop fly close to shore. Let it sit — or give a subtle twitch. Hoppers fish best midday in warm weather.',
    notes: 'Summer staple when hatches are absent. Bank fishermen do well with terrestrials. A beetle can save the day.',
  },
  {
    name: 'White Fly',
    latin: 'Ephoron leukon',
    months: [8,9],
    tempRange: [60, 70],
    timeOfDay: 'night',
    patterns: [
      { name: 'White Wulff', sizes: [12,14], style: 'dry' },
      { name: 'White Comparadun', sizes: [14], style: 'dry' },
    ],
    presentation: 'Evening and night. Dense swarms in late August. Fish come to the surface aggressively.',
    notes: 'Late summer event — August on the AuSable. Brief but memorable.',
  },

  // ── Fall ──
  {
    name: 'BWO (Fall)',
    latin: 'Baetis tricaudatus',
    months: [9,10,11],
    tempRange: [42, 56],
    timeOfDay: 'midday',
    patterns: [
      { name: 'Parachute BWO', sizes: [16,18,20], style: 'dry' },
      { name: 'Pheasant Tail Nymph', sizes: [16,18,20], style: 'nymph' },
      { name: 'RS2', sizes: [18,20], style: 'emerger' },
    ],
    presentation: 'Same as spring Baetis — cloudy, cool days. Midday emergence. Long tippet, small flies.',
    notes: 'Fall BWO hatch often overlooked but can be excellent. Coincides with brown trout pre-spawn activity.',
  },
  {
    name: 'Fall Caddis',
    latin: 'Neophylax spp.',
    months: [9,10],
    tempRange: [46, 60],
    timeOfDay: 'afternoon',
    patterns: [
      { name: 'Orange Elk Hair Caddis', sizes: [14,16], style: 'dry' },
      { name: 'LaFontaine Pupa (orange)', sizes: [14,16], style: 'emerger' },
    ],
    presentation: 'Afternoons. Fish the runs and riffles. Skating works well.',
    notes: 'Orange-bodied fall caddis. Brown trout are aggressive in fall — big fish willing to come up.',
  },
];

// ── Flow-based presentation adjustments ─────────────────────────────────────
export function getFlowAdvice(flowPct, ratingKey) {
  if (!flowPct) return null;
  if (flowPct > 250) return {
    summary: 'High and blown out',
    technique: 'Stay off the water. Unsafe wading and near-zero visibility.',
    flies: ['Nothing — unsafe conditions'],
  };
  if (flowPct > 180) return {
    summary: 'Very high and off-color',
    technique: 'Chuck streamers on a sink tip. Work the edges and slower water near banks. Fish are holding tight to structure, not feeding on the surface.',
    flies: ['Olive/white Woolly Bugger #4-6', 'Articulated streamer #2-4', 'Sculpzilla', 'Pine Squirrel Leech'],
  };
  if (flowPct > 140) return {
    summary: 'Running high and likely stained',
    technique: 'High stick nymphs with heavy weight in the slower seams. Streamers on a swing along the banks. Surface feeding unlikely. Fish are closer to the banks than normal.',
    flies: ['Hare\'s Ear Nymph #10-12 with weight', 'Stonefly Nymph #8-10', 'Woolly Bugger #6-8', 'San Juan Worm'],
  };
  if (flowPct > 115) return {
    summary: 'Slightly elevated, clearing',
    technique: 'Nymphs fishing well in the seams. Watch for surface activity as it clears. Match whatever is hatching — fish are feeding but spread out.',
    flies: ['Standard nymphs', 'Whatever is hatching — normal approach'],
  };
  if (flowPct >= 80) return {
    summary: 'Normal flow — textbook conditions',
    technique: 'Standard approach. Match the hatch. Fish spread across the river. Work riffles, seams, and tail-outs.',
    flies: ['Match the hatch for this date and temp'],
  };
  if (flowPct >= 50) return {
    summary: 'Below normal — clear and low',
    technique: 'Long fine tippet (6X). Small flies. Stealth critical — approach from downstream, stay low. Fish are concentrated in deeper pools and undercut banks. Dawn and dusk best.',
    flies: ['Size down 1-2 hooks from normal', 'Parachute Adams #16-18', 'Small nymphs #18-20', 'Terrestrials along banks'],
  };
  return {
    summary: 'Very low and clear',
    technique: 'Extremely technical. 6X-7X tippet. Fish are spooky and holding in the deepest available water. Early morning and evening only. Terrestrials along banks.',
    flies: ['Tiny midges #20-24', 'Ants and beetles', 'Trico spinners'],
  };
}

// ── Time of day advice ───────────────────────────────────────────────────────
export function getTimeAdvice(hour) {
  // hour: 0-23
  if (hour >= 5 && hour < 8)   return { period: 'Early Morning', tip: 'Spinner falls from last night. Midge activity. Trico season: this is it.' };
  if (hour >= 8 && hour < 11)  return { period: 'Morning',       tip: 'Nymph the riffles. Watch for early hatches on cool cloudy days.' };
  if (hour >= 11 && hour < 14) return { period: 'Midday',        tip: 'BWO on overcast days. Terrestrials in summer. Nymph in all conditions.' };
  if (hour >= 14 && hour < 17) return { period: 'Afternoon',     tip: 'Hendrickson and Sulphur nymphs moving. Caddis in May. Best dry fly window building.' };
  if (hour >= 17 && hour < 20) return { period: 'Evening',       tip: 'Prime hatch time. Sulphurs, caddis, March Brown spinners. Be on the water.' };
  if (hour >= 20 && hour < 24) return { period: 'After Dark',    tip: 'Hex season: now. Big streamers for big fish. Bring a headlamp.' };
  return { period: 'Night',                                       tip: 'Hex and White Fly in summer. Otherwise, get some rest.' };
}

// ── Main recommendation function ─────────────────────────────────────────────
export function buildRecommendations(tempF, flowPct, ratingKey, month, hour) {
  const tempZone = getTempZone(tempF);
  const flowAdvice = getFlowAdvice(flowPct, ratingKey);
  const timeAdvice = getTimeAdvice(hour ?? 14); // default to afternoon if unknown

  // Find active hatches for current conditions
  const activeHatches = MICHIGAN_HATCHES.filter(h => {
    const tempOk  = tempF !== null ? (tempF >= h.tempRange[0] && tempF <= h.tempRange[1]) : true;
    const monthOk = month ? h.months.includes(month) : true;
    return tempOk && monthOk;
  });

  // Score by time-of-day relevance
  const todPriority = { morning: 1, midday: 2, afternoon: 3, evening: 4, night: 5, all: 3 };
  const hourGroup = timeAdvice.period.toLowerCase().includes('morning') ? 'morning'
    : timeAdvice.period.toLowerCase().includes('midday') ? 'midday'
    : timeAdvice.period.toLowerCase().includes('afternoon') ? 'afternoon'
    : timeAdvice.period.toLowerCase().includes('evening') ? 'evening'
    : 'night';

  const scored = activeHatches.map(h => ({
    ...h,
    timeMatch: h.timeOfDay === hourGroup || h.timeOfDay === 'all' ? 2 : 1,
  })).sort((a, b) => b.timeMatch - a.timeMatch);

  // Top 3 hatches
  const topHatches = scored.slice(0, 3);

  // Top flies across all active hatches
  const allFlies = topHatches.flatMap(h =>
    h.patterns.map(p => ({ ...p, hatch: h.name }))
  );

  return {
    tempZone,
    tempF,
    flowAdvice,
    timeAdvice,
    activeHatches: topHatches,
    topFlies: allFlies.slice(0, 6),
    month,
    hour,
  };
}
