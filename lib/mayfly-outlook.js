// Au Sable next-week MAYFLY WATCH. Exploratory, uncalibrated scenario
// envelopes built from measured USGS water history + NWS forecast air temps.
// Only days 1–3 receive modeled water bands. Days 4–7 are WEATHER WATCHES,
// NEVER a claim that a given river water temperature or hatch is forecast.
// No species-specific degree-day thresholds have been scientifically validated.
import { MAYFLIES, detroitCalendar, inSeason } from './mayfly-forecast.js';

const DAY=86400000;
const round=(x,n=1)=>Math.round(x*10**n)/10**n;
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
export function dayKey(date) {
  const {year,month,day}=detroitCalendar(date);
  return year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
export function offsetDayKey(now,i) {
  const {year,month,day}=detroitCalendar(now);
  // At 12Z these UTC calendar dates are unambiguous, even across EDT/EST.
  const iso=new Date(Date.UTC(year,month-1,day+i,12)).toISOString();
  return iso.slice(0,10);
}
function nextDayTime(day) { return Date.parse(day+'T12:00:00Z'); }
function isFiniteReading(p) {
  const t=Date.parse(p?.time||''), c=Number(p?.value);
  return Number.isFinite(t)&&p?.parameter_code==='00010'&&Number.isFinite(c)
   &&c>=-1&&c<=35&&(!p.unit_of_measure||p.unit_of_measure==='degC');
}
export function summarizeWaterHistory(features, now=new Date()) {
  const sorted=(Array.isArray(features)?features:[])
    .map(x=>x?.properties||x)
    .filter(isFiniteReading)
    .filter(p=>{ const age=now.getTime()-Date.parse(p.time);return age>=0&&age<=8*DAY; });
  // In case a gauge exposes parallel series, use one stream consistently.
  const counts=new Map();
  sorted.forEach(p=>counts.set(p.time_series_id||'default',(counts.get(p.time_series_id||'default')||0)+1));
  const source=[...counts].sort((a,b)=>b[1]-a[1])[0]?.[0];
  const byDate=new Map();
  const seen=new Set();
  for(const p of sorted) {
    if((p.time_series_id||'default')!==source||seen.has(p.time)) continue;
    seen.add(p.time);
    const key=dayKey(new Date(p.time));
    const record=byDate.get(key)||[];
    record.push({time:Date.parse(p.time),fahrenheit:Number(p.value)*9/5+32});
    byDate.set(key,record);
  }
  const days=[...byDate].sort(([a],[b])=>a.localeCompare(b)).map(([date,readings])=>{
    readings.sort((a,b)=>a.time-b.time);
    const temps=readings.map(x=>x.fahrenheit);
    const coveredHours=(readings.at(-1).time-readings[0].time)/3600000;
    return {
      date,meanF:round(temps.reduce((a,b)=>a+b,0)/temps.length),
      minF:round(Math.min(...temps)),maxF:round(Math.max(...temps)),
      samples:readings.length,coveredHours:round(coveredHours),
      completeEnough:readings.length>=12&&coveredHours>=8,
    };
  });
  return days.slice(-8);
}
export function summarizeHourlyForecast(periods, now=new Date()) {
  const grouped=new Map();
  const good=(Array.isArray(periods)?periods:[]).filter(p=>{
    const t=Date.parse(p?.startTime||'');
    return Number.isFinite(t) && t>=now.getTime()-3600000 && t<=now.getTime()+8*DAY;
  });
  for (const p of good) {
    const key=dayKey(new Date(p.startTime));
    const f=p.temperatureUnit==='C'?Number(p.temperature)*9/5+32:Number(p.temperature);
    if(!Number.isFinite(f)||f< -50||f>120) continue;
    const winds=(String(p.windSpeed||'').match(/\d+(?:\.\d+)?/g)||[]).map(Number);
    const text=String(p.shortForecast||'');
    const x=grouped.get(key)||{temps:[],winds:[],rainHours:0,cloudHours:0,texts:[]};
    x.temps.push(f);
    if(winds.length)x.winds.push(Math.max(...winds));
    if(/rain|shower|thunder|drizzle|snow/i.test(text))x.rainHours++;
    if(/cloud|overcast|rain|showers|snow/i.test(text))x.cloudHours++;
    if(text)x.texts.push(text);
    grouped.set(key,x);
  }
  const data=[...grouped].map(([date,v])=>{
    const freq=new Map();v.texts.forEach(t=>freq.set(t,(freq.get(t)||0)+1));
    const headline=[...freq].sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
    return {date,forecastHours:v.temps.length,meanAirF:round(v.temps.reduce((a,b)=>a+b,0)/v.temps.length),
      minAirF:round(Math.min(...v.temps)),maxAirF:round(Math.max(...v.temps)),
      maxWindMph:v.winds.length?Math.max(...v.winds):null,
      rainHours:v.rainHours,cloudHours:v.cloudHours,weather:headline};
  });
  return data.sort((a,b)=>a.date.localeCompare(b.date));
}
function trendFromHistory(history,now) {
  const previous=history.filter(d=>d.completeEnough && d.date<dayKey(now));
  const last=previous.slice(-3);
  if(last.length<3) return null;
  if(nextDayTime(dayKey(now))-nextDayTime(last.at(-1).date)>2*DAY) return null;
  const span=(nextDayTime(last.at(-1).date)-nextDayTime(last[0].date))/DAY;
  if(span<2||span>5) return null;
  return clamp((last.at(-1).meanF-last[0].meanF)/span,-2,2);
}
function speciesForDay(date,band,forecast,dayNumber,heat) {
  const [year,month,day]=date.split('-').map(Number);
  const eligible=MAYFLIES.filter(s=>inSeason(s,month,day));
  if(!eligible.length)return [];
  return eligible.map(s=>{
    if(dayNumber>3||!band) return {id:s.id,name:s.name,fly:s.fly,time:s.time,signal:'Seasonal watch',order:1,
      reason:'Regional season window only; long-range river temperature has not been modeled.'};
    if(heat||band.highF>=68) return {id:s.id,name:s.name,fly:s.fly,time:s.time,signal:'Heat risk',order:0,
      reason:'A measured or plausible modeled river temperature reaches 68°F. No trout-fishing recommendation.'};
    if(band.lowF>s.water[1]||band.highF<s.water[0])
      return {id:s.id,name:s.name,fly:s.fly,time:s.time,signal:'Temperature unlikely',order:0,
        reason:'The water-temperature scenario band does not overlap this mayfly group.'};
    const wind=forecast?.maxWindMph;
    const gusty=Number.isFinite(wind)&&wind>15;
    const inside=band.lowF>=s.water[0]&&band.highF<=s.water[1];
    const calm=Number.isFinite(wind)&&wind<=12;
    const rainy=(forecast?.rainHours||0)>6;
    const label=inside&&calm&&!rainy?'Potential window':'Variable window';
    return {id:s.id,name:s.name,fly:s.fly,time:s.time,signal:label,
      order:label==='Potential window'?4:3,
      reason:(inside?'Entire temperature scenario fits. ':'Temperature scenario overlaps. ')
        +(gusty?'Wind may limit surface activity. ':rainy?'Rain may affect surface activity. ':'')
        +'This is not a confirmed hatch or calibrated probability.'};
  }).sort((a,b)=>b.order-a.order||a.name.localeCompare(b.name));
}
export function buildSevenDayOutlook({
 now=new Date(),waterTempF=null,observedAt=null,historyFeatures=[],
 hourlyForecast=[],weatherGeneratedAt=null
}={}) {
 const history=summarizeWaterHistory(historyFeatures,now);
 const hourly=summarizeHourlyForecast(hourlyForecast,now);
 const byDate=new Map(hourly.map(x=>[x.date,x]));
 const recentTrend=trendFromHistory(history,now);
 const stamp=Date.parse(observedAt||'');
 const recent=Number.isFinite(stamp)&&stamp<=now.getTime()&&now.getTime()-stamp<=36*3600000;
 const anchor=recent&&Number.isFinite(waterTempF)?waterTempF:null;
 const baseAir=hourly.filter(x=>x.forecastHours>=6).slice(0,2);
 const initialAir=baseAir.length?baseAir[0].meanAirF:null;
 const canModel=anchor!==null&&recentTrend!==null&&initialAir!==null;
 const days=[];
 for(let n=1;n<=7;n++) {
  const date=offsetDayKey(now,n),weather=byDate.get(date)||null;
  const forecastReady=weather!==null&&weather.forecastHours>=6;
  let tempBand=null;
  if(n<=3&&canModel&&forecastReady) {
    // Experimental bounded scenario: 3-day measured warming/cooling momentum,
    // damped quickly, with small NWS air anomaly response. NOT calibrated.
    const center=anchor+clamp(recentTrend*.65*n,-3.5,3.5)
       +clamp((weather.meanAirF-initialAir)*.11,-2,2);
    const uncertainty=1.8+n*1.05;
    tempBand={lowF:round(center-uncertainty),highF:round(center+uncertainty),
      centerF:round(center),kind:'experimental_water_scenario_not_forecast'};
  }
  const heat=anchor!==null&&anchor>=68;
  const species=forecastReady?speciesForDay(date,tempBand,weather,n,heat):[];
  const window=species.filter(s=>s.order>=3).length;
  days.push({
    date,dayNumber:n,confidence:!forecastReady?'unavailable':n>3?'weather-only':tempBand?'experimental':'season-only',
    weather:forecastReady?weather:null,tempBand,
    species:species.slice(0,4),
    potentialCount:n<=3?window:0,
    safety:heat?'measured_heat_caution':tempBand&&tempBand.highF>=68?'possible_heat_caution':'none',
    headline:!forecastReady?'Forecast not available'
      :heat?'Trout heat caution'
      :n>3?'Long-range seasonal watch'
      :!tempBand?'Seasonal context only'
      :species.some(s=>s.signal==='Potential window')?'Potential hatch conditions'
      :species.some(s=>s.signal==='Variable window')?'Conditions mixed'
      :'No clear hatch window',
  });
 }
 const recentObserved=history.filter(d=>d.completeEnough).slice(-3);
 return {
  version:'v2-experimental',
  confidence:canModel?'Experimental water scenario for days 1–3; weather watch for days 4–7'
    :'Seven-day weather and seasonal context only; no water projection',
  history, trendFPerDay:recentTrend===null?null:round(recentTrend,2),
  recentWaterDays:recentObserved.length,
  weatherGeneratedAt,
  forecastDaysAvailable:days.filter(d=>d.weather).length,
  measuredAnchorF:anchor,
  days,
  method:'First three days: live measured water temperature, recent daily water-temperature trend and damped forecast-air anomalies; uncertainty increases each day. Days four through seven: NWS weather and regional seasonal windows only. This is an uncalibrated experimental indicator, not a hatch or water-temperature forecast.',
  sources:{water:'USGS continuous water-temperature observations',weather:'NWS forecast hourly periods'},
 };
}
