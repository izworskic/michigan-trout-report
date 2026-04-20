# Michigan Trout Report

Daily Michigan trout stream conditions powered by live USGS data and AI interpretation.

Built by [Chris Izworski](https://chrisizworski.com) — Bay City, Michigan.

## Rivers Covered

- **AuSable River** — main branch, North Branch, South Branch
- **Manistee River** — upper through lower
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

Rating is based on flow (% of seasonal median), water temperature, and gage height — from USGS Water Services real-time data.

## Stack

- **Vercel** — hosting + daily cron (8am CT)
- **Upstash Redis** — cache (one AI call per day)
- **USGS Water Services API** — free, live stream data
- **Claude Haiku** — daily conditions brief

## Related

- [Freighter View Farms](https://freighterviewfarms.com) — Great Lakes gardening blog
- [Great Lakes Gazette](https://gazette.chrisizworski.com) — daily maritime newsletter
- [chrisizworski.com](https://chrisizworski.com)
