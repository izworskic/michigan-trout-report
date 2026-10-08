# Michigan Trout Report

Daily Michigan trout stream conditions powered by live USGS data and AI interpretation.

Built by [Chris Izworski](https://chrisizworski.com): Bay City, Michigan.

## Rivers Covered

- **AuSable River**: main branch, North Branch, South Branch
- **Manistee River**: upper through lower
- **Pere Marquette River**
- **Muskegon River**
- **Boardman River**
- **Jordan River**
- **Pigeon River**
- **Rifle River**
- **Little Manistee River**

## Conditions Scale

| Rating | Meaning |
|--------|---------|
| 🎣 **Prime** | Drop everything and go. |
| ✅ **Fishing Well** | Worth the drive. |
| 🟡 **Fair** | Fishable. Pick your spots. |
| 🟠 **Tough** | Fish are off. Long leader, small fly. |
| 🔴 **Blown Out** | Stay home. Fish another day. |

The rating combines flow as a percentage of the station's daily historical median with water-temperature categories. Gauge height, turbidity, and dissolved oxygen are additional observations where available. Ratings are planning heuristics, not USGS recommendations or predictions of catches. The [report methodology](https://michigantroutreport.com/how-to-read-michigan-trout-water/#report-methodology) explains freshness limits, missing inputs, and the AI-written brief.

## Page metadata

Each indexable static page needs its own title, description, and absolute HTTPS canonical. After adding or editing pages, run `npm run metadata:sync`, review and commit the resulting HTML, then run `npm test`. The sync command fills missing social fields from existing editorial values and copies an existing social image when available. It preserves explicit social values, article/profile types, canonical URLs, and page content; it does not invent images or refresh sitemap dates.

The complete test gate and production build reject missing, blank, duplicated, or inconsistent social metadata. Intentional noindex documents are excluded. Dynamic river pages already supply their social metadata in the server-rendered template.

## Stack

- **Vercel**: hosting + daily cron (8am CT)
- **Upstash Redis**: cache (one AI call per day)
- **USGS Water Services API**: free, live stream data
- **Claude Haiku**: daily conditions brief

## Related

- [Freighter View Farms](https://freighterviewfarms.com): Great Lakes gardening blog
- [Great Lakes Gazette](https://gazette.chrisizworski.com): daily maritime newsletter
- [chrisizworski.com](https://chrisizworski.com)
