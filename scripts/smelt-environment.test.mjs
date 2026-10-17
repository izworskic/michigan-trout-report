import test from "node:test";
import assert from "node:assert/strict";
import {parseLakeCsv,parseIceResponse,parseIceDate,iceBand,LAKE_CSV} from "../lib/smelt-environment.js";
test("NOAA GLSEA parser reads correct year and dates without creating future values",()=>{
 const now=Date.UTC(2026,3,18,15);
 const csv=",2025,2026\n105,41.7,43.4\n106,41.9,44.1\n108,42.9,45.2\n109,43.0,99.9\n";
 const v=parseLakeCsv(csv,2026,now);
 assert.equal(v.tempF,45.2);
 assert.equal(v.measuredAt,"2026-04-18T12:00:00.000Z");
 assert.equal(v.change3dF,1.8);
 assert.equal(v.history.length,3);
 assert.equal(v.stale,false);
 assert.match(v.kind,/lake-wide mean/);
});
test("NOAA GLSEA missing, invalid, or out-of-date values never become current",()=>{
 const csv=",2025,2026\n100,42,43\n101,42,NA\n102,43,\n103,44,1000\n";
 assert.equal(parseLakeCsv(csv,2026,Date.UTC(2026,3,17)).stale,true);
 assert.equal(parseLakeCsv(",2025\n1,43",2026,Date.UTC(2026,3,17)),null);
 assert.equal(parseLakeCsv("garbage",2026),null);
 assert.ok(LAKE_CSV.Superior.includes("glerl.noaa.gov"));
});
test("leap-year day 366 is handled without inventing day 367",()=>{
 const csv=",2024\n365,45\n366,46\n367,47\n";
 const v=parseLakeCsv(csv,2024,Date.UTC(2024,11,31,19));
 assert.deepEqual(v.history.map(x=>x.date),["2024-12-30","2024-12-31"]);
});
test("USNIC renderer codes are categorical, not percent concentrations",()=>{
 assert.equal(iceBand("00").category,"open");
 assert.equal(iceBand("55").category,"open");
 assert.equal(iceBand("24").category,"light");
 assert.equal(iceBand("67").category,"moderate");
 assert.equal(iceBand("81").category,"heavy");
 assert.equal(iceBand("92").category,"heavy");
 assert.equal(iceBand("99").category,"unknown");
});
test("USNIC current polygon requires dated source and reports categorical observations",()=>{
 const now=Date.UTC(2026,3,18,19);
 const r=parseIceResponse({features:[{attributes:{ct:"89",idp_filedate:Date.UTC(2026,3,18,18)}}]},now,{lat:46.5,lon:-86.5});
 assert.equal(r.status,"current");
 assert.equal(r.category,"heavy");
 assert.equal(r.sample.lon,-86.5);
 assert.equal(parseIceResponse({features:[{attributes:{ct:"00",idp_filedate:Date.UTC(2026,3,18,18)}}]},now).category,"open");
});
test("USNIC missing geometry, stale chart and missing dates are not ice-free claims",()=>{
 const now=Date.UTC(2026,3,18,19);
 assert.equal(parseIceResponse({features:[]},now).status,"no coverage");
 assert.equal(parseIceResponse({features:[{attributes:{ct:"00",idp_filedate:Date.UTC(2026,3,12,18)}}]},now).status,"stale");
 assert.equal(parseIceResponse({features:[{attributes:{ct:"00"}}]},now).status,"unavailable");
 assert.equal(parseIceResponse({error:"bad"},now).status,"unavailable");
 assert.equal(parseIceDate(Date.UTC(2026,3,19,20),now),null);
});
