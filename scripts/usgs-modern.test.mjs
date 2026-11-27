import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLiveObservations,parseSeasonalNormals,fetchLiveReadings,fetchAllStats} from '../lib/usgs.js';
const id='04136500',other='04031000',now=Date.parse('2026-11-26T23:20:00Z'),time='2026-11-26T23:00:00+00:00';
const feature=(param,value,extra={})=>({type:'Feature',properties:{monitoring_location_id:'USGS-'+id,parameter_code:param,time,value,unit_of_measure:{'00060':'ft^3/s','00010':'degC','00065':'ft','00300':'mg/l'}[param],qualifier:null,...extra}});
const live=features=>({type:'FeatureCollection',features,numberReturned:features.length,links:[]});
test('actual modern continuous schema preserves units, independent dates and zero flow',()=>{
 const r=parseLiveObservations(live([feature('00060','0'),feature('00010','4.7'),feature('00065','2.98'),feature('00300','11.7')]),[id],now)[id];
 assert.equal(r.flow,0);assert.equal(r.temp_c,4.7);assert.equal(r.gage,2.98);assert.equal(r.do_mgl,11.7);
 assert.equal(r.timestamp,'2026-11-26T23:00:00.000Z');assert.equal(r.observationStates.flow,'fresh');
});
test('missing, seasonal, stale, ambiguous, future and wrong units never create current observations',()=>{
 const f=(value,extra)=>feature('00060',value,extra);
 for(const [values,state] of [[ [f(null,{qualifier:['SEASONAL']})],'seasonal'],[[f('-999999')],'no-reading'],[[f('')],'no-reading'],[[f('22',{time:'2026-11-24T23:00:00Z'})],'stale'],[[f('22',{time:'2026-11-27T23:00:00Z'})],'invalid-time'],[[f('22',{unit_of_measure:'m3/s'})],'invalid-unit'],[[f('22'),f('23')],'ambiguous']]){
  const r=parseLiveObservations(live(values),[id],now)[id];assert.equal(r.flow,null);assert.equal(r.timestamp,null);assert.equal(r.observationStates.flow,state);
 }
 assert.throws(()=>parseLiveObservations({...live([]),links:[{rel:'next'}]},[id],now));
 assert.throws(()=>parseLiveObservations(live([f('22',{monitoring_location_id:'USGS-'+other})]),[id],now));
});
const normalRow={time_of_year:'11-26',time_of_year_type:'day_of_year',approval_status:'approved',sample_count:74,computation:'percentile',percentiles:['5','10','25','50','75','90','95'],values:['720.5','755.5','855.75','961.5','1080.0','1255.0','1345.0']};
const series={parameter_code:'00060',unit_of_measure:'ft^3/s',parent_statistic_id:'00003',values:[normalRow]};
const normals=(data=[series])=>({type:'FeatureCollection',features:[{type:'Feature',properties:{monitoring_location_id:'USGS-'+id,data}}],next:null});
test('actual approved daily-mean USGS normals schema returns percentile baseline and excludes missing gauge',()=>{
 const r=parseSeasonalNormals(normals(),[id,other],'11-26');
 assert.deepEqual(r[id],{gaugeId:id,p10:755.5,p25:855.75,p50:961.5,p75:1080,p90:1255});assert.equal(r[other].p50,null);
 assert.equal(parseSeasonalNormals(normals(),[id],'11-27')[id].p50,null);
 assert.equal(parseSeasonalNormals(normals([{...series,parent_statistic_id:'00001'}]),[id],'11-26')[id].p50,null);
 assert.throws(()=>parseSeasonalNormals({...normals(),next:'token'},[id],'11-26'));
});
test('network adapter uses modern API, Detroit calendar and one request for multiple gauges',async()=>{
 const old=globalThis.fetch,urls=[];
 try{
  globalThis.fetch=async url=>{urls.push(url);return {ok:true,json:async()=>url.includes('observationNormals')?normals():live([feature('00060','871',{time:new Date(Date.now()-1000).toISOString()})])};};
  assert.equal((await fetchLiveReadings([id,other]))[id].flow,871);
  assert.equal((await fetchAllStats([id,other],{now:new Date('2026-11-27T03:00:00Z')}))[id].p50,961.5);
  assert.equal(urls.length,2);assert.match(urls[0],/ogcapi\/v1\/collections\/latest-continuous/);assert.match(urls[1],/start_date=11-26&end_date=11-26/);
  assert.match(urls[1],/monitoring_location_id=USGS-04136500&monitoring_location_id=USGS-04031000/);
 }finally{globalThis.fetch=old;}
});

