import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPageConditions,pageCacheControl} from '../lib/river-page-data.js';
import {buildSEOPage} from '../api/river/[id].js';
import {RIVERS} from '../lib/rivers.js';
import {fetchLiveReadings,fetchSeasonalStats} from '../lib/usgs.js';
const river=RIVERS.find(r=>r.id==='manistee'),id=river.primaryGauge;
const readings={[id]:{flow:500,temp_c:10,gage:2,timestamp:'2026-11-26T12:00:00Z'}},stats={[id]:{p50:500}};
test('stalled sources cannot prevent substantive canonical guide',async()=>{
 const d=await loadPageConditions(id,{timeoutMs:20,fetchLiveReadings:()=>new Promise(()=>{}),fetchAllStats:()=>new Promise(()=>{})});
 assert.equal(d.hasData,false);assert.equal(d.rating,null);
 const html=buildSEOPage(river,d,[]);
 assert.match(html,/data-conditions-state="unavailable"/);assert.match(html,/Not rated/);assert.match(html,/Access &amp; Regulations/);
 assert.ok(html.includes('https://michigantroutreport.com/rivers/manistee'));
 assert.match(pageCacheControl(d),/s-maxage=60,/);
});
test('parallel source calls; failed statistics never invent a rating',async()=>{
 let liveStarted=false,statsStarted=false;
 const d=await loadPageConditions(id,{timeoutMs:100,fetchLiveReadings:async()=>{liveStarted=true;await Promise.resolve();assert.equal(statsStarted,true);return readings;},fetchAllStats:async()=>{statsStarted=true;assert.equal(liveStarted,true);throw Error('unavailable');}});
 assert.equal(d.hasData,true);assert.equal(d.complete,false);assert.equal(d.cfs,500);assert.equal(d.rating,null);
 assert.match(buildSEOPage(river,d,[]),/data-conditions-state="partial"/);
});
test('complete evidence retains measurement time and rating',async()=>{
 const d=await loadPageConditions(id,{fetchLiveReadings:async()=>readings,fetchAllStats:async()=>stats});
 assert.equal(d.complete,true);assert.ok(d.rating?.label);assert.equal(d.flowTimestamp,readings[id].timestamp);
 assert.match(pageCacheControl(d),/s-maxage=1800,/);
 assert.match(buildSEOPage(river,d,[]),/data-conditions-state="current"/);
});
test('USGS timeout includes body parsing',async()=>{
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async(_url,{signal})=>({ok:true,json:()=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true})),text:()=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}))});
  assert.deepEqual(await fetchLiveReadings([id],{timeoutMs:15}),{});
  assert.equal((await fetchSeasonalStats(id,{timeoutMs:15})).p50,null);
 } finally {globalThis.fetch=original;}
});
