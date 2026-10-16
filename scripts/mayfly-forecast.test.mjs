import test from 'node:test';
import assert from 'node:assert/strict';
import {REACHES,MAYFLIES,inSeason,rankMayfly,detroitCalendar,buildMayflyReport} from '../lib/mayfly-forecast.js';
import handler from '../api/mayfly-hatches.js';

test('all reach IDs and gauge numbers are distinct',()=>{
 assert.equal(REACHES.length,5);
 assert.equal(new Set(REACHES.map(r=>r.station)).size,5);
 assert.equal(new Set(REACHES.map(r=>r.id)).size,5);
 assert.equal(MAYFLIES.length,10);
});
test('season gates handle spring, fall, and off-season',()=>{
 const bwo=MAYFLIES.find(s=>s.id==='bwo');
 assert.equal(inSeason(bwo,10,15),true);
 assert.equal(inSeason(bwo,7,15),false);
 const hex=MAYFLIES.find(s=>s.id==='hex');
 assert.equal(inSeason(hex,7,1),true);
 assert.equal(rankMayfly(hex,{month:10,day:15,waterTempF:64}).signal,'Off season');
});
test('missing measured water never yields favorable hatch',()=>{
 const s=MAYFLIES.find(s=>s.id==='hendrickson');
 assert.equal(rankMayfly(s,{month:5,day:6,waterTempF:null}).signal,'Temperature unavailable');
 assert.equal(rankMayfly(s,{month:5,day:6,waterTempF:53,windMph:3}).signal,'Conditions favorable');
 assert.equal(rankMayfly(s,{month:5,day:6,waterTempF:69,windMph:3}).signal,'Trout heat caution');
});
test('rendered model respects Detroit local calendar',()=>{
 const date=new Date('2026-05-01T02:00:00Z'); // April 30 10pm EDT
 const local=detroitCalendar(date);
 assert.deepEqual(local,{year:2026,month:4,day:30});
 const report=buildMayflyReport({reach:REACHES[0],now:date,waterTempF:null});
 assert.equal(report.month,4);
 assert.equal(report.species.filter(s=>s.signal==='Conditions favorable').length,0);
});
test('handler declines invalid reach rather than querying arbitrary stations',async()=>{
 const res={code:0,status(v){this.code=v;return this;},setHeader(){},json(v){this.body=v;return this;}};
 await handler({method:'GET',query:{reach:'unknown'}},res);
 assert.equal(res.code,400);
});
test('handler uses modern USGS API, preserves timestamps, and marks outages unknown',async()=>{
 const old=globalThis.fetch;
 const original=new Date();
 const ts=new Date(original.getTime()-10*60_000).toISOString();
 const urls=[];
 globalThis.fetch=async url=>{
  urls.push(String(url));
  const u=String(url);
  const isTemp=u.includes('parameter_code=00010'), isFlow=u.includes('parameter_code=00060');
  let payload;
  if(isTemp||isFlow)payload={features:[{properties:{parameter_code:isTemp?'00010':'00060',value:isTemp?'12':'210',time:ts}}]};
  else if(u.includes('/points/'))payload={properties:{forecastHourly:'https://api.weather.gov/gridpoints/APX/78,45/forecast/hourly'}};
  else payload={properties:{periods:[{shortForecast:'Mostly Cloudy',windSpeed:'4 mph',startTime:ts}]}};
  return {ok:true,json:async()=>payload};
 };
 try{
  const res={code:0,status(v){this.code=v;return this;},setHeader(){},json(v){this.body=v;return this;}};
  await handler({method:'GET',query:{reach:'north-branch'}},res);
  assert.equal(res.code,200);
  assert.equal(res.body.waterTempF,53.6);
  assert.equal(res.body.flowCfs,210);
  assert.equal(res.body.temperatureSource,'USGS measured (provisional)');
  assert(urls.some(u=>u.includes('api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items')));
  assert(!urls.some(u=>u.includes('waterservices.usgs.gov')));
  const stale=new Date(Date.now()-4*86400_000).toISOString();
  globalThis.fetch=async url=>{
   const u=String(url);
   if(u.includes('api.waterdata.usgs.gov'))return {ok:true,json:async()=>({features:[{properties:{parameter_code:'00010',value:'18',time:stale}}]})};
   throw new Error('NWS down');
  };
  const res2={code:0,status(v){this.code=v;return this;},setHeader(){},json(v){this.body=v;return this;}};
  await handler({method:'GET',query:{reach:'north-branch'}},res2);
  assert.equal(res2.code,200);
  assert.equal(res2.body.waterTempF,null);
  assert.equal(res2.body.dataQuality.waterTemp,'unavailable');
  assert.equal(res2.body.species.some(s=>s.signal==='Conditions favorable'),false);
 }finally{globalThis.fetch=old;}
});
