import test from "node:test";
import assert from "node:assert/strict";
import {createExplorer} from "../public/smelt-run/explorer.js";
function harness(){
 const root={innerHTML:"",listeners:{},addEventListener(k,fn){this.listeners[k]=fn;},querySelector(){return null;}};
 const calls=[];
 const exp=createExplorer(root,{onRegion:id=>calls.push(["region",id]),onNight:date=>calls.push(["night",date])});
 function click(selector,dataset={}){root.listeners.click({target:{closest:k=>k===selector?{dataset}:null}});}
 function change(id,value){root.listeners.change({target:{id,value}});}
 return {root,exp,calls,click,change};
}
const place=(id,name,stream,buoy,forecast=[])=>({
 id,name,area:"Michigan test region",waterbody:"A sample river",history:"Good",status:"Off season",
 lakeBasin:"Superior",forecast,water:stream==null?null:{
  station:"04043097",waterF:stream,stale:false,measuredAt:"2026-10-17T12:30:00Z",
  provisional:true,history:[{t:"2026-10-13T12:00:00Z",f:stream+2},{t:"2026-10-15T12:00:00Z",f:stream+1},{t:"2026-10-17T12:00:00Z",f:stream}]},
 buoy:buoy==null?null:{station:"4403587",tempF:buoy,stale:false,measuredAt:"2026-10-17T11:30:00Z",
  history:[{t:"2026-10-15T12:00:00Z",f:buoy+1},{t:"2026-10-17T12:00:00Z",f:buoy}]},
 satellite:{tempF:52,stale:false,history:[{date:"2026-10-13",f:54},{date:"2026-10-14",f:53.5},{date:"2026-10-15",f:53},{date:"2026-10-17",f:52}]}
});
test("explorer produces real interactive visualizations with no fabricated fish counts",()=>{
 const {root,exp}=harness();
 exp.update([place("falls","Falls River",44,46),place("whitefish","Whitefish Bay",null,47)],"falls",false,null);
 assert.match(root.innerHTML,/data-exp-layer="stream"/);
 assert.match(root.innerHTML,/data-exp-chart-date="2026-10-17"/);
 assert.match(root.innerHTML,/id="exp-date-slider"/);
 assert.match(root.innerHTML,/Measured stream 44\.0°F/);
 assert.match(root.innerHTML,/data-exp-region="whitefish"/);
 assert.match(root.innerHTML,/Spring night explorer is dormant/);
 assert.doesNotMatch(root.innerHTML,/\b\d+% chance of smelt\b/i);
});
test("comparison is immediately populated and needs no pin or off-screen click",()=>{
 const {root,exp}=harness();
 const rows=[place("falls","Falls River",44,null),place("whitefish","Whitefish Bay",null,47)];
 exp.update(rows,"whitefish",false,null);
 assert.match(root.innerHTML,/id="exp-compare-a"/);
 assert.match(root.innerHTML,/id="exp-compare-b"/);
 assert.match(root.innerHTML,/exp-compare-grid/);
 assert.match(root.innerHTML,/Falls River/);
 assert.match(root.innerHTML,/Whitefish Bay/);
 assert.match(root.innerHTML,/No valid stream-to-stream comparison/);
 assert.equal(exp.getCompareId(),"falls");
 assert.doesNotMatch(root.innerHTML,/id="exp-pin"/);
});
test("first-region selector updates map and chart; second-region selector updates comparison directly",()=>{
 const {root,exp,calls,change}=harness();
 const rows=[place("falls","Falls River",44,null),place("whitefish","Whitefish Bay",null,47),place("munising","Munising",null,null)];
 exp.update(rows,"whitefish",false,null);
 change("exp-compare-b","munising");
 assert.equal(exp.getCompareId(),"munising");
 assert.match(root.innerHTML,/exp-compare-grid/);
 assert.match(root.innerHTML,/Munising/);
 change("exp-compare-a","falls");
 assert.deepEqual(calls.at(-1),["region","falls"]);
 exp.update(rows,"falls",false,null);
 assert.equal(exp.getCompareId(),"munising");
 assert.match(root.innerHTML,/REGION A · MAP \+ CHART/);
});
test("changing first region to previous comparison swaps second to previous first",()=>{
 const {exp,calls,change}=harness();
 const rows=[place("falls","Falls River",44,null),place("whitefish","Whitefish Bay",null,47)];
 exp.update(rows,"whitefish",false,null);
 assert.equal(exp.getCompareId(),"falls");
 change("exp-compare-a","falls");
 assert.deepEqual(calls.at(-1),["region","falls"]);
 exp.update(rows,"falls",false,null);
 assert.equal(exp.getCompareId(),"whitefish");
});
test("API hydration upgrades an uninformative fallback default to a measured-stream comparison",()=>{
 const {root,exp}=harness();
 const initial=[place("whitefish","Whitefish Bay",null,null),place("roxbury","Roxbury Creek",null,null),place("falls","Falls River",null,null)];
 exp.update(initial,"whitefish",false,null);
 assert.equal(exp.getCompareId(),"roxbury");
 const hydrated=[place("whitefish","Whitefish Bay",null,55),place("roxbury","Roxbury Creek",null,55),place("falls","Falls River",44,null)];
 exp.update(hydrated,"whitefish",false,null);
 assert.equal(exp.getCompareId(),"falls");
 assert.match(root.innerHTML,/REGION B · COMPARISON/);
 assert.match(root.innerHTML,/44\.0°F/);
});
test("explicitly selected comparison survives refresh even when another stream gauge becomes available",()=>{
 const {root,exp,change}=harness();
 const rows=[place("whitefish","Whitefish Bay",null,55),place("falls","Falls River",44,null),place("munising","Munising",null,null)];
 exp.update(rows,"whitefish",false,null);
 change("exp-compare-b","munising");
 assert.equal(exp.getCompareId(),"munising");
 exp.update(rows,"whitefish",false,null);
 assert.equal(exp.getCompareId(),"munising");
 assert.match(root.innerHTML,/REGION B · COMPARISON/);
});
test("comparison never pretends a shared lake basin or buoy is independent evidence",()=>{
 const {root,exp}=harness();
 const rows=[place("whitefish","Whitefish Bay",null,47),place("roxbury","Roxbury Creek",null,47)];
 exp.update(rows,"whitefish",false,null);
 assert.match(root.innerHTML,/Same buoy:/);
 assert.match(root.innerHTML,/one shared lake measurement/);
 assert.match(root.innerHTML,/Same lake basin:/);
 assert.match(root.innerHTML,/No valid stream-to-stream comparison/);
});
test("only stream-to-stream readings with close timestamps produce an actual temperature delta",()=>{
 const {root,exp}=harness();
 const rows=[place("falls","Falls River",44,null),place("another","Another River",47,null)];
 exp.update(rows,"falls",true,null);
 assert.match(root.innerHTML,/Comparable measured stream temperatures/);
 assert.match(root.innerHTML,/Difference: 3\.0°F/);
});
test("region matrix and source-layer toggles coordinate through explorer",()=>{
 const {root,exp,calls,click}=harness();
 const rows=[place("falls","Falls River",44,46),place("whitefish","Whitefish Bay",null,47)];
 exp.update(rows,"falls",false,null);
 click("[data-exp-region]",{expRegion:"whitefish"});
 assert.deepEqual(calls.at(-1),["region","whitefish"]);
 exp.update(rows,"whitefish",false,null);
 assert.match(root.innerHTML,/exp-compare-grid/);
 click("[data-exp-layer]",{expLayer:"buoy"});
 assert.match(root.innerHTML,/aria-pressed="false" data-exp-layer="buoy"/);
});
test("spring night rail handles actual known dates and does not invent a past night",()=>{
 const forecast=[{date:"2027-04-20",weatherGrade:"Favorable",airF:47,maxWindMph:8}];
 const {root,exp,calls,click}=harness();
 exp.update([place("falls","Falls River",44,null,forecast)],"falls",true,null);
 assert.match(root.innerHTML,/data-exp-night="2027-04-20"/);
 click("[data-exp-night]",{expNight:"2027-04-20"});
 assert.deepEqual(calls.at(-1),["night","2027-04-20"]);
 exp.update([place("falls","Falls River",44,null,forecast)],"falls",true,"2027-04-20");
 assert.match(root.innerHTML,/Favorable weather/);
 assert.match(root.innerHTML,/Weather only—never a smelt count/);
});
test("no temperature samples does not interpolate, forecast, or synthesize chart",()=>{
 const {root,exp}=harness();
 exp.update([{id:"no-data",name:"No data",water:null,buoy:null,satellite:null,forecast:[],status:"Off season",area:"Michigan"}],"no-data",false,null);
 assert.match(root.innerHTML,/No dated temperature history/);
 assert.match(root.innerHTML,/Only historical context/);
 assert.match(root.innerHTML,/No current sample/);
});
