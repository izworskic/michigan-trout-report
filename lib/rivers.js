// Michigan Trout Rivers — USGS gauge definitions
// parameterCd: 00060 = discharge (cfs), 00010 = water temp (°C), 00065 = gage height (ft)

export const RIVERS = [
  {
    id: 'ausable',
    name: 'AuSable River',
    region: 'Northeast Lower Michigan',
    notes: 'Holy Water stretch between Grayling and Mio. Premier wild trout fishery in the Midwest.',
    primaryGauge: '04136500',
    gauges: [
      { id: '04135800', name: 'North Branch at Lovells' },
      { id: '04135700', name: 'South Branch near Luzerne' },
      { id: '04136900', name: 'Main Branch near McKinley' },
      { id: '04136500', name: 'Main Branch at Mio' },
      { id: '04137005', name: 'Main Branch near Curtisville' },
      { id: '041377255', name: 'Main Branch near Oscoda' },
    ],
  },
  {
    id: 'manistee',
    name: 'Manistee River',
    region: 'Northwest Lower Michigan',
    notes: 'Headwaters near Grayling, excellent brown trout and steelhead in lower sections.',
    primaryGauge: '04123500',
    gauges: [
      { id: '04123500', name: 'Near Grayling (upper)' },
      { id: '04124000', name: 'Near Sherman (mid)' },
      { id: '04125550', name: 'Near Wellston (lower)' },
    ],
  },
  {
    id: 'pere-marquette',
    name: 'Pere Marquette River',
    region: 'West-Central Lower Michigan',
    notes: 'Wild and Scenic designated. Premier steelhead and brown trout river.',
    primaryGauge: '04122500',
    gauges: [
      { id: '04122500', name: 'At Scottville' },
    ],
  },
  {
    id: 'muskegon',
    name: 'Muskegon River',
    region: 'West-Central Lower Michigan',
    notes: 'Tailwater fishery below Croton Dam. Year-round trout and steelhead.',
    primaryGauge: '04121970',
    gauges: [
      { id: '04121650', name: 'At Big Rapids (upper)' },
      { id: '04121970', name: 'Near Croton (lower/tailwater)' },
    ],
  },
  {
    id: 'boardman',
    name: 'Boardman River',
    region: 'Northwest Lower Michigan',
    notes: 'Flows through Traverse City. Quality wild brown trout fishery.',
    primaryGauge: '04127200',
    gauges: [
      { id: '04126970', name: 'Above Brown Bridge Rd near Mayfield' },
      { id: '04127200', name: 'At Beitner Rd near Traverse City' },
    ],
  },
  {
    id: 'jordan',
    name: 'Jordan River',
    region: 'Northern Lower Michigan',
    notes: "Michigan's first Natural River. Cold, clear, excellent brook trout.",
    primaryGauge: '04127800',
    gauges: [
      { id: '04127800', name: 'Near East Jordan' },
    ],
  },
  {
    id: 'pigeon',
    name: 'Pigeon River',
    region: 'Northern Lower Michigan',
    notes: 'Pigeon River Country State Forest. Wild brook and brown trout.',
    primaryGauge: '04128990',
    gauges: [
      { id: '04128990', name: 'Near Vanderbilt' },
    ],
  },
  {
    id: 'rifle',
    name: 'Rifle River',
    region: 'Northeast Lower Michigan',
    notes: 'Classic Lower Peninsula trout stream. Brown trout and steelhead.',
    primaryGauge: '04142000',
    gauges: [
      { id: '04142000', name: 'Near Sterling' },
    ],
  },
  {
    id: 'little-manistee',
    name: 'Little Manistee River',
    region: 'Northwest Lower Michigan',
    notes: 'Top steelhead river in Michigan. Wild strain steelhead stocking source.',
    primaryGauge: '04126195',
    gauges: [
      { id: '04126195', name: 'At Nine Mile Bridge near Freesoil' },
    ],
  },
];

// All unique gauge IDs across all rivers
export const ALL_GAUGE_IDS = [...new Set(
  RIVERS.flatMap(r => r.gauges.map(g => g.id))
)];
