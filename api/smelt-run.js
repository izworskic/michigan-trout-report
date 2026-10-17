// Spring smelt-run readiness: NOAA NWS night forecasts + USGS *measured* stream temperature.
// The condition signal is not a catch or fish-presence report.
const REGIONS = [
  {id:"whitefish",name:"Whitefish Bay & Tahquamenon",area:"Eastern Upper Peninsula",water:"Tahquamenon River",county:"Chippewa / Luce",lat:46.61,lon:-85.05,history:"Good",detail:"Historical DNR opportunity: Tahquamenon River (abundant at time of survey). Fishing access and legal gear vary by reach."},
  {id:"roxbury",name:"Roxbury & Galloway Creeks",area:"Eastern Upper Peninsula",water:"Roxbury Creek / Galloway Creek",county:"Chippewa",lat:46.49,lon:-84.76,history:"Good",detail:"DNR historically rated Roxbury Creek abundant and Galloway Creek present. Do not assume public access or a current run."},
  {id:"munising",name:"Munising & Anna River",area:"Central Lake Superior shore",water:"Anna River",county:"Alger",lat:46.40,lon:-86.66,history:"Good",detail:"Anna River appears on DNR's historic good-opportunity list. Identify legal public access before heading out."},
  {id:"keweenaw",name:"Keweenaw Bay & Falls River",area:"Western Upper Peninsula",water:"Falls River",county:"Baraga",lat:46.80,lon:-88.45,history:"Good",station:"04043097",detail:"The Falls River is on DNR's good-opportunity list and has a USGS water-temperature sensor. The gauge is not a live fish counter."},
  {id:"marquette",name:"Marquette & Dead River",area:"Central Lake Superior shore",water:"Dead River",county:"Marquette",lat:46.54,lon:-87.39,history:"Limited",detail:"DNR historically listed smelt as present, but opportunity as limited. Do not treat this as a top dipping destination."},
  {id:"straits",name:"Straits & Carp River",area:"Northern Lakes Michigan / Huron",water:"Carp River",county:"Mackinac",lat:46.02,lon:-84.73,history:"Limited",detail:"DNR historically classified Carp River opportunities as limited; some nearby waters have additional netting restrictions."},
  {id:"huron",name:"Northeast Lake Huron",area:"Northern Lower Peninsula",water:"Au Sable River mouth / shoreline",county:"Iosco",lat:44.41,lon:-83.32,history:"Limited",detail:"DNR's historic inventory indicates limited opportunity at the Au Sable mouth. This is not a recommendation to dip inside a restricted reach."}
];
const SOURCES = {
  fisheries:"https://www.michigan.gov/dnr/education/michigan-species/fish-species/smelt",
  opportunities:"https://www.michigan.gov/dnr/-/media/Project/Websites/dnr/Documents/Fisheries/misc/SmeltDipping-FishingOpps.pdf",
  rules:"https://www.michigan.gov/dnr/things-to-do/fishing/fishing-regulations",
  triggers:"https://www.michiganseagrant.org/lessons/lessons/by-broad-concept/life-science/predicting-smelt-runs/",
  water:"https://api.waterdata.usgs.gov/",
  weather:"https://www.weather.gov/documentation/services-web-api"
};
const z = (n)=>String(n).padStart(2,"0");
const localParts=(date)=>Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/Detroit",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23",weekday:"short"}).formatToParts(date).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
async function json(url,timeout=5300){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);
  try{const r=await fetch(url,{headers:{"Accept":"application/geo+json, application/json","User-Agent":"MichiganTroutReport-SmeltRun/1.0 (public research tool; chrisizworski.com)"},signal:c.signal});if(!r.ok)throw Error("HTTP "+r.status);return await r.json();}
  finally{clearTimeout(timer);}
}
function nightForecast(periods){
  const buckets=new Map();
  for(const p of periods||[]){
    const d=new Date(p.startTime);if(!Number.isFinite(d.getTime()))continue;
    const l=localParts(d),h=Number(l.hour);if(h<21&&h>2)continue;
    const nightDate=new Date(Date.UTC(+l.year,+l.month-1,+l.day-(h<3?1:0))).toISOString().slice(0,10);
    const arr=buckets.get(nightDate)||[];
    arr.push({temperature:Number(p.temperature),unit:p.temperatureUnit,wind:parseInt(p.windSpeed,10)||0,precip:Number(p.probabilityOfPrecipitation?.value),forecast:p.shortForecast||""});
    buckets.set(nightDate,arr);
  }
  return [...buckets].filter(([d,rows])=>rows.length>=2).slice(0,7).map(([date,rows])=>{
    const F=rows.map(x=>x.unit==="C" ? x.temperature*9/5+32 : x.temperature);
    const avg=F.reduce((a,b)=>a+b,0)/F.length;
    const wind=Math.round(rows.reduce((a,b)=>a+b.wind,0)/rows.length);
    const rain=rows.map(x=>x.precip).filter(Number.isFinite);
    const chance=rain.length?Math.round(Math.max(...rain)):null;
    const comfort=(avg>=35&&avg<=59?2:avg>=28&&avg<=65?1:0)+(wind<=12?1:0);
    return {date,airF:Math.round(avg),windMph:wind,precipChance:chance,weather:rows[Math.floor(rows.length/2)].forecast,nightScore:comfort};
  });
}
async function weather(lat,lon){
  const p=await json("https://api.weather.gov/points/"+lat+","+lon);
  const hourly=p?.properties?.forecastHourly;if(!hourly?.startsWith("https://api.weather.gov/"))throw Error("Forecast unavailable");
  const h=await json(hourly);return nightForecast(h?.properties?.periods);
}
async function streamTemp(station){
  if(!station)return null;
  // New USGS Water Data OGC API. The legacy NWIS iv service ends in Feb 2027.
  const u="https://api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items?f=json&monitoring_location_id=USGS-"+station+"&parameter_code=00010&time=P7D&limit=1000";
  const data=await json(u,5800);
  const vals=(data.features||[]).map(f=>f.properties||{}).filter(p=>p.parameter_code==="00010"&&Number.isFinite(Number(p.value))&&p.time).map(p=>({time:p.time,c:Number(p.value)})).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
  if(!vals.length)return null;
  const last=vals.at(-1);const hours=(Date.now()-Date.parse(last.time))/3600000;
  return {station,waterF:Math.round((last.c*9/5+32)*10)/10,measuredAt:last.time,stale:!Number.isFinite(hours)||hours>18,history:vals.filter((x,i)=>i%Math.max(1,Math.floor(vals.length/35))===0).map(x=>({t:x.time,f:Math.round((x.c*9/5+32)*10)/10})).slice(-40),source:"USGS measured water temperature"};
}
function summarize(r,forecast,water,season){
  if(!season)return {status:"Off season",signal:"Historical opportunity only",reason:"Outside the spring spawning and netting window. No current-run prediction is made.",bestNight:null};
  if(!forecast?.length)return {status:"Data unavailable",signal:"Cannot assess upcoming nights",reason:"NWS hourly forecast could not be retrieved. No readiness ranking.",bestNight:null};
  const best=forecast.slice().sort((a,b)=>b.nightScore-a.nightScore)[0];
  if(water&&!water.stale&&water.waterF>=42&&water.waterF<=54){
    return {status:"Conditions promising",signal:"Measured temperature in spawning range",reason:"A nearby USGS stream sensor reads "+water.waterF+"°F; suitable temperatures and night weather suggest it may be worth checking locally. Fish presence is unverified.",bestNight:best.date};
  }
  if(water&&!water.stale)return {status:"Temperature watch",signal:"Measured water outside early trigger",reason:"USGS measures "+water.waterF+"°F at this river; warming trends alone do not confirm a run.",bestNight:best.date};
  return {status:"Weather watch",signal:"No verified local water temperature",reason:"Night forecasts are available but not enough to predict smelt presence without a local water reading or observed fish.",bestNight:best.date};
}
export default async function handler(req,res){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed"});}
  res.setHeader("Cache-Control","public, s-maxage=1800, stale-while-revalidate=3600");
  res.setHeader("X-Robots-Tag","noindex");
  const now=new Date(),month=Number(new Intl.DateTimeFormat("en-US",{timeZone:"America/Detroit",month:"numeric"}).format(now));
  const season=month>=3&&month<=5;
  const desired=String(req.query.region||"all");if(desired!=="all"&&!REGIONS.some(r=>r.id===desired))return res.status(400).json({error:"Unknown region"});
  const list=desired==="all"?REGIONS:REGIONS.filter(r=>r.id===desired);
  const regions=await Promise.all(list.map(async r=>{
    let forecast=[],water=null,errors=[];
    if(season){
      const [w,t]=await Promise.allSettled([weather(r.lat,r.lon),r.station?streamTemp(r.station):Promise.resolve(null)]);
      if(w.status==="fulfilled")forecast=w.value;else errors.push("NWS forecast missing");
      if(t.status==="fulfilled")water=t.value;else errors.push("USGS water reading missing");
    }
    return {...r,forecast,water,...summarize(r,forecast,water,season),errors};
  }));
  return res.status(200).json({updatedAt:now.toISOString(),season,seasonYear:month>=7?now.getUTCFullYear()+1:now.getUTCFullYear(),kind:"weather-and-water-conditions-not-fish-counts",regions,sources:SOURCES,model:{waterTriggerF:"42–45°F early trigger; spawning can continue warmer",bestHours:"10 PM – 2 AM (local time)",rankings:"A sensor-supported indicator is only offered when a fresh USGS water temperature exists. Other areas receive weather-only context."}});
}
