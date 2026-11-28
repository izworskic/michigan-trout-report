import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const js=readFileSync(new URL("../public/salmon-run/salmon-run.js",import.meta.url),"utf8");
const now=Date.now(),fresh=new Date(now-3600000).toISOString(),old=new Date(now-48*3600000).toISOString();
test("fall run evidence independently gates each observation by age",()=>{
 const c=vm.createContext({Date});vm.runInContext(js,c);
 for(const time of [old,null,"invalid",new Date(now+7200000).toISOString()]){
  c.input={flow:1234,tempF:50,trend:"rising",flowObservedAt:time,tempObservedAt:time};
  const x=vm.runInContext("currentRunEvidence(input)",c);
  assert.equal(x.flow,null);assert.equal(x.tempF,null);assert.equal(x.trend,null);assert.equal(x.tempOld,true);
 }
 c.input={flow:1234,tempF:50,trend:"rising",flowObservedAt:old,tempObservedAt:fresh};
 const x=vm.runInContext("currentRunEvidence(input)",c);
 assert.equal(x.flow,null);assert.equal(x.tempF,50);assert.equal(x.trend,null);
 c.input={flow:1234,tempF:50,trend:"rising",flowObservedAt:fresh,tempObservedAt:fresh};
 assert.equal(vm.runInContext("currentRunEvidence(input).trend",c),"rising");
});
test("actual fall board excludes stale readings and retains fresh temperature picks",async()=>{
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:"",textContent:"",title:"",querySelector:s=>node(id+s)});return nodes.get(id);};
 const sample=(stamp)=>({value:{timeSeries:[{variable:{variableCode:[{value:"00060"}]},values:[{value:[{value:"1234",dateTime:stamp}]}]},{variable:{variableCode:[{value:"00010"}]},values:[{value:[{value:"10",dateTime:stamp}]}]}]}});
 let stamp=old;const c=vm.createContext({Date,document:{getElementById:node},fetch:async()=>({ok:true,json:async()=>sample(stamp)}),setTimeout,clearTimeout});
 vm.runInContext(js,c);await vm.runInContext("renderBoard()",c);
 assert.match(node("row-big-manistee-tippy-dam.c-temp").innerHTML,/Outdated/);
 assert.doesNotMatch(node("steelhead-picks").innerHTML,/<a href=/);
 assert.match(node("board-stamp").textContent,/USGS checked/);
 stamp=fresh;await vm.runInContext("renderBoard()",c);
 assert.match(node("row-big-manistee-tippy-dam.c-temp").innerHTML,/50&deg;F/);
});
