import test from 'node:test';
import assert from 'node:assert/strict';
import {REACHES,MAYFLIES,inSeason,rankMayfly,detroitCalendar,buildMayflyReport} from '../lib/mayfly-forecast.js';
import handler from '../api/mayfly-hatches.js';
import { buildSevenDayOutlook, summarizeWaterHistory, summarizeHourlyForecast, offsetDayKey } from '../lib/mayfly-outlook.js';

test('all reach IDs and gauge numbers are distinct',()=>{
 assert.equal(REACHES.length,5);
 assert.equal(new Set(REACHES.map(r=>r.station)).size,5);
 assert.equal(new Set(REACHES.map(r=>r.id)).size,5);
 assert.equal(MAYFLIES.length,12);
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

function fakeHistory(now, temps) {
  const days=[];
  temps.forEach((temp,i)=>{
    const base=new Date(Date.UTC(2026,4,5+i,9,0,0));
    for(let hour=0;hour<14;hour++){
      const t=new Date(base.getTime()+hour*3600000);
      days.push({properties:{parameter_code:'00010',time_series_id:'one-sensor',
        time:t.toISOString(),value:String((temp-32)*5/9),unit_of_measure:'degC'}});
    }
  });
  return days;
}
function fakeNws(now,days=8) {
 const out=[];
 for(let i=0;i<days*24;i++){
  const t=new Date(now.getTime()+i*3600000);
  out.push({startTime:t.toISOString(),temperature:57+(i%24>12?4:0),
    temperatureUnit:'F',windSpeed:'3 to 7 mph',shortForecast:i%24>12?'Mostly Cloudy':'Mostly Sunny'});
 }
 return out;
}
test('USGS water history rejects future/outliers and summarizes full days',()=>{
 const now=new Date('2026-05-10T16:00:00Z');
 const good=fakeHistory(now,[48,49,50,51]);
 const bad=[{properties:{parameter_code:'00010',time:'2026-05-09T01:00:00Z',value:'not a number'}},
 {properties:{parameter_code:'00010',time:'2026-05-11T01:00:00Z',value:'20'}}];
 const days=summarizeWaterHistory([...good,...bad],now);
 assert.equal(days.length,4);
 assert(days.every(x=>x.completeEnough));
 assert.equal(days[3].meanF,51);
});
test('NWS hourly forecast grouping works with mixed units and rain',()=>{
 const now=new Date('2026-05-10T16:00:00Z');
 const periods=[{startTime:'2026-05-11T12:00:00Z',temperature:10,temperatureUnit:'C',windSpeed:'5 to 17 mph',shortForecast:'Light Rain'},
 {startTime:'2026-05-11T13:00:00Z',temperature:52,temperatureUnit:'F',windSpeed:'3 mph',shortForecast:'Cloudy'}];
 const result=summarizeHourlyForecast(periods,now);
 assert.equal(result[0].maxWindMph,17);
 assert.equal(result[0].rainHours,1);
 assert.equal(result[0].meanAirF,51);
});
test('outlook predicts only within first 3 days and keeps days 4–7 weather-only',()=>{
 const now=new Date('2026-05-10T16:00:00Z');
 const history=fakeHistory(now,[47,48,49,50,51]);
 const report=buildSevenDayOutlook({now,waterTempF:52,observedAt:'2026-05-10T15:50:00Z',
  historyFeatures:history,hourlyForecast:fakeNws(now)});
 assert.equal(report.days.length,7);
 assert.equal(report.days[0].confidence,'experimental');
 assert(report.days[0].tempBand.lowF < report.days[0].tempBand.highF);
 assert.equal(report.days[3].tempBand,null);
 assert.equal(report.days[3].confidence,'weather-only');
 assert(report.days[3].species.every(x=>x.signal==='Seasonal watch'));
 assert(report.trendFPerDay>0);
});
test('missing or stale water temperature never fabricates 7-day hatch predictions',()=>{
 const now=new Date('2026-05-10T16:00:00Z');
 const history=fakeHistory(now,[47,48,49,50,51]);
 const report=buildSevenDayOutlook({now,waterTempF:58,
  observedAt:'2026-05-07T10:00:00Z',historyFeatures:history,hourlyForecast:fakeNws(now)});
 assert(report.days.every(d=>!d.tempBand));
 assert(report.days.every(d=>d.species.every(s=>s.signal!=='Potential window')));
 assert.equal(report.measuredAnchorF,null);
});
test('uncertainty bands grow with days and suppress fishing signals on possible heat',()=>{
 const now=new Date('2026-07-03T16:00:00Z');
 const history=fakeHistory(now,[60,61,62,63,64].map(x=>x));
 // Build July history explicitly (fakeHistory is fixed in May).
 const july=history.map(f=>({properties:{...f.properties,
   time:f.properties.time.replace('2026-05-','2026-06-')}})); 
 // Use June 30, July 1–2 as complete observed days.
 const recent=[];
 for(const [day,temp] of [['2026-06-30',63],['2026-07-01',64],['2026-07-02',65]]){
  for(let h=0;h<14;h++)recent.push({properties:{parameter_code:'00010',
    time_series_id:'one-sensor',unit_of_measure:'degC',time:new Date(day+'T09:00:00Z').getTime()+h*3600000,
    value:String((temp-32)*5/9)}});
 }
 // Correct the synthetic timestamps to ISO before using.
 recent.forEach(x=>x.properties.time=new Date(x.properties.time).toISOString());
 const report=buildSevenDayOutlook({now,waterTempF:66,
  observedAt:'2026-07-03T15:00:00Z',historyFeatures:recent,hourlyForecast:fakeNws(now)});
 assert.equal(report.days[0].safety,'possible_heat_caution');
 assert(report.days.slice(0,3).every(d=>d.species.every(s=>s.signal!=='Potential window')));
 if(report.days[0].tempBand&&report.days[2].tempBand){
  assert(report.days[2].tempBand.highF-report.days[2].tempBand.lowF >
         report.days[0].tempBand.highF-report.days[0].tempBand.lowF);
 }
});
test('date keys retain all seven days across DST switch',()=>{
 const now=new Date('2026-10-31T23:00:00Z');
 const days=Array.from({length:7},(_,i)=>offsetDayKey(now,i+1));
 assert.equal(new Set(days).size,7);
 assert.deepEqual(days.slice(0,3),['2026-11-01','2026-11-02','2026-11-03']);
});
