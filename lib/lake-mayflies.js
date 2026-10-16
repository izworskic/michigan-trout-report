// Great Lakes nearshore Hexagenia environmental watch, v1.
// Separate from Au Sable trout-river hatch forecasts.
// Michigan Sea Grant: western Lake Erie shallow sediment can reach 20 C
// within days after surface temperature reaches it; not a universal Hex
// threshold and never a verified sighting or abundance estimate.
// https://www.michiganseagrant.org/blog/2024/03/11/when-will-the-mayflies-arrive/
export const LAKE_REGIONS=Object.freeze([
  {id:'saginaw-bay',name:'Saginaw Bay',lake:'Lake Huron',station:'45163',
    stationName:'Saginaw Bay Buoy',lat:43.983,lon:-83.600,
    weatherLat:43.60,weatherLon:-83.89,weatherProxy:'Bay City shoreline',
    stationURL:'https://www.ndbc.noaa.gov/station_page.php?station=45163',
    caveat:'This seasonal buoy may be removed or offline. Bay-wide temperatures and current Hex populations are not measured by this single location.',
    habitat:'Historically documented burrowing mayflies in Saginaw Bay; current abundance cannot be inferred from this tracker.'},
  {id:'western-erie',name:'Western Lake Erie',lake:'Lake Erie',station:'45165',
    stationName:'Toledo Water Intake Buoy',lat:41.702,lon:-83.262,
    weatherLat:41.65,weatherLon:-83.54,weatherProxy:'Toledo shoreline',
    stationURL:'https://www.ndbc.noaa.gov/station_page.php?station=45165',
    caveat:'This sensor measures surface water at the Toledo intake buoy; it does not measure lakebed temperature or every shoreline.',
    habitat:'Burrowing mayflies documented in western Erie; their abundance and presence vary with sediment quality and bottom oxygen.'}
]);
const DAY=86400000;
const round=(v,n=1)=>Math.round(v*10**n)/10**n;
export const SEA_GRANT_REFERENCE='https://www.michiganseagrant.org/blog/2024/03/11/when-will-the-mayflies-arrive/';
export function localParts(date) {
 const pieces=new Intl.DateTimeFormat('en-US',{timeZone:'America/Detroit',
  year:'numeric',month:'numeric',day:'numeric',hour:'numeric',hourCycle:'h23'}).formatToParts(date);
 return Object.fromEntries(pieces.filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
}
function dateKey(date){const p=localParts(date);return p.year+'-'+String(p.month).padStart(2,'0')+'-'+String(p.day).padStart(2,'0');}
export function dateAfter(now,n) {
 const p=localParts(now);
 return new Date(Date.UTC(p.year,p.month-1,p.day+n,12)).toISOString().slice(0,10);
}
export function isLakeSeason(date){
 const p=localParts(date);
 return p.month>=6&&p.month<=8; // broad June–August guide, not a prediction
}
function validNumber(raw,lo,hi){
 if(raw==='MM'||raw==='99'||raw==='999'||raw==='9999'||raw===undefined) return null;
 const n=Number(raw);return Number.isFinite(n)&&n>=lo&&n<=hi?n:null;
}
// NOAA NDBC standard MET text: #YY MM DD hh mm WDIR WSPD GST WVHT DPD APD
// MWD PRES ATMP WTMP DEWP VIS PTDY TIDE; unit line has metric degC, m/s, m.
export function parseNdbcStandard(text,station,now=new Date()){
 if(typeof text!=='string'||!text.startsWith('#'))return [];
 const rows=[];
 const lines=text.split(/\r?\n/);
 for(const line of lines.slice(2,15000)){
  if(!line||line.startsWith('#'))continue;
  const a=line.trim().split(/\s+/);
  if(a.length<16)continue;
  const [year,month,day,hour,min]=a.slice(0,5).map(Number);
  if(!Number.isInteger(year)||year<2020||year>2100||month<1||month>12||day<1||day>31||hour<0||hour>23||min<0||min>59)continue;
  const date=new Date(Date.UTC(year,month-1,day,hour,min));
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)continue;
  const age=now.getTime()-date.getTime();if(age<0||age>6*DAY)continue;
  const waterC=validNumber(a[14],-2,35);
  const windMs=validNumber(a[6],0,45);
  const gustMs=validNumber(a[7],0,55);
  const waveM=validNumber(a[8],0,15);
  const dir=validNumber(a[5],0,360);
  rows.push({at:date.toISOString(),waterF:waterC===null?null:round(waterC*9/5+32),
    windMph:windMs===null?null:round(windMs*2.23694),
    gustMph:gustMs===null?null:round(gustMs*2.23694),
    waveFt:waveM===null?null:round(waveM*3.28084),
    windDir:dir===null?null:dir,station});
 }
 rows.sort((a,b)=>b.at.localeCompare(a.at));
 const unique=new Set();
 return rows.filter(x=>{if(unique.has(x.at))return false;unique.add(x.at);return true;});
}
export function lakeMetrics(rows,now=new Date()){
 const r=rows.filter(x=>Number.isFinite(x.waterF)&&now.getTime()-Date.parse(x.at)>=0);
 const latest=r[0]||null;
 const waterFresh=latest&&now.getTime()-Date.parse(latest.at)<=36*3600000;
 const waterTempF=waterFresh?latest.waterF:null;
 const weather=rows.find(x=>now.getTime()-Date.parse(x.at)>=0 && now.getTime()-Date.parse(x.at)<=36*3600000 && Number.isFinite(x.windMph));
 const days=new Map();
 for(const row of r){const key=dateKey(new Date(row.at));if(!days.has(key))days.set(key,[]);days.get(key).push(row.waterF);}
 const history=[...days].sort((a,b)=>a[0].localeCompare(b[0])).slice(-6).map(([date,temps])=>
  ({date,meanF:round(temps.reduce((a,b)=>a+b,0)/temps.length),
    minF:Math.min(...temps),maxF:Math.max(...temps),samples:temps.length}));
 const complete=history.filter(x=>x.samples>=4 && x.date<dateKey(now));
 const rise=complete.length>=2?round(complete.at(-1).meanF-complete.at(-2).meanF):null;
 const earlier=complete.filter(x=>x.meanF>=68);
 const recentThreshold=earlier.some(x=>Date.parse(dateKey(now)+'T12:00:00Z')-Date.parse(x.date+'T12:00:00Z')<=5*DAY);
 return {waterTempF,measuredAt:waterFresh?latest.at:null,history,
  latestObservedAt:latest?.at||null,waterAvailability:!latest?'no temperature observations':
    waterFresh?'fresh measured':'stale water observations',
  surfaceCrossed68:waterFresh&&waterTempF>=68,recentThreshold:waterFresh&&recentThreshold,
  trendF:rise,windMph:weather?.windMph??null,waveFt:weather?.waveFt??null,windDir:weather?.windDir??null,
  observationCount:rows.length};
}
export function extractLakeEvenings(periods,now=new Date()){
 const nextDates=Array.from({length:7},(_,i)=>dateAfter(now,i));
 const byDate=new Map(nextDates.map(d=>[d,[]]));
 for(const period of Array.isArray(periods)?periods:[]){
  const instant=new Date(period.startTime);
  if(!Number.isFinite(instant.getTime()))continue;
  const p=localParts(instant);const key=dateKey(instant);
  // 18:00–23:00 ET is a broad evening window; NOT an exact hatch time.
  if(p.hour<18||p.hour>23||!byDate.has(key)||instant<new Date(now.getTime()-3600000))continue;
  const matches=String(period.windSpeed||'').match(/\d+(?:\.\d+)?/g)||[];
  const wind=matches.length?Math.max(...matches.map(Number)):null;
  const text=String(period.shortForecast||'');
  byDate.get(key).push({wind,text,at:period.startTime,
    rain:/rain|shower|thunder|storm|snow/i.test(text)});
 }
 return nextDates.map((date,index)=>{
  const hours=byDate.get(date);
  const windReadings=hours.map(x=>x.wind).filter(Number.isFinite);
  return {date,dayOffset:index,coverageHours:hours.length,
    maxEveningWindMph:windReadings.length?Math.max(...windReadings):null,
    wetHours:hours.filter(x=>x.rain).length,
    forecastText:hours[0]?.text||null};
 });
}
export function buildLakeHexReport({region,now=new Date(),observations=[],hourlyForecast=[],sources={}}){
 const metrics=lakeMetrics(observations,now);
 const season=isLakeSeason(now);
 const recent=metrics.waterTempF!==null;
 let status,detail,rank=0;
 if(!season){status='Off season';detail='Summer emergence season has passed; no current Hex hatch claim.';}
 else if(!recent){status='Water sensor unavailable';detail='A fresh water-temperature reading is required. Do not infer emergence from calendar or weather alone.';}
 else if(metrics.waterTempF<64){status='Not at thermal trigger';detail='Buoy surface water remains below the early-summer warming range; lakebed temperatures are unknown.';rank=1;}
 else if(metrics.waterTempF<68){status='Approaching 68°F';detail='Surface water is warming toward the Sea Grant 20°C benchmark. This is a watch, not emergence confirmation.';rank=2;}
 else if(metrics.recentThreshold){status='Thermal watch';detail='Surface water is at or above 68°F with recent warm observations. Bottom-water temperature and nymph presence remain unverified.';rank=3;}
 else {status='Surface threshold reached';detail='Measured surface water is at or above 68°F. Lakebed warming may lag by days. This does not confirm a hatch.';rank=3;}
 const evenings=extractLakeEvenings(hourlyForecast,now).map(d=>{
  let signal='Seasonal reference',explanation='Typical emergence season only. No current hatch claim.';
  if(!isLakeSeason(new Date(d.date+'T12:00:00Z'))){signal='Off season';explanation='Outside broad regional June–August emergence window.';}
  else if(!recent){signal='Water data missing';explanation='No fresh measured surface water temperature at this buoy.';}
  else if(d.coverageHours<3||d.maxEveningWindMph===null){signal='Evening forecast unavailable';explanation='NWS coverage insufficient to evaluate this evening.';}
  else if(d.dayOffset>1){signal='Weather watch only';explanation='Long-range forecasted wind, not forecasted water temperature or hatch emergence.';}
  else if(metrics.waterTempF<68){signal='Thermal buildup';explanation='The last measured surface temperature has not yet reached the 68°F watch marker.';}
  else if(d.maxEveningWindMph<=12 && d.wetHours<=1){
    signal='Conditions worth watching';
    explanation='Fresh surface water is at the 68°F marker; light evening winds may favor visible swarms. Neither lakebed temperatures nor mayfly presence are confirmed.';
  }else{signal='Wind / weather limiting';explanation='Surface thermal watch is active, but wind or precipitation may change where swarms are visible.';}
  return {...d,signal,explanation};
 });
 return {region,generatedAt:now.toISOString(),status,detail,rank,seasonActive:season,
  metrics,evenings,
  confidence:'Environmental watch only — no direct nymph sample, lakebed temperature, swarm count or calibrated likelihood. The NWS evening weather source is a shoreline point, not offshore conditions.',
  sourceHealth:{buoy:metrics.waterAvailability,weather:hourlyForecast.length?'NWS hourly forecast':'unavailable',...sources},
  biology:{taxon:'Hexagenia spp. (burrowing mayflies)',season:'June–August (broad reference)',thermalReferenceF:68,lag:'Several days from surface warming to sediment warming in shallow western Lake Erie; not verified for Saginaw Bay',presence:'Unknown — this model does not estimate population density'},
  provenance:[SEA_GRANT_REFERENCE,'https://www.usgs.gov/publications/burrowing-mayflies-indicators-ecosystem-health-status-populations-western-lake-erie'],
 };
}
