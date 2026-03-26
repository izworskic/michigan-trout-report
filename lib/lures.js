// Michigan Trout Report — Conventional Lure Recommendations
//
// Recommends spinners, crankbaits, soft plastics, and spoons
// based on water temp, flow, clarity, time of year, and species.
//
// NOTE: These are EXCLUDED for gear-restricted / flies-only waters.
// The gearType field on each river controls this.

// gearType values on rivers:
//   'general'        — all gear allowed (bait, lures, flies)
//   'artificial'     — artificial lures and flies only (no bait)
//   'flies_only'     — flies only (no spinning gear)
//   'gear_restricted'— DNR gear restricted (artificial flies only, no scented)
//
// Lure recs show for: 'general' and 'artificial'
// Lure recs HIDDEN for: 'flies_only' and 'gear_restricted'

export const LURE_CATALOG = {

  // ── Inline Spinners ───────────────────────────────────────────────────────
  spinners: [
    {
      name: 'Mepps Aglia',
      sizes: ['#0', '#1', '#2'],
      amazonQuery: 'Mepps Aglia spinner trout',
      colors: {
        clear: ['silver', 'gold'],
        offColor: ['gold', 'copper', 'firetiger'],
        overcast: ['gold', 'black fury'],
        sunny: ['silver', 'rainbow'],
      },
      tempRange: [38, 70],
      flowRange: ['very_low', 'low', 'normal', 'elevated'],
      species: ['brown', 'brook', 'rainbow'],
      notes: 'The gold standard for Michigan trout. Size #1 for small creeks, #2 for bigger water.',
    },
    {
      name: 'Panther Martin',
      sizes: ['1/16 oz', '1/8 oz'],
      amazonQuery: 'Panther Martin spinner trout',
      colors: {
        clear: ['gold', 'silver'],
        offColor: ['gold/red', 'black/gold'],
        overcast: ['gold/orange', 'gold/red'],
        sunny: ['silver/blue', 'gold'],
      },
      tempRange: [38, 70],
      flowRange: ['low', 'normal', 'elevated'],
      species: ['brown', 'brook', 'rainbow'],
      notes: 'Heavy for its size. Gets down in current where Mepps won\'t reach.',
    },
    {
      name: 'Blue Fox Vibrax',
      sizes: ['#0', '#1', '#2'],
      amazonQuery: 'Blue Fox Vibrax spinner trout',
      colors: {
        clear: ['silver/blue', 'gold/black'],
        offColor: ['firetiger', 'gold/fluorescent'],
        overcast: ['firetiger', 'chartreuse'],
        sunny: ['silver', 'rainbow'],
      },
      tempRange: [40, 70],
      flowRange: ['normal', 'elevated', 'high'],
      species: ['brown', 'rainbow', 'steelhead'],
      notes: 'Strong vibration draws fish in off-color water. Good for steelhead in spring.',
    },
    {
      name: 'Rooster Tail',
      sizes: ['1/16 oz', '1/8 oz', '1/4 oz'],
      amazonQuery: 'Rooster Tail spinner trout fishing',
      colors: {
        clear: ['white', 'brown trout'],
        offColor: ['chartreuse', 'firetiger'],
        overcast: ['black', 'brown'],
        sunny: ['white', 'rainbow'],
      },
      tempRange: [42, 68],
      flowRange: ['low', 'normal', 'elevated'],
      species: ['brown', 'brook', 'rainbow'],
      notes: 'Soft hackle tail gives subtle action. Deadly on finicky fish in clear water.',
    },
  ],

  // ── Crankbaits / Rapalas ──────────────────────────────────────────────────
  crankbaits: [
    {
      name: 'Rapala Original Floater',
      sizes: ['F03', 'F05', 'F07'],
      amazonQuery: 'Rapala Original Floater F05 trout',
      colors: {
        clear: ['brown trout', 'rainbow trout', 'silver'],
        offColor: ['firetiger', 'gold', 'perch'],
        overcast: ['gold', 'firetiger', 'black/gold'],
        sunny: ['silver', 'rainbow trout', 'brook trout'],
      },
      tempRange: [45, 68],
      flowRange: ['normal', 'elevated'],
      species: ['brown', 'rainbow'],
      notes: 'The classic. F05 is the Michigan standard. Cast upstream and twitch on the swing.',
    },
    {
      name: 'Rapala Countdown',
      sizes: ['CD03', 'CD05', 'CD07'],
      amazonQuery: 'Rapala Countdown CD05 trout',
      colors: {
        clear: ['brown trout', 'silver', 'rainbow trout'],
        offColor: ['firetiger', 'gold', 'perch'],
        overcast: ['gold', 'firetiger'],
        sunny: ['silver', 'brook trout'],
      },
      tempRange: [40, 65],
      flowRange: ['normal', 'elevated', 'high'],
      species: ['brown', 'rainbow', 'steelhead'],
      notes: 'Sinking version gets down in deeper runs. Count it down to the fish\'s level.',
    },
    {
      name: 'Yo-Zuri Pin\'s Minnow',
      sizes: ['2"', '2.75"'],
      amazonQuery: 'Yo-Zuri Pins Minnow trout',
      colors: {
        clear: ['ghost minnow', 'rainbow trout'],
        offColor: ['gold/black', 'chartreuse'],
        overcast: ['gold/black', 'ayu'],
        sunny: ['ghost minnow', 'silver'],
      },
      tempRange: [45, 65],
      flowRange: ['low', 'normal'],
      species: ['brown', 'rainbow'],
      notes: 'Tight wobble in low water. Excellent when Rapalas are too aggressive.',
    },
    {
      name: 'Rebel Crickhopper',
      sizes: ['1.5"'],
      amazonQuery: 'Rebel Crickhopper trout lure',
      colors: {
        clear: ['grasshopper', 'cricket'],
        offColor: ['grasshopper'],
        overcast: ['cricket', 'grasshopper'],
        sunny: ['grasshopper', 'spring cricket'],
      },
      tempRange: [55, 72],
      flowRange: ['low', 'normal'],
      species: ['brown', 'brook', 'rainbow'],
      notes: 'Summer terrestrial pattern in lure form. Deadly July through September.',
    },
  ],

  // ── Spoons ────────────────────────────────────────────────────────────────
  spoons: [
    {
      name: 'Acme Kastmaster',
      sizes: ['1/8 oz', '1/4 oz'],
      amazonQuery: 'Acme Kastmaster 1/8 oz trout',
      colors: {
        clear: ['gold', 'chrome/neon blue'],
        offColor: ['gold/firetiger', 'chrome/chartreuse'],
        overcast: ['gold', 'chrome/pink'],
        sunny: ['chrome', 'gold'],
      },
      tempRange: [38, 65],
      flowRange: ['normal', 'elevated', 'high'],
      species: ['brown', 'rainbow', 'steelhead'],
      notes: 'Casts a mile and sinks fast. Great for deep pools and steelhead runs.',
    },
    {
      name: 'Thomas Buoyant',
      sizes: ['1/6 oz', '1/4 oz'],
      amazonQuery: 'Thomas Buoyant spoon trout',
      colors: {
        clear: ['gold/red', 'silver'],
        offColor: ['gold/red', 'firetiger'],
        overcast: ['gold/red', 'copper'],
        sunny: ['silver', 'gold/red'],
      },
      tempRange: [40, 65],
      flowRange: ['low', 'normal', 'elevated'],
      species: ['brown', 'brook', 'rainbow'],
      notes: 'Michigan classic. Wobbles without spinning. Excellent in moderate current.',
    },
  ],

  // ── Soft Plastics ─────────────────────────────────────────────────────────
  softPlastics: [
    {
      name: 'Trout Magnet',
      sizes: ['1/64 oz jighead + body'],
      amazonQuery: 'Trout Magnet kit',
      colors: {
        clear: ['white', 'brown', 'pink'],
        offColor: ['chartreuse', 'orange', 'glow'],
        overcast: ['chartreuse', 'white/red'],
        sunny: ['brown', 'natural', 'white'],
      },
      tempRange: [35, 70],
      flowRange: ['very_low', 'low', 'normal'],
      species: ['brown', 'brook', 'rainbow'],
      notes: 'Micro jig. Slow drift through pools. Deadly when nothing else works.',
    },
    {
      name: 'Berkley PowerBait Trout Worm',
      sizes: ['3"'],
      amazonQuery: 'Berkley PowerBait Trout Worm',
      colors: {
        clear: ['natural', 'pumpkinseed'],
        offColor: ['chartreuse', 'pink', 'fluorescent orange'],
        overcast: ['pink', 'chartreuse'],
        sunny: ['natural', 'brown'],
      },
      tempRange: [40, 68],
      flowRange: ['low', 'normal'],
      species: ['brown', 'rainbow'],
      notes: 'Scented soft plastic. Drift under a small float in pools. Not allowed on gear-restricted water.',
    },
  ],
};

