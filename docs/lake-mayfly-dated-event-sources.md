# Great Lakes dated mayfly source archive — research audit (2026-10-16)

This is an **independent published-source chronology**, not an internal human-reviewed hatch ledger. Sources are linked and dates manually checked against their published statements. Entries are NOT guarantees of scientific species identification, emergence at a particular GPS location, present-year recurrence, or a complete sampling period. Existing `/api/lake-hatch-events` remains the sole human-reviewed event dataset for two monitored regions. Do not mix these sources.

## Dates accepted into archive

| Source entry | Date / exact precision | Lake | Evidence type | What the source actually supports |
| --- | --- | --- | --- | --- |
| Siersma et al., *Journal of Great Lakes Research* | **June 22–24, 2010** | Huron / Tawas | Scientific adult Hexagenia sampling window | Three nights, one of three illuminated shore sites sampled per night, quantified live adult swarm counts. **A range**; do not break into three independently verified events. <https://www.sciencedirect.com/science/article/abs/pii/S0380133014000562> |
| WTVG 13abc local report | **June 9, 2024** | Erie / Port Clinton | Contemporaneous reported mass swarm | June 11 reporting dates mayor's and business owners' Sunday-night swarm experience; town surface accumulation. Not a confirmed lakebed point or scientifically identified genus. <https://www.13abc.com/2024/06/11/mayfly-mayhem-along-lake-erie-shoreline/> |
| Detroit Free Press report syndicated on Yahoo | **June 2, 2024** | Connecting waters / Lake St. Clair Metropark | Contemporaneous shore-swarm news report | Reported fish-fly swarms at Metropark Sunday June 2. Not one of the five lakes, and mayfly genus not determined. <https://www.yahoo.com/news/fish-fly-swarms-arrived-michigan-190541244.html> |
| Detroit Free Press, same report | **June 5, 2024** | Erie / Sterling State Park, Monroe | Contemporaneous shore-swarm news report | Separate campground appearance at Lake Erie's western Michigan shore. The existing Port Clinton atlas area is a **regional grouping only**, not the location of Sterling State Park. <https://www.yahoo.com/news/fish-fly-swarms-arrived-michigan-190541244.html> |
| MayflyNews.net Port Clinton local community index | **June 10, 2021** | Erie / Port Clinton | Community *first sighting* | Earliest reported sighting in that local yearly table, **not a scientifically established hatch onset**. <https://www.mayflynews.net/news.html> |
| Same community index | **June 14, 2022** | Erie | Community first sighting | Same limits |
| Same community index | **June 2, 2023** | Erie | Community first sighting | Same limits |
| Same community index | **June 5, 2024** | Erie | Community first sighting | Same limits |
| Same community index | **June 6, 2025** | Erie | Community first sighting | Same limits |

## Explicitly rejected from date chart

- **Bay of Quinte / Ontario:** Published research documents historical recovery but no verified specific **adult emergence date** found in the considered sources. Not the same as never having mayflies.
- **Chequamegon Bay / St. Louis estuary / Superior:** Benthic nymph sampling indicates habitat but doesn't date an adult swarm. The NWS La Crosse radar archive documents **Mississippi River**, not Lake Superior; do not borrow those dates just because both are in Wisconsin.
- **Northern Green Bay / Michigan:** Historic lakebed surveys do not constitute an adult mass-swarm date; do not extrapolate.
- **Tawas 2010:** 22–24 June is a field-sampling RANGE, not 3 independently sourced hatch dates.
- **Community first observations:** MayflyNews' yearly dates rely on variable opportunistic reporting. They are not true first onset or peaks, and cannot support measured interannual population comparisons or a calibrated 2026 forecast.
- **Generic newspaper publication dates:** Do not convert publication timestamps into event dates. Date must be explicitly linked to reported occurrence or field sampling.
- **Western Erie 2025 radar mentions:** Conflicting weekday/date in syndicated reporting. Omitted until an unambiguous contemporaneous event date can be corroborated.
- **Seasonal June–August strips:** Broad biological context only. Do not infer local monthly peaks from these nine nonrandom published entries.

## Pipeline and safeguards

- `data/published-lake-mayfly-events.js`: readonly source descriptions, explicit event start/end, source type, regional scope, genus certainty, and interpretation limit. No scraped reporter names, exact private coordinates or user submissions.
- `lib/published-lake-history.js`: field whitelist, valid calendar dates, maximal eight-day date span, constrained public HTTPS source hostnames, no future events, unique event IDs, source-type gates, and five-lake/connecting-water separation.
- `api/lake-hatch-history.js`: CDN daily cache, exact validated lake/site filters, no inferred unavailable absence, no external runtime requests.
- `public/lake-hatch-history.js`: year/month source entry cells, click to filter, linked original evidence cards; separate academic/shore-news/community classes. Historic count is number of **source entries**, never swarm magnitude or likelihood.
- Original two NOAA environmental watches, reviewed recent-events ledger and iNaturalist records retain their independent meaning and freshness.

**Next evidence expansion:** locate date-specific field/radar reports for Lake Michigan, Superior, Ontario and then validate scientifically. Do not patch empty areas with manufactured historical timing or numerical scores.
