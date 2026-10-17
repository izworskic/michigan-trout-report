import test from "node:test";
import assert from "node:assert/strict";
import {parseNdbc} from "../api/smelt-run.js";
const header="#YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS PTDY TIDE\n#yr mo dy hr mn degT m/s m/s m sec sec degT hPa degC degC degC nmi hPa ft\n";
const newLine="2026 04 16 01 30 90 5.0 6.0 0.4 MM MM 60 1019.5 7.4 6.5 4.3 MM MM MM\n";
const oldLine="2026 04 15 01 30 70 4.0 5.0 0.2 MM MM 70 1012.0 6.1 5.5 3.2 MM MM MM\n";
test("NDBC uses UTC timestamps, measured Celsius water, and observed waves/wind only",()=>{
 const d=parseNdbc(header+newLine+oldLine,"45025",Date.UTC(2026,3,16,2,0));
 assert.equal(d.station,"45025");
 assert.equal(d.tempF,43.7);
 assert.equal(d.windMph,11);
 assert.equal(d.waveFt,1.3);
 assert.equal(d.stale,false);
 assert.equal(d.change24hF,1.8);
});
test("NDBC handles missing temperature without converting MM to 32F",()=>{
 assert.equal(parseNdbc(header+newLine.replace(" 6.5 "," MM "),"45025",Date.UTC(2026,3,16,2,0)),null);
});
test("NDBC old readings are never called current",()=>{
 const d=parseNdbc(header+newLine,"45025",Date.UTC(2026,3,18,2,0));
 assert.equal(d.stale,true);
 assert.ok(d.ageHours>12);
});
test("NDBC future timestamps, out-of-range values and nonexistent stations do not score",()=>{
 const time=Date.UTC(2026,3,16,2,0);
 assert.equal(parseNdbc(header+newLine,"45025",Date.UTC(2026,3,14,1,0)),null);
 assert.equal(parseNdbc(header+newLine.replace(" 6.5 "," 99.0 "),"45025",time),null);
 assert.equal(parseNdbc("bad","45025",time),null);
});
