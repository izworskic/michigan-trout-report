// GET /api/mayfly-hatches?reach=north-branch
// Au Sable-specific first release. Uses the modern USGS OGC continuous API,
// never the retiring waterservices.usgs.gov endpoint.
import { REACHES, buildMayflyReport } from '../lib/mayfly-forecast.js';

const ENDPOINT='https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items';
const NWS='https://api.weather.gov';
const AGENT='MichiganTroutReport/1.0 (https://michigantroutreport.com)';
async function json(url, ms=8500) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  try {
    const response=await fetch(url,{headers:{Accept:'application/geo+json, application/json;q=0.9','User-Agent':AGENT},signal:controller.signal});
    if(!response.ok) throw new Error('HTTP '+response.status);
    return await response.json();
  } finally { clearTimeout(timer); }
}
function newest(features, code) {
  return (features||[])
    .filter(f=>String(f.properties?.parameter_code)===code)
    .filter(f=>Number.isFinite(Number(f.properties?.value)))
    .sort((a,b)=>Date.parse(b.properties?.time||0)-Date.parse(a.properties?.time||0))[0]?.properties || null;
}
function fresh(reading, now) {
  const age=reading?now.getTime()-Date.parse(reading.time):Infinity;
  return Number.isFinite(age)&&age>=0&&age<=36*3600000;
}
async function loadGage(reach,now) {
  const params=['00010','00060'];
  const requests=params.map(code=>{
    const url=ENDPOINT+'?f=json&limit=100&monitoring_location_id=USGS-'+reach.station+'&parameter_code='+code;
    return json(url);
  });
  const settled=await Promise.allSettled(requests);
  const observations={};
  for(let i=0;i<params.length;i++){
    const s=settled[i]; if(s.status==='fulfilled'){
      const p=newest(s.value.features,params[i]);
      if(fresh(p,now)) observations[params[i]]=p;
    }
  }
  const temp=observations['00010'], flow=observations['00060'];
  const rawTemp=temp?Number(temp.value):null;
  // 00010 reports temperature in Celsius; avoid multiplying wrong units.
  const waterTempF=Number.isFinite(rawTemp)?Math.round((rawTemp*9/5+32)*10)/10:null;
  return {
    waterTempF,flowCfs:flow?Number(flow.value):null,
    observedAt:temp?.time||null,temperatureSource:temp?'USGS measured (provisional)':'unavailable',
    sourceUrl:'https://waterdata.usgs.gov/monitoring-location/USGS-'+reach.station
  };
}
async function loadWeather(reach) {
  const point=await json(NWS+'/points/'+reach.lat+','+reach.lon);
  const url=point.properties?.forecastHourly;
  if(!url||!url.startsWith('https://api.weather.gov/')) throw new Error('No NWS hourly URL');
  const forecast=await json(url);
  const p=forecast.properties?.periods?.[0];
  if(!p) return {};
  const wind=String(p.windSpeed||'').match(/\d+/);
  return {
    windMph:wind?Number(wind[0]):null,
    cloudy:/cloud|overcast|rain|shower|drizzle/i.test(p.shortForecast||''),
    weatherText:p.shortForecast||null,
    weatherObservedAt:p.startTime||null
  };
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','public, s-maxage=1200, stale-while-revalidate=1800');
  res.setHeader('Access-Control-Allow-Origin','*');
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  const id=typeof req.query?.reach==='string'?req.query.reach:'north-branch';
  const reach=REACHES.find(r=>r.id===id);
  if(!reach) return res.status(400).json({error:'Unknown reach'});
  const now=new Date();
  const [gage,weather]=await Promise.allSettled([loadGage(reach,now),loadWeather(reach)]);
  const measurement=gage.status==='fulfilled'?gage.value:{
    waterTempF:null,flowCfs:null,observedAt:null,temperatureSource:'unavailable',
    sourceUrl:'https://waterdata.usgs.gov/monitoring-location/USGS-'+reach.station
  };
  const meteo=weather.status==='fulfilled'?weather.value:{};
  const report=buildMayflyReport({reach,now,...measurement,...meteo});
  return res.status(200).json({
    success:true,partial:measurement.waterTempF===null, ...report,
    sourceUrl:measurement.sourceUrl,
    dataQuality:{
      waterTemp:measurement.waterTempF===null?'unavailable':'fresh measured at gauge',
      weather:meteo.weatherText?'NWS hourly forecast':'unavailable',
      actualHatchReports:'not provided',
    }
  });
}