// ── Recommendation Engine ───────────────────────────────────────────────────

function getClarity(flowPct, turbidityFNU) {
  if (turbidityFNU !== null) {
    if (turbidityFNU < 5) return 'clear';
    if (turbidityFNU < 15) return 'offColor';
    return 'offColor';
  }
  if (flowPct > 180) return 'offColor';
  if (flowPct > 130) return 'offColor';
  return 'clear';
}

function getSkyCondition(forecast) {
  if (!forecast) return 'overcast';
  const f = forecast.toLowerCase();
  if (f.includes('sunny') || f.includes('clear') || f.includes('fair')) return 'sunny';
  if (f.includes('cloud') || f.includes('overcast') || f.includes('fog')) return 'overcast';
  return 'overcast';
}

function flowLabel(flowPct) {
  if (!flowPct) return 'normal';
  if (flowPct > 200) return 'high';
  if (flowPct > 130) return 'elevated';
  if (flowPct > 80) return 'normal';
  if (flowPct > 50) return 'low';
  return 'very_low';
}

export function buildLureRecommendations({ tempF, flowPct, turbidityFNU, ratingKey, species, forecast, month, gearType }) {
  // No lure recs for restricted waters
  if (gearType === 'flies_only' || gearType === 'gear_restricted') {
    return { allowed: false, reason: 'This water is restricted to artificial flies only. See regulations.', lures: [] };
  }

  const clarity = getClarity(flowPct, turbidityFNU);
  const sky = getSkyCondition(forecast);
  const fl = flowLabel(flowPct);
  const colorKey = sky === 'sunny' ? 'sunny' : clarity === 'offColor' ? 'offColor' : sky === 'overcast' ? 'overcast' : 'clear';

  const allLures = [
    ...LURE_CATALOG.spinners.map(l => ({ ...l, category: 'Spinner' })),
    ...LURE_CATALOG.crankbaits.map(l => ({ ...l, category: 'Crankbait' })),
    ...LURE_CATALOG.spoons.map(l => ({ ...l, category: 'Spoon' })),
    ...LURE_CATALOG.softPlastics.map(l => ({ ...l, category: 'Soft Plastic' })),
  ];

  // Filter: scented plastics not allowed on artificial-only water
  const filtered = gearType === 'artificial'
    ? allLures.filter(l => l.category !== 'Soft Plastic' || !l.notes.includes('Scented'))
    : allLures;

  // Score each lure
  const scored = filtered.map(lure => {
    let score = 0;

    // Temp fit
    if (tempF !== null && tempF >= lure.tempRange[0] && tempF <= lure.tempRange[1]) score += 3;
    else if (tempF !== null) score -= 1;

    // Flow fit
    if (lure.flowRange.includes(fl)) score += 3;
    else score -= 2;

    // Species match
    const speciesMatch = species.filter(s => lure.species.includes(s)).length;
    score += speciesMatch * 2;

    // Season bonus
    if (lure.category === 'Crankbait' && lure.name.includes('Crickhopper') && (month >= 7 && month <= 9)) score += 3;
    if (lure.category === 'Spoon' && fl === 'high') score += 2;
    if (lure.category === 'Spinner' && (fl === 'normal' || fl === 'low')) score += 1;

    // Pick best colors for conditions
    const colors = lure.colors[colorKey] || lure.colors.clear || [];

    return {
      name: lure.name,
      category: lure.category,
      size: lure.sizes[Math.min(1, lure.sizes.length - 1)],
      colors: colors.slice(0, 2),
      amazonQuery: lure.amazonQuery,
      notes: lure.notes,
      score,
    };
  });

  // Sort by score, take top 4
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 4);

  // Build advice string
  let advice = '';
  if (clarity === 'offColor') {
    advice = 'Water is off-color. Go with brighter colors (firetiger, chartreuse, gold) and lures with strong vibration.';
  } else if (clarity === 'clear' && fl === 'low') {
    advice = 'Clear, low water. Downsize your presentation. Natural colors, slower retrieves. Fish may spook easy.';
  } else if (fl === 'high' || fl === 'elevated') {
    advice = 'Higher water. Use heavier lures that hold in the current. Fish the slower edges and eddies.';
  } else if (tempF !== null && tempF < 45) {
    advice = 'Cold water means slow fish. Retrieve slowly. Let the lure swing and hang in the current.';
  } else if (tempF !== null && tempF > 60) {
    advice = 'Warm water. Fish mornings and evenings. Keep fish wet and release quickly.';
  } else {
    advice = 'Good conditions for conventional tackle. Vary your retrieve speed until you find what works.';
  }

  return {
    allowed: true,
    lures: top,
    advice,
    colorNote: `Best colors for ${colorKey === 'offColor' ? 'off-color water' : colorKey + ' conditions'}: ${top[0]?.colors.join(', ') || 'gold, silver'}`,
  };
}
