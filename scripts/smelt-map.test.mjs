import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync(new URL("../public/smelt-run/index.html",import.meta.url),"utf8");
const client=readFileSync(new URL("../public/smelt-run/tracker.js",import.meta.url),"utf8");
test("smelt map uses a keyless production basemap and no CARTO watermark tiles",()=>{
 assert.match(client,/tiles\.openfreemap\.org\/styles\/positron/);
 assert.match(client,/new maplibregl\.Map\(/);
 assert.doesNotMatch(page+client,/basemaps\.cartocdn\.com|L\.tileLayer|[?&]key=YOUR_KEY/);
 assert.match(page,/OpenFreeMap/);
 assert.match(page,/OpenStreetMap/);
});
test("smelt map loads MapLibre v6 module without removed API and doesn't block refresh",()=>{
 assert.match(page,/<script src="\/smelt-run\/tracker\.js" type="module"><\/script>/);
 assert.match(client,/import \* as maplibregl from "https:\/\/unpkg\.com\/maplibre-gl@6\.13\.0\/dist\/maplibre-gl\.mjs"/);
 assert.doesNotMatch(client,/maplibregl\.supported\(/);
 assert.match(client,/board\(\);detail\(\);startMap\(\);explorer\.update\(data,selected,season,night\);load\(\);/);
 assert.match(client,/createExplorer\(/);
 assert.match(client,/function selectNight\(/);
 assert.match(client,/function startMap\(\)[\s\S]*?try\s*\{[\s\S]*?catch/);
});
test("smelt map preserves seven accessible clickable region markers",()=>{
 assert.match(client,/const m=new maplibregl\.Marker\(/);
 assert.match(client,/el\.addEventListener\("click",\(\)=>select\(r\.id,true\)\)/);
 assert.match(client,/el\.setAttribute\("aria-label"/);
 assert.match(client,/classList\.toggle\("active"/);
 assert.match(client,/map\.easeTo\(\{center:\[r\.lon,r\.lat\]/);
 assert.match(client,/Map unavailable\. Use the region list/);
});
