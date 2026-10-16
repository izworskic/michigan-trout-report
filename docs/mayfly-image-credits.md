# Michigan mayfly reference images — author and source credits

The images used on `/michigan-mayfly-hatches.html` are locally hosted WebP **resized re-encodings** of real taxon-labeled specimens, produced for page performance. They are not synthetic or used as definitive diagnostic images. Each public card links to its original Commons file and identifies photographer and license. All photo assets retain the applicable original Creative Commons attribution and share-alike terms.

| Local asset | Original photo | Photo author | Original license | Visible stage |
| --- | --- | --- | --- | --- |
| `michigan-hex-hero.webp` | [Hexagenia limbata, Augusta Michigan](https://commons.wikimedia.org/wiki/File:Hexagenia_limbata.jpg) | Cody Hough | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Adult (winged) |
| `hendrickson.webp` | [Ephemerella subvaria](https://commons.wikimedia.org/wiki/File:Spiny_crawler_mayfly,_Ephemerella_subvaria.jpg) | Bob Henricks | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | **Aquatic nymph** — not the winged adult |
| `brown-drake.webp` | [Ephemera simulans male](https://commons.wikimedia.org/wiki/File:Ephemera_simulans_male.jpg) | Beatriz Moisset | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Winged adult |
| `hex.webp` | [Hexagenia limbata, Mitchell SD](https://commons.wikimedia.org/wiki/File:Hexagenia_limbata_(giant_mayfly)_(Mitchell,_South_Dakota,_USA)_1.jpg) | James St. John | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | Winged adult |
| `sulphur.webp` | [Ephemerella dorothea](https://commons.wikimedia.org/wiki/File:Spiny_crawler_mayfly,_Ephemerella_dorothea_(8561750415).jpg) | Bob Henricks | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | **Aquatic nymph** — not the pale-yellow winged adult |
| `bwo.webp` | [Baetis tricaudatus male imago](https://commons.wikimedia.org/wiki/File:Baetis_tricaudatus_male_imago.jpg) | Jerry Friedman | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Winged adult |

## Reuse and provenance

- Photo files are rescaled, recoded as WebP, and may be browser-cropped within the image card. Original images and licenses are linked above and from the site. For ShareAlike assets, derivative image files remain under the corresponding CC BY-SA license.
- The **Hendrickson and Sulphur images depict nymphs**, even though anglers often mean adult duns or spinners when referring to hatches. The card overlay and note must explicitly distinguish these stages. Do not silently swap them or claim to show an adult.
- The Brown Drake source was photographed in Pennsylvania; the Hex gallery image in South Dakota; the BWO example was taken in New Mexico. These are taxonomic references, **not Michigan observations of a hatch**. The hero image is a verified Michigan Hex specimen.
- Common angling names cover multiple species and genera; a photo matcher is a candidate guide, not taxonomic verification.
- Do not substitute AI illustrations for taxon-verified photographs on the identification cards. Original concept art can be editorial decoration only.
- Assets are first-party under `/images/mayflies/`. No Wikimedia thumbnail dependency, no runtime scraping, no CARTO image API and no Vercel image optimization credits.

## Full-bleed river hero

- Local file: `public/images/mayflies/ausable-sunset-hero.webp`
- Original: [HMNF AuSableRiver HighbanksOverlook (17762226084).jpg](https://commons.wikimedia.org/wiki/File:HMNF_AuSableRiver_HighbanksOverlook_(17762226084).jpg)
- Creator: **U.S. Forest Service Eastern Region**; original U.S. government photograph is **public domain in the United States**.
- Modification: web-optimized and cropped for page display. Source link and provenance visible on the hero.
- Scenic context only. The sunset image is **not a current hatch or recent river conditions claim** and must never be labeled as one.
- Photo-identity cards continue to use credited, first-party specimen photographs. On the new immediately visible five-fly strip, Hendrickson and Sulphur photos are explicitly labeled nymph examples; the others show winged adults.

## Basemap provider correction

The 2026 CARTO raster change caused "API KEY REQUIRED" watermark overlays for unauthenticated tile requests. The standalone trout-river gauge map now uses `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with visible copyright attribution, browser caching and without bulk preloading; it degrades to an on-page clickable gauge locator when map resources fail. If future traffic requires a commercial tile provider, configure a project-scoped licensed map service rather than silently serving watermark tiles. See [OpenStreetMap Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/).
