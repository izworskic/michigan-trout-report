// Smelt conditions can support a scouting decision; they never establish fish presence.
const locParts=date=>Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/Detroit",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(date).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
export function mphFromForecast(text){
 if(typeof text!=="string"||!text.trim())return null;
 if(/calm/i.test(text))return 0;
 const values=[...text.matchAll(/\d+(?:\.\d+)?/g)].map(x=>Number(x[0]));
 if(!values.length)return null;
 const high=Math.max(...values);
 return Math.round(/knots?\b/i.test(text)?high*1.15078:/km\/h|kph/i.test(text)?high*0.621371:high);
}
export function forecastNights(periods){
 const buckets=new Map();
 for(const p of periods||[]){
  const date=new Date(p.startTime),temperature=Number(p.temperature);
  if(!Number.isFinite(date.getTime())||p.temperature==null||!Number.isFinite(temperature))continue;
  const local=locParts(date),hour=Number(local.hour);
  if(hour>2&&hour<21)continue;
  const nightDate=new Date(Date.UTC(+local.year,+local.month-1,+local.day-(hour<3?1:0))).toISOString().slice(0,10);
  const wind=mphFromForecast(p.windSpeed);
  const chance=p.probabilityOfPrecipitation?.value==null?null:Number(p.probabilityOfPrecipitation.value);
  const airF=p.temperatureUnit==="C"?temperature*1.8+32:temperature;
  const row={airF,wind,precip:Number.isFinite(chance)&&chance!==null&&chance>=0&&chance<=100?chance:null,weather:p.shortForecast||""};
  if(!buckets.has(nightDate))buckets.set(nightDate,[]);
  buckets.get(nightDate).push(row);
 }
 return [...buckets].filter(([,rows])=>rows.length>=2).slice(0,7).map(([date,rows])=>{
  const airF=Math.round(rows.reduce((sum,x)=>sum+x.airF,0)/rows.length);
  const winds=rows.map(x=>x.wind).filter(Number.isFinite);
  const windMph=winds.length===rows.length?Math.round(winds.reduce((a,b)=>a+b,0)/winds.length):null;
  const maxWindMph=winds.length===rows.length?Math.max(...winds):null;
  const rains=rows.map(x=>x.precip).filter(x=>x!==null);
  const precipChance=rains.length?Math.round(Math.max(...rains)):null;
  const score=maxWindMph===null?null:(airF>=35&&airF<=59?2:airF>=28&&airF<=65?1:0)+(maxWindMph<=12?1:0);
  const weatherGrade=maxWindMph===null?"Incomplete":maxWindMph>=20||airF<28||airF>65?"Poor":score===3?"Favorable":"Marginal";
  return {date,airF,windMph,maxWindMph,precipChance,weather:rows[Math.floor(rows.length/2)].weather,
   nightScore:score,weatherGrade,kind:"Nighttime weather conditions only; not observed smelt."};
 });
}
export function parseUsgsWater(data,station,nowMs=Date.now()){
 const expected="USGS-"+station;
 const vals=(data?.features||[]).map(f=>f.properties||{}).filter(p=>{
  const t=Date.parse(p.time),value=Number(p.value);
  return p.monitoring_location_id===expected&&p.parameter_code==="00010"&&p.unit_of_measure==="degC"
   &&p.value!==null&&p.value!==""&&Number.isFinite(value)&&value>-2&&value<40
   &&Number.isFinite(t)&&t<=nowMs+3600000&&t>=nowMs-8*86400000;
 }).map(p=>({t:p.time,ts:Date.parse(p.time),f:Math.round((Number(p.value)*1.8+32)*10)/10,provisional:p.approval_status!=="Approved"})).sort((a,b)=>a.ts-b.ts);
 if(!vals.length)return null;
 const last=vals.at(-1),ageHours=(nowMs-last.ts)/3600000;
 const history=vals.filter((x,i)=>i%Math.max(1,Math.floor(vals.length/36))===0||i===vals.length-1).slice(-40).map(x=>({t:x.t,f:x.f}));
 return {station,waterF:last.f,measuredAt:last.t,ageHours:Math.round(ageHours*10)/10,stale:ageHours>18,
   history,source:"USGS measured stream temperature",unit:"°F (converted from USGS degC)",provisional:last.provisional};
}
export function assessSmelt({season,forecast,water,buoy,alerts,alertState,ice}){
 if(!season)return {status:"Off season",signal:"Historical opportunity only",reason:"Spring spawning season is not active. Measurements are for context; no run forecast is made.",bestNight:null};
 if(alerts?.length)return {status:"Hazard watch",signal:"NWS alert in effect",reason:"Active NWS alert: "+alerts.map(a=>a.event).join(", ")+". Check official warnings before visiting a stream or lake shore.",bestNight:null};
 if(alertState!=="checked")return {status:"Safety data unavailable",signal:"NWS alerts not verified",reason:"The active alert feed could not be checked. Conditions cannot be recommended until official warnings are reviewed.",bestNight:null};
 if(ice?.status==="current"&&["heavy","moderate"].includes(ice.category))return {status:"Ice watch",signal:"Offshore ice is charted",reason:"National Ice Center analysis reports "+ice.band+" offshore. This does not establish conditions in a stream.",bestNight:null};
 if(!forecast?.length)return {status:"Data unavailable",signal:"NWS overnight forecast missing",reason:"No verified nighttime forecast is available; no night is recommended.",bestNight:null};
 const viable=forecast.filter(x=>x.weatherGrade==="Favorable"||x.weatherGrade==="Marginal").sort((a,b)=>(b.nightScore??-1)-(a.nightScore??-1));
 const best=viable[0]?.date||null;
 if(water&&!water.stale&&water.waterF>=42&&water.waterF<=54){
  if(!best)return {status:"Weather caution",signal:"Stream is warm enough but nights look poor",reason:"The measured stream is "+water.waterF+"°F, but forecast nights are windy, extreme, or incomplete. Do not treat this as a go recommendation.",bestNight:null};
  return {status:"Conditions promising",signal:"Measured stream temperature plus reasonable night forecast",reason:"USGS stream temperature is "+water.waterF+"°F and the selected night has comparatively reasonable weather. Fish presence and legal access remain unverified.",bestNight:best};
 }
 if(water&&!water.stale)return {status:"Temperature watch",signal:"Stream temperature outside early spawning band",reason:"USGS measured "+water.waterF+"°F here. This does not confirm a fish run.",bestNight:best};
 if(buoy&&!buoy.stale&&buoy.tempF>=40&&buoy.tempF<=55)return {status:"Lake warming watch",signal:"Lake buoy warming; stream temperature unknown",reason:"Nearby lake buoy measures "+buoy.tempF+"°F, but this is not the stream temperature. No fish arrival claim is possible.",bestNight:best};
 return {status:"Weather watch",signal:"No fresh measured local stream temperature",reason:"Nighttime weather is available, but no verified local stream temperature or fish observation establishes run readiness.",bestNight:best};
}
