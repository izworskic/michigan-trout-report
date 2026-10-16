# Great Lakes Hexagenia swarm evidence — editorial review

## Objective

Publish credible, source-linked **past mass-emergence events** for Saginaw Bay
and western Lake Erie while keeping them independent from:
1. NOAA buoy water temperatures and NWS scenario watches, and
2. photo-backed Research Grade **individual specimen** observations in iNaturalist.

Neither warm surface water nor a Research Grade Hexagenia photo verifies a
mass emergence. **Do not say "hatching now"** even for a same-day documented
report. Editorially reviewed events are not independently scientifically
validated lake-wide emergence, nor do they establish nymph population density.

## Intake

Visitors use the public issue form:

https://github.com/izworskic/michigan-trout-report/issues/new?template=lake-mayfly-swarm.yml

It requires a region, event date, approximate public place, event type, and
first-hand evidence link. GitHub authentication may be required; it is not an
anonymous or private submission service. iNaturalist specimen observations
can be submitted independently via https://www.inaturalist.org/observations/upload .

**Privacy:** These issues are public. Ask people never to submit exact GPS,
private addresses, private land locations, contact details, sensitive habitats,
or identifying information about other people. Do not copy observer private
metadata into the published ledger.

## Review checklist

A maintainer/reviewer does each of the following manually:

- [ ] Read the primary public evidence (original dated photograph, original video
      showing *multiple* mayflies, agency-issued mass-swarm/radar interpretation,
      or equivalent documented water-surface emergence). Confirm it is actually
      about mayflies, not midges, mosquitoes, lake flies of another insect
      order, or a single individual. If uncertain, leave unapproved.
- [ ] Separate the **event date** from posting/upload date. Confirm event date,
      year and coarse geographic region. Exact shoreline origin need not be
      known; do not guess or claim it is where nymphs emerged.
- [ ] Verify source link opens, source author/publisher can be credited, and
      evidence summary accurately states what it shows. Radar signatures alone
      need an agency-authorized identification, not our own radar speculation.
- [ ] Reject fabricated, generic, stock, reused, AI-created, wrongly dated,
      unsupported, or unverifiable images. Research Grade specimens alone stay
      in the citizen-science section and do not qualify as mass events.
- [ ] Make sure reviewer is someone other than the original submitter when
      practical. Log the actual GitHub reviewer ID, review date and rationale.
- [ ] Only after manual review, edit **data/approved-hex-events.js** via a
      pull request. Include the issue link in the PR description, but never
      copy private reporter metadata. Mark the issue triaged/resolved manually.
- [ ] Run repository tests; review proposed public source links and exact wording
      of location before merging. Consider a second reviewer for uncertainty.

Reviewers can also reject a report or request more evidence without publishing.
There is deliberately no unauthenticated event-write endpoint or GitHub Issue
auto-publisher.

## Publication data contract

Each reviewed event must include:

| Property | Meaning |
| --- | --- |
| id | unique \`YYYY-MM-DD-saginaw-bay-slug\` or \`YYYY-MM-DD-western-erie-slug\` |
| region | \`saginaw-bay\` or \`western-erie\` |
| eventDate | local date when mass event was observed |
| placeLabel | approximate publicly named location only |
| eventType | \`documented_mass_swarm\`, \`documented_water_emergence\`, or \`agency_radar_report\` |
| evidenceUrl | primary public HTTPS source |
| evidenceSummary | 35–500 chars accurately describing the actual primary evidence |
| sourceAttribution | source publisher/photographer attribution |
| sourceDate | publication date, YYYY-MM-DD |
| reviewedBy | GitHub username of the reviewing human |
| reviewedOn | date the human reviewed evidence |
| reviewNote | 30–500 characters explaining verification and caveats |

**Do not** publish names/handles of the reporter, private coordinates, images,
or unreviewed issues as "approved" events. Input validator rejects fields outside
the schema, duplicate IDs, invalid dates, missing review metadata or unsafe URLs.

The curated ledger is empty at launch. That is intentional. When a validated
record is merged into main, the read-only \`/api/lake-hatch-events?region=...\`
endpoint and public event panel automatically display it (CDN-cache ~1 hour).

## Product statuses

- No reviewed entries → **No reviewed events yet**. Does *not* assert no mayflies.
- Reviewed event within 14 days → **Recently documented event**, with its date.
  It does *not* assert emergence is currently happening.
- Older approved entries → **Past reviewed events**, useful for seasonal context.
- Read/API failure → **Review ledger unavailable**, not a count of zero events.

**Do not change the environment readiness/forecast score** in response to
reported events until a separate back-testing design is implemented and
verified against appropriately historical conditions. Do not silently combine
the iNaturalist specimen count with the curated event count.

## Editorial conflicts and corrections

If a public link is removed, new evidence disproves an identification, or a
date/region was incorrect, remove or correct that event via a new reviewed PR.
The source remains versioned through Git history. Do not keep a withdrawn
claim visible just to maintain a historic chart.

## External sources

- GitHub Issue Forms: https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository
- iNaturalist Research Grade standard:
  https://help.inaturalist.org/en/support/solutions/articles/151000169936
- Michigan Sea Grant Hexagenia field guide:
  https://www.michiganseagrant.org/blog/2024/03/11/when-will-the-mayflies-arrive/
