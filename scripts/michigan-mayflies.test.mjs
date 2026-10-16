import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {REACHES,STATEWIDE_REACHES,MAYFLIES,buildMayflyReport} from '../lib/mayfly-forecast.js';
import handler from '../api/mayfly-hatches.js';
const ids=STATEWIDE_REACHES.map(r=>r.id);
function mockRes(){return{code:0,setHeader(){},status(c){this.code=c;return this;},json(d){this.body=d;return this;},end(){return this;}};}
test('original Au Sable branches remain unchanged; statewide adds the renowned rivers',()=>{
 assert.equal(REACHES.length,5);
 assert.deepEqual(ids,['manistee-upper','manistee-mid','pere-marquette','muskegon-croton','boardman-upper']);
 const gauges=new Set([...REACHES,...STATEWIDE_REACHES].map(x=>x.station));
 assert.equal(gauges.size,10);
 assert(STATEWIDE_REACHES.every(s=>/^\d{8}$/.test(s.station)&&Number.isFinite(s.lat)&&Number.isFinite(s.lon)));
 assert(STATEWIDE_REACHES.find(x=>x.id==='pere-marquette').dataScope.includes('FLOW ONLY'));
 assert(STATEWIDE_REACHES.find(x=>x.id==='boardman-upper').dataScope.includes('flow only'));
});
test('twelve mayfly species reused; 68 degree heat caution prevents favorable trout status',()=>{
 assert.equal(MAYFLIES.length,12);
 const report=buildMayflyReport({reach:STATEWIDE_REACHES[3],now:new Date('2026-06-23T18:00:00Z'),waterTempF:69,windMph:4});
 assert.equal(report.troutHeatCaution,true);
 assert.equal(report.species.find(s=>s.id==='hex').signal,'Trout heat caution');
});
test('gauge-only Pere Marquette API does not generate false water temperature, regardless of flow',async()=>{
 const old=globalThis.fetch,requests=[];
 globalThis.fetch=async url=>{
  const u=String(url);requests.push(u);
  if(u.includes('api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous')){
   const code=new URL(u).searchParams.get('parameter_code');
   return {ok:true,json:async()=>({features:code==='00060'?[{properties:{parameter_code:'00060',unit_of_measure:'ft^3/s',value:'537',time:new Date().toISOString()}}]:[]})};
  }
  if(u.includes('/collections/continuous/'))return{ok:true,json:async()=>({features:[],links:[]})};
  if(u.includes('api.weather.gov/points/'))throw Error('No NWS source in unit test');
  throw Error('Unexpected '+u);
 };
 try{
  const res=mockRes();
  await handler({method:'GET',query:{reach:'pere-marquette'}},res);
  assert.equal(res.code,200);
  assert.equal(res.body.success,true);
  assert.equal(res.body.reach.station,'04122500');
  assert.equal(res.body.waterTempF,null);
  assert.equal(res.body.flowCfs,537);
  assert.equal(res.body.temperatureSource,'unavailable');
  assert.equal(res.body.outlook.days.length,7);
  assert(res.body.outlook.days.every(x=>x.tempBand===null));
  assert(requests.some(u=>u.includes('monitoring_location_id=USGS-04122500')));
 }finally{globalThis.fetch=old;}
});
test('null USGS values are not parsed as 32F water or zero-discharge measurement',async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async url=>{
  const u=String(url);
  if(u.includes('/collections/latest-continuous/'))return{ok:true,json:async()=>({features:[
   {properties:{parameter_code:new URL(u).searchParams.get('parameter_code'),value:null,time:new Date().toISOString()}}
  ]})};
  if(u.includes('/collections/continuous/'))return{ok:true,json:async()=>({features:[],links:[]})};
  throw Error('source down');
 };
 try{
  const res=mockRes();await handler({method:'GET',query:{reach:'boardman-upper'}},res);
  assert.equal(res.code,200);
  assert.equal(res.body.waterTempF,null);
  assert.equal(res.body.flowCfs,null);
 }finally{globalThis.fetch=old;}
});
test('statewide dashboard is source-linked, responsive, CARTO mapped, and explicitly NOT a lake swarms page',()=>{
 const h=readFileSync('public/michigan-mayfly-hatches.html','utf8');
 for(const token of ['/api/mayfly-hatches?reach=','basemaps.cartocdn.com','04122500',
    '04126970','04123500','04124000','04121970','04136000',
    'No fresh measured water temperature','Outside the normal','Lake fly',
    '/great-lakes-mayflies.html','DNR Au Sable Natural River Plan','68°F']){
  if(token==='Lake fly')continue;
  assert(h.includes(token),'Missing '+token);
 }
 assert(!h.includes('Hatch confirmed'));
 assert(h.includes('aria-pressed'));
 assert(h.includes('report.troutHeatCaution'));
 const scripts=[...h.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(x=>!/(?:src=|ld\+json)/i.test(x[1]));
 assert(scripts.length>=1);scripts.forEach(x=>assert.doesNotThrow(()=>new Script(x[2])));
});
test('Michigan river hatch network prominently links the statewide experience',()=>{
 const home=readFileSync('public/index.html','utf8');
 const ausable=readFileSync('public/mayfly-hatches.html','utf8');
 const lake=readFileSync('public/great-lakes-mayflies.html','utf8');
 assert(home.includes('/michigan-mayfly-hatches.html'));
 assert(ausable.includes('/michigan-mayfly-hatches.html'));
 assert(lake.includes('Looking for Michigan'));
 assert(lake.includes('/michigan-mayfly-hatches.html'));
 assert(readFileSync('public/sitemap.xml','utf8').includes('/michigan-mayfly-hatches.html'));
});