test('documented string qualifiers preserve unrelated fresh gauge observations',async()=>{
 const mixed=live([feature('00060',null,{qualifier:'SEASONAL'}),feature('00060','29.1',{monitoring_location_id:'USGS-'+other,qualifier:'ESTIMATED'}),feature('00065','2.98',{qualifier:'ICE, ESTIMATED'})]);
 const r=parseLiveObservations(mixed,[id,other],now);
 assert.equal(r[id].flow,null);assert.equal(r[id].observationStates.flow,'seasonal');
 assert.equal(r[other].flow,29.1);assert.deepEqual(r[other].observationQualifiers.flow,['ESTIMATED']);
 assert.deepEqual(r[id].observationQualifiers.gage,['ICE','ESTIMATED']);
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async()=>({ok:true,json:async()=>live(mixed.features.map(f=>({...f,properties:{...f.properties,time:new Date(Date.now()-1000).toISOString()}})))});
  const batch=await fetchLiveReadings([id,other]);
  assert.equal(batch[id].observationStates.flow,'seasonal');assert.equal(batch[other].flow,29.1);
 }finally{globalThis.fetch=original;}
});

test('four Sentinel incident river guides render independently dated measured flow from modern USGS payload',async()=>{
 const {RIVERS}=await import('../lib/rivers.js');
 const {loadPageConditions}=await import('../lib/river-page-data.js');
 const {buildSEOPage}=await import('../api/river/[id].js');
 // Recorded official response, 2026-11-27. This fixture is not live data.
 const samples=[['black-river-up','04031000','29.1','2026-11-27T11:00:00+00:00'],['ausable','04136500','877','2026-11-27T11:30:00+00:00'],['white-river','04122200','315','2026-11-27T11:15:00+00:00'],['tittabawassee-river','04153300','382','2026-11-27T11:00:00+00:00']];
 const observed=parseLiveObservations(live(samples.map(([,gauge,value,t])=>feature('00060',value,{monitoring_location_id:'USGS-'+gauge,time:t}))),samples.map(s=>s[1]),Date.parse('2026-11-27T11:45:00Z'));
 for(const [slug,gauge,value,t] of samples){
  const river=RIVERS.find(r=>r.id===slug);
  assert.equal(river.primaryGauge,gauge);
  const result=await loadPageConditions(gauge,{fetchLiveReadings:async()=>observed,fetchAllStats:async()=>({})});
  assert.equal(result.cfs,Number(value));assert.equal(result.flowTimestamp,new Date(t).toISOString());
  assert.equal(result.rating,null);assert.equal(result.tempC,null);
  const html=buildSEOPage(river,result,[]);
  assert.match(html,/data-conditions-state="partial"/);
  assert.match(html,/cond-label">Flow<\/div><div class="cond-value">[^<]+ cfs/);
  assert.match(html,/measured /);assert.match(html,/Not rated/);
 }
});

test('missing and partial observations never default to a positive fishability rating',async()=>{
 const {buildConditions,rateConditions}=await import('../lib/rater.js');
 for(const reading of [{},{flow:null,temp_c:null,gage:null},{flow:NaN,temp_c:undefined},{flow:500,temp_c:10,observationStates:{flow:'stale',temp_c:'seasonal'}}]){
   const c=buildConditions(reading,{p50:500});
   assert.equal(c.ratingKey,'UNRATED');assert.equal(c.evidenceState,'unavailable');
   assert.equal(c.flow,null);assert.equal(c.tempF,null);
 }
 for(const reading of [{flow:500},{temp_c:10},{gage:2}]){
   const c=buildConditions(reading,{p50:500});
   assert.equal(c.ratingKey,'UNRATED');assert.equal(c.evidenceState,'partial');
 }
 const normal=buildConditions({flow:500,temp_c:10},{p50:500});
 assert.equal(normal.ratingKey,'PRIME');assert.equal(normal.evidenceState,'complete');
 const zero=buildConditions({flow:0},{p50:500});assert.equal(zero.flow,0);assert.equal(zero.flowPct,0);assert.equal(zero.ratingKey,'TOUGH');
 assert.equal(rateConditions(2000,{p50:500},null),'BLOWN_OUT');
 assert.equal(rateConditions(null,{},25),'TOUGH');
 assert.equal(rateConditions(500,{p50:0},10),'UNRATED');
});
