import test from "node:test";
import assert from "node:assert/strict";
import {createExplorer} from "../public/smelt-run/explorer.js";
function harness(){
 const root={innerHTML:"",listeners:{},addEventListener(k,fn){this.listeners[k]=fn;},querySelector(){return null;}};
 const calls=[];
 const exp=createExplorer(root,{onRegion:id=>calls.push(["region",id]),onNight:date=>calls.push(["night",date])});
 function click(selector,dataset={}){
  root.listeners.click({target:{closest:k=>k===selector?{dataset}:null}});
 }
 return {root,exp,calls,click};
}
const place=(id,name,stream,buoy,forecast=[])=>({
 id,name,area:"Michigan test region",waterbody:"A sample river",history:"Good",status:"Off season",
 lakeBasin:"Superior",forecast,water:stream==null?null:{
  waterF:stream,stale:false,history:[{t:"2026-10-13T12:00:00Z",f:stream+2},{t:"2026-10-15T12:00:00Z",f:stream+1},{t:"2026-10-17T12:00:00Z",f:stream}]},
 buoy:buoy==null?null:{tempF:buoy,stale:false,history:[{t:"2026-10-15T12:00:00Z",f:buoy+1},{t:"2026-10-17T12:00:00Z",f:buoy}]},
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
test("region matrix, pin, and source-layer controls coordinate through same explorer state",()=>{
 const {root,exp,calls,click}=harness();
 const rows=[place("falls","Falls River",44,46),place("whitefish","Whitefish Bay",null,47)];
 exp.update(rows,"falls",false,null);
 click("#exp-pin");
 assert.match(root.innerHTML,/is pinned/);
 click("[data-exp-region]",{expRegion:"whitefish"});
 assert.deepEqual(calls.at(-1),["region","whitefish"]);
 exp.update(rows,"whitefish",false,null);
 assert.match(root.innerHTML,/exp-compare-grid/);
 assert.match(root.innerHTML,/Not available/);
 click("[data-exp-layer]",{expLayer:"buoy"});
 assert.match(root.innerHTML,/aria-pressed="false" data-exp-layer="buoy"/);
 click("#exp-clear");
 assert.doesNotMatch(root.innerHTML,/exp-compare-grid/);
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
