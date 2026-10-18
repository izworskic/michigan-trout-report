import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync(new URL("../public/smelt-run/index.html",import.meta.url),"utf8");
const client=readFileSync(new URL("../public/smelt-run/tracker.js",import.meta.url),"utf8");
test("smelt map uses keyless OpenFreeMap rather than CARTO tile watermarks",()=>{
 assert.match(client,/tiles\.openfreemap\.org\/styles\/positron/);
 assert.match(client,/new maplibregl\.Map\(/);
 assert.doesNotMatch(page+client,/basemaps\.cartocdn\.com|L\.tileLayer|[?&]key=YOUR_KEY/);
 assert.match(page,/OpenFreeMap/);
 assert.match(page,/OpenStreetMap/);
});
test("live water data initializes before the optional third-party map module",()=>{
 assert.match(page,/<script src="\/smelt-run\/tracker\.js\?v=20261018-compare-fix1" type="module"><\/script>/);
 assert.match(client,/^import \{createExplorer\} from "\.\/explorer\.js\?v=20261018-compare-fix1"/);
 assert.doesNotMatch(client,/^import .*https:\/\/unpkg\.com\/maplibre-gl/m);
 assert.match(client,/maplibregl=await import\("https:\/\/unpkg\.com\/maplibre-gl@6\.13\.0\/dist\/maplibre-gl\.mjs"\)/);
 assert.match(client,/void load\(\);\s*void startMap\(\);/);
 assert.match(client,/Map tiles are unavailable in this browser\. Live water and weather observations are still available/);
 assert.doesNotMatch(client,/maplibregl\.supported\(/);
 assert.match(page,/href="\/api\/smelt-run">View raw NOAA, NWS and USGS data/);
 assert.match(client,/createExplorer\(/);
 assert.match(client,/function selectNight\(/);
});
test("seven accessible clickable markers and region coordination remain intact",()=>{
 assert.match(client,/const m=new maplibregl\.Marker\(/);
 assert.match(client,/el\.addEventListener\("click",\(\)=>select\(r\.id,true\)\)/);
 assert.match(client,/el\.setAttribute\("aria-label"/);
 assert.match(client,/classList\.toggle\("active"/);
 assert.match(client,/map\.easeTo\(\{center:\[r\.lon,r\.lat\]/);
});
