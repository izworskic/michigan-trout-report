// Editorially curated Great Lakes Hexagenia mass-emergence evidence.
// Reports NEVER enter here automatically from iNaturalist, GitHub Issues,
// anonymous forms, or a weather model. A reviewer adds an event by PR only,
// after the protocol in docs/lake-mayfly-review.md is satisfied.
//
// Schema example (DO NOT publish as a sample event):
// {
//   id: '2027-06-23-western-erie-toledo-swarm',
//   region: 'western-erie',                 // saginaw-bay | western-erie
//   eventDate: '2027-06-23',                // local calendar date of swarm
//   placeLabel: 'Toledo shoreline',         // approximate PUBLIC place only
//   eventType: 'documented_mass_swarm',     // see validation
//   evidenceUrl: 'https://...',             // public primary evidence
//   evidenceSummary: 'Video shows a large airborne mayfly aggregation...',
//   sourceAttribution: 'Name of original publisher or photographer',
//   sourceDate: '2027-06-24',
//   reviewedBy: 'github-username',          // editor making the review
//   reviewedOn: '2027-06-25',
//   reviewNote: 'Link checked; insects identifiable; the group/event is visible.'
// }
// The first release ships with an EMPTY approved ledger; no seeded fakes.
export const APPROVED_HEX_EVENTS = Object.freeze([]);
