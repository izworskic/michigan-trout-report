// GET /api/lake-mayflies?region=saginaw-bay|western-erie
// Independent lake Hexagenia watch; no reuse of the trout-river Hex score.
// No credentials, keys, cron, API proxies, or scraped third-party sites.
import {LAKE_REGIONS,parseNdbcStandard,buildLakeHexReport} from '../lib/lake-mayflies.js';
const AGENT='MichiganTroutReport/1.0 (https://michigantroutreport.com)';
async function readResponse(url,type,ms=9000) {
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),ms);
 try {
  const response=await fetch(url,{signal:abort.signal,
   headers:{Accept:type==='json'?'application/geo+json, application/json;q=0.9':'text/plain',
    'User-Agent':AGENT}});
  if(!response.ok)throw new Error('Source HTTP '+response.status);
  const content=await response.text();
  if(content.length>1800000)throw new Error('Source response exceeds safety limit');
  return type==='json'?JSON.parse(content):content;
 } finally {clearTimeout(timer);}
}
export async function buoyObservations(region,now) {
 // When a seasonal station goes offline, do NOT use another lake as proxy.
 const url='https://www.ndbc.noaa.gov/data/realtime2/'+region.station+'.txt';
 const data=await readResponse(url,'text',11000);
 return parseNdbcStandard(data,region.station,now);
}
export async function eveningForecast(region) {
 const origin='https://api.weather.gov';
 const point=await readResponse(origin+'/points/'+region.weatherLat+','+region.weatherLon,'json');
 const url=point?.properties?.forecastHourly;
 if(typeof url!=='string'||!/^https:\/\/api\.weather\.gov\/gridpoints\/[A-Za-z]{3}\/\d+,\d+\/forecast\/hourly(?:\?.*)?$/.test(url))
  throw new Error('NWS point did not return a verified hourly URL');
 const forecast=await readResponse(url,'json',11000);
 return Array.isArray(forecast?.properties?.periods)?forecast.properties.periods.slice(0,170):[];
}
export default async function handler(req,res) {
 res.setHeader('Cache-Control','public, s-maxage=1200, stale-while-revalidate=1200');
 res.setHeader('Access-Control-Allow-Origin','*');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const id=typeof req.query?.region==='string'?req.query.region:'saginaw-bay';
 const region=LAKE_REGIONS.find(r=>r.id===id);
 if(!region)return res.status(400).json({error:'Unsupported nearshore region'});
 const now=new Date();
 const [obs,nws]=await Promise.allSettled([buoyObservations(region,now),eveningForecast(region)]);
 const observed=obs.status==='fulfilled'?obs.value:[];
 const forecasts=nws.status==='fulfilled'?nws.value:[];
 const report=buildLakeHexReport({region,now,observations:observed,hourlyForecast:forecasts,
   sources:{buoyRequest:obs.status==='fulfilled'?'received':'unavailable',
     forecastRequest:nws.status==='fulfilled'?'received':'unavailable',
     weatherProxy:region.weatherProxy,weatherProxyNote:'NWS wind forecast at nearby shore, not over-water buoy wind'}});
 return res.status(200).json({success:true,partial:obs.status==='rejected'||nws.status==='rejected',
  ...report,stationURL:region.stationURL,
  notes:['Buoy water temperature represents near-surface water only. It is not a direct lakebed measurement.',
    'The 68°F lake threshold is NOT the 68°F trout catch-and-release safety threshold from our river tool.',
    'Shoreline arrival and wind drift of swarms cannot be determined from this buoy alone.']});
}
