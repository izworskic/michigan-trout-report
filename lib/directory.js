// Michigan Trout Report — Outfitter Directory
//
// ADDING A PAID LISTING:
//   1. Duplicate a featured entry below
//   2. Set featured: true and paidThrough to their renewal date
//   3. Fill in all fields
//   4. Deploy (git push → auto-deploy)
//
// Featured = $99/year. Basic = free (no logo, no description, link only).

export const DIRECTORY = [

  // ── FEATURED LISTINGS ($99/year) ─────────────────────────────────────────

  {
    id: 'gates-ausable-lodge',
    name: 'Gates Au Sable Lodge',
    featured: true,
    paidThrough: '2027-01-01',
    rivers: ['ausable'],
    county: 'Crawford County',
    region: 'NLP',
    tagline: 'The original AuSable fly fishing lodge. On the Holy Water since 1938.',
    description: 'Gates Au Sable Lodge sits directly on the Holy Water stretch of the AuSable River near Grayling. Guided float and wade trips, fly shop, lodging, and daily fishing reports. Home of the legendary Hex hatch season.',
    phone: '(989) 348-8462',
    website: 'https://gatesausablelodge.com',
    reportUrl: 'https://gatesausablelodge.com/fishing-report/',
    species: ['brown', 'rainbow'],
    services: ['Guided wade trips', 'Float trips', 'Fly shop', 'Lodging'],
    logo: null,
  },
  {
    id: 'little-forks-outfitters',
    name: 'Little Forks Outfitters',
    featured: true,
    paidThrough: '2027-01-01',
    rivers: ['manistee', 'little-manistee', 'pine-river'],
    county: 'Wexford County',
    region: 'NLP',
    tagline: 'Northwest Michigan fly fishing specialists since 1995.',
    description: 'Little Forks Outfitters in Mesick is the go-to shop for Manistee River, Little Manistee, and Pine River fishing. Guided trips, full fly shop, and one of the best fishing reports in the region.',
    phone: '(231) 885-3008',
    website: 'https://littleforksoutfitters.com',
    reportUrl: 'https://littleforksoutfitters.com/fishing-reports/',
    species: ['brown', 'rainbow', 'steelhead'],
    services: ['Guided wade trips', 'Float trips', 'Fly shop', 'Classes'],
    logo: null,
  },
  {
    id: 'schultz-outfitters',
    name: 'Schultz Outfitters',
    featured: true,
    paidThrough: '2027-01-01',
    rivers: ['pere-marquette', 'muskegon', 'little-manistee'],
    county: 'Washtenaw County (guides statewide)',
    region: 'NLP',
    tagline: 'Pere Marquette and West Michigan specialists.',
    description: 'Schultz Outfitters runs guided trips on the Pere Marquette, Muskegon, and Little Manistee rivers. Known for their steelhead expertise and precise fly fishing instruction. Full online shop.',
    phone: '(734) 662-4916',
    website: 'https://schultzoutfitters.com',
    reportUrl: 'https://schultzoutfitters.com/blogs/news',
    species: ['brown', 'rainbow', 'steelhead'],
    services: ['Guided wade trips', 'Guided drift boat', 'Fly shop', 'Instruction'],
    logo: null,
  },
  {
    id: 'northern-angler',
    name: 'The Northern Angler',
    featured: true,
    paidThrough: '2027-01-01',
    rivers: ['boardman', 'jordan', 'platte-river', 'betsie-river'],
    county: 'Grand Traverse County',
    region: 'NLP',
    tagline: 'Traverse City fly fishing since 1996.',
    description: 'The Northern Angler in Traverse City covers the Boardman, Jordan, Platte, Betsie, and surrounding northwest Michigan rivers. Expert staff, local knowledge, guided trips, and a fly tying program.',
    phone: '(231) 933-4730',
    website: 'https://thenorthernangler.com',
    reportUrl: 'https://thenorthernangler.com/blogs/news',
    species: ['brown', 'brook', 'rainbow', 'steelhead'],
    services: ['Guided wade trips', 'Float trips', 'Fly shop', 'Fly tying classes'],
    logo: null,
  },

  // ── BASIC LISTINGS (free) ─────────────────────────────────────────────────
  // These appear in the directory without logo, description, or spotlight

  {
    id: 'ausable-fly-shop',
    name: 'AuSable Fly Shop',
    featured: false,
    rivers: ['ausable'],
    county: 'Crawford County',
    region: 'NLP',
    website: 'https://ausablefly.com',
    species: ['brown', 'rainbow'],
    services: ['Fly shop', 'Guided trips'],
  },
  {
    id: 'muskegon-river-outfitters',
    name: 'Muskegon River Outfitters',
    featured: false,
    rivers: ['muskegon'],
    county: 'Newaygo County',
    region: 'NLP',
    website: 'https://muskegonriveroutfitters.com',
    species: ['brown', 'rainbow', 'steelhead'],
    services: ['Guided drift boat', 'Fly shop'],
  },
  {
    id: 'rusty-hook',
    name: 'Rusty Hook Fly Fishing',
    featured: false,
    rivers: ['ausable'],
    county: 'Crawford County',
    region: 'NLP',
    website: 'https://rustyhookflyfishing.com',
    species: ['brown', 'rainbow'],
    services: ['Guided trips'],
  },
  {
    id: 'baldwins',
    name: 'Baldwin Bait & Tackle',
    featured: false,
    rivers: ['pere-marquette'],
    county: 'Lake County',
    region: 'NLP',
    website: 'https://baldwinbaitandtackle.com',
    species: ['brown', 'rainbow', 'steelhead'],
    services: ['Tackle shop', 'Local reports'],
  },
  {
    id: 'reel-outdoors',
    name: 'Reel Outdoors',
    featured: false,
    rivers: ['muskegon'],
    county: 'Newaygo County',
    region: 'NLP',
    website: 'https://reeloutdoors.com',
    species: ['brown', 'steelhead'],
    services: ['Guided trips', 'Fly shop'],
  },
];

// Get featured listings for a specific river
export function getFeaturedForRiver(riverId) {
  return DIRECTORY.filter(d => d.featured && d.rivers.includes(riverId));
}

// Get all outfitters for a river
export function getAllForRiver(riverId) {
  return DIRECTORY.filter(d => d.rivers.includes(riverId));
}
