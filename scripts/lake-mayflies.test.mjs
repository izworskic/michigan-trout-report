import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {LAKE_REGIONS, parseNdbcStandard,lakeMetrics,extractLakeEvenings,
 buildLakeHexReport,isLakeSeason,dateAfter} from '../lib/lake-mayflies.js';
import handler,{eveningForecast} from '../api/lake-mayflies.js';
const NOW=new Date('2026-06-23T00:00:00Z'); // June 22 at 8 PM EDT
function stationRow({d='2026 06 22 23 50',temp='20.0',wind='3.0',wave='0.2'}={}){
 return d+' 210 '+wind+' 4.0 '+wave+' 3 MM 210 1015.0 21.0 '+temp+' MM MM MM MM';
}
function dataset(rows){return '#YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS PTDY TIDE\n'
 +'#yr mo dy hr mn degT m/s m/s m sec sec degT hPa degC degC degC nmi hPa ft\n'
 +rows.join('\n')+'\n';}
test('two lake regions have distinct verifiable NOAA buoy identifiers',()=>{
 assert.deepEqual(LAKE_REGIONS.map(x=>x.station),['45163','45165']);
 assert(LAKE_REGIONS.every(x=>x.stationURL.includes(x.station)));
});
test('NOAA NDBC fixed positions parse surface temperature correctly and reject MM',()=>{
 const lines=[
  stationRow(),stationRow({d:'2026 06 22 23 40',temp:'MM'}),
  stationRow({d:'2026 06 22 23 20',temp:'19.5'}),
  stationRow({d:'2026 06 22 23 20',temp:'19.5'}),
  stationRow({d:'2026 06 22 23 10',temp:'80'}),
  stationRow({d:'2026 07 22 23 00',temp:'20.5'}),
 ];
 const actual=parseNdbcStandard(dataset(lines),'45165',NOW);
 assert.equal(actual.length,4);
 assert.equal(actual[0].waterF,68);
 assert.equal(actual[0].windMph,6.7);
 assert.equal(actual[1].waterF,null);
 assert.equal(actual[2].waterF,67.1);
 assert.equal(actual[3].waterF,null);
});
test('season and daylight saving observe eastern local dates',()=>{
 assert.equal(isLakeSeason(new Date('2026-06-01T02:00:00Z')),false);
 assert.equal(isLakeSeason(new Date('2026-06-01T06:00:00Z')),true);
 assert.equal(dateAfter(new Date('2026-10-31T23:50:00Z'),1),'2026-11-01');
});
test('fresh water is required; old/future values cannot produce a positive signal',()=>{
 const old=new Date('2026-05-12T12:00:00Z');
 const rows=parseNdbcStandard(dataset([stationRow({d:'2026 06 22 23 50',temp:'20.0'})]),'45165',NOW);
 const good=buildLakeHexReport({region:LAKE_REGIONS[1],now:NOW,observations:rows});
 assert.equal(good.metrics.waterTempF,68);
 assert.equal(good.status,'Surface threshold reached');
 const stale=buildLakeHexReport({region:LAKE_REGIONS[1],now:new Date('2026-06-26T12:00:00Z'),observations:rows});
 assert.equal(stale.metrics.waterTempF,null);
 assert.equal(stale.status,'Water sensor unavailable');
 const noSensor=buildLakeHexReport({region:LAKE_REGIONS[0],now:NOW,observations:[]});
 assert.equal(noSensor.status,'Water sensor unavailable');
});
test('wind and rain affect evening watch only when fresh 68 degree observation exists',()=>{
 const hours=[];
 for(let h=18;h<=23;h++){
  hours.push({startTime:'2026-06-22T'+(h+4<24?h+4:('0'+(h+4-24)).slice(-2))+':00:00Z',
   windSpeed:'4 mph',shortForecast:'Clear'});
 }
 // Explicit UTC offsets at 22, 23, 00, 01, 02, 03 for EDT 18–23.
 const corrected=[22,23,0,1,2,3].map((h,i)=>({startTime:'2026-06-'+(h<22?'23':'22')+'T'+String(h).padStart(2,'0')+':00:00Z',
  windSpeed:'4 mph',shortForecast:'Clear'}));
 const nights=extractLakeEvenings(corrected,NOW);
 assert.equal(nights[0].coverageHours,5); // includes one hour lookback plus evening forecast hours
 const rows=parseNdbcStandard(dataset([stationRow()]),'45165',NOW);
 const good=buildLakeHexReport({region:LAKE_REGIONS[1],now:NOW,observations:rows,hourlyForecast:corrected});
 assert.equal(good.evenings[0].signal,'Conditions worth watching');
 const noWater=buildLakeHexReport({region:LAKE_REGIONS[0],now:NOW,observations:[],hourlyForecast:corrected});
 assert.equal(noWater.evenings[0].signal,'Water data missing');
});
test('outside summer never calls a warm lake an emerging hatch',()=>{
 const now=new Date('2026-10-16T02:20:00Z');
 const rows=parseNdbcStandard(dataset([stationRow({d:'2026 10 16 02 10',temp:'21'})]),'45165',now);
 const report=buildLakeHexReport({region:LAKE_REGIONS[1],now,observations:rows});
 assert.equal(report.status,'Off season');
 assert(report.evenings.every(e=>e.signal==='Off season'));
});
test('API safely reports offline station with partial sources and no invented temperatures',async()=>{
 const oldFetch=globalThis.fetch; const now=new Date();
 const realDate=new Date(now.getTime()-300000).toISOString().split(/[-T:.Z]/);
 const yyyy=realDate[0],mo=realDate[1],dd=realDate[2],hh=realDate[3],mm=realDate[4];
 globalThis.fetch=async url=>{
  url=String(url);
  if(url.includes('/45163.txt'))throw Error('Seasonal station offline');
  if(url.includes('api.weather.gov/points/'))return {ok:true,text:async()=>JSON.stringify({properties:{forecastHourly:'https://api.weather.gov/gridpoints/DTX/1,2/forecast/hourly'}})};
  if(url.includes('/forecast/hourly'))return {ok:true,text:async()=>JSON.stringify({properties:{periods:[]}})};
  throw Error('Unexpected '+url);
 };
 try {
  const res={code:0,setHeader(){},status(x){this.code=x;return this;},json(x){this.body=x;return this;}};
  await handler({method:'GET',query:{region:'saginaw-bay'}},res);
  assert.equal(res.code,200);
  assert.equal(res.body.success,true);
  assert.equal(res.body.partial,true);
  assert.equal(res.body.metrics.waterTempF,null);
  assert.equal(res.body.sourceHealth.buoyRequest,'unavailable');
 }finally{globalThis.fetch=oldFetch;}
});
test('UI has both independent lake selectors, a CARTO map and parsable browser JS',()=>{
 const html=readFileSync('public/great-lakes-mayflies.html','utf8');
 for(const id of ['lakeMap','status','regionCaveat','waterTemp','trendChart','eveningDays','regions']){
  assert(html.includes('id="'+id+'"'));
 }
 assert(html.includes('basemaps.cartocdn.com'));
 assert(html.includes('/api/lake-mayflies?region='));
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m=>!/src=/i.test(m[1])&&!/application\/ld\+json/i.test(m[1]));
 assert(scripts.length);
 scripts.forEach(s=>assert.doesNotThrow(()=>new Script(s[2])));
});

test('NWS forecast request uses working shoreline grid instead of unsupported open-water grid',async()=>{
 const oldFetch=globalThis.fetch,seen=[];
 globalThis.fetch=async url=>{
  const u=String(url);seen.push(u);
  if(u.includes('/points/'))return {ok:true,text:async()=>JSON.stringify({properties:{
   forecastHourly:'https://api.weather.gov/gridpoints/DTX/32,90/forecast/hourly'}})};
  if(u.includes('/forecast/hourly'))return {ok:true,text:async()=>JSON.stringify({properties:{periods:[{startTime:'2026-06-22T23:00:00Z',windSpeed:'6 mph',shortForecast:'Clear'}]}})};
  throw Error('Unexpected '+u);
 };
 try{
  const hours=await eveningForecast(LAKE_REGIONS[0]);
  assert.equal(hours.length,1);
  assert(seen.includes('https://api.weather.gov/points/43.6,-83.89'));
  assert(!seen.some(u=>u.includes('/points/43.983,-83.6')));
 }finally{globalThis.fetch=oldFetch;}
});
