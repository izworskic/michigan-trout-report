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
// NDBC observations supplement — never replace — stream temperatures. No unverified stations.
const MARINE = {
  whitefish:{zone:"LSZ321",buoys:["4403587"]},
  roxbury:{zone:"LSZ321",buoys:["4403587"]},
  munising:{zone:"LSZ249",buoys:["45172"]},
  keweenaw:{zone:"LSZ247",buoys:["45025","45023"]},
  marquette:{zone:"LSZ248",buoys:[]}, // NOAA 45004 water-temperature sensor failed in 2026.
  straits:{zone:"LHZ346",buoys:[]},
  huron:{zone:"LHZ349",buoys:[]}
};
const BUOY_NAMES={"4403587":"Whitefish Bay","45172":"Grand Marais","45025":"South Keweenaw Entry","45023":"North Keweenaw Entry"};
export function parseNdbc(text,station,now=Date.now()){
  if(typeof text!=="string"||!text.startsWith("#"))return null;
  const lines=text.split(/\r?\n/),columns=lines[0].trim().split(/\s+/);
  const index=name=>columns.findIndex(k=>k.replace(/^#/,"")===name);
  const tIndex=index("WTMP"),wIndex=index("WSPD"),waveIndex=index("WVHT");
  if(tIndex<0||index("YY")<0)return null;
  const observations=[];
  for(const line of lines.slice(2,1000)){
    if(!line||line.startsWith("#"))continue;
    const p=line.trim().split(/\s+/);
    if(p.length<=tIndex)continue;
    const utc=Date.UTC(+p[0],+p[1]-1,+p[2],+p[3],+p[4]);
    if(!Number.isFinite(utc)||utc>now+3600000||utc<now-46*86400000)continue;
    const raw=p[tIndex],c=raw==="MM"?null:Number(raw);
    if(c===null||!Number.isFinite(c)||c<0||c>32)continue;
    const v=(idx)=>idx<0||!p[idx]||p[idx]==="MM"?null:Number(p[idx]);
    const wind=v(wIndex),wave=v(waveIndex);
    observations.push({t:utc,tempF:Math.round((c*1.8+32)*10)/10,windMph:wind!==null&&Number.isFinite(wind)?Math.round(wind*2.23694):null,waveFt:wave!==null&&Number.isFinite(wave)?Math.round(wave*3.28084*10)/10:null});
  }
  if(!observations.length)return null;
  observations.sort((a,b)=>b.t-a.t);
  const latest=observations[0],ageHours=Math.round((now-latest.t)/360000)/10;
  const past=observations.find(x=>x.t<latest.t-20*3600000&&x.t>latest.t-29*3600000);
  return {station,name:BUOY_NAMES[station]||station,source:"NOAA NDBC",url:"https://www.ndbc.noaa.gov/station_page.php?station="+station,measuredAt:new Date(latest.t).toISOString(),ageHours,stale:ageHours>12,tempF:latest.tempF,windMph:latest.windMph,waveFt:latest.waveFt,change24hF:past?Math.round((latest.tempF-past.tempF)*10)/10:null,kind:"Measured lake water (not tributary water)"};
}
async function ndbc(station){
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),5200);
  try{
    const resp=await fetch("https://www.ndbc.noaa.gov/data/realtime2/"+station+".txt",{signal:ctrl.signal,headers:{"Accept":"text/plain","User-Agent":"MichiganTroutReport-SmeltRun/1.1 chrisizworski.com"}});
    if(!resp.ok)throw Error("NDBC HTTP "+resp.status);
    return parseNdbc(await resp.text(),station);
  }finally{clearTimeout(timeout);}
}

async function nwsMarine(zone){
  const data=await json("https://api.weather.gov/zones/forecast/"+zone+"/forecast",4700);
  const p=data?.properties;
  if(!Array.isArray(p?.periods)||!p.periods.length)return null;
  return {zone,updatedAt:p.updated||p.updateTime||null,kind:"Official NWS nearshore zone forecast, not a stream or fish forecast",
    periods:p.periods.slice(0,3).map(x=>({name:String(x.name||"Period").slice(0,70),
    text:String(x.detailedForecast||x.shortForecast||"").slice(0,440)}))};
}
async function nwsAlerts(lat,lon){
  const data=await json("https://api.weather.gov/alerts/active?point="+lat+","+lon,4500);
  const now=Date.now();
  return (data.features||[]).map(f=>f.properties||{}).filter(p=>p.event&&/flood|high wind|gale|small craft|storm|severe thunderstorm|dense fog|tornado|ice|lakeshore|marine/i.test(p.event)&&(!p.expires||Date.parse(p.expires)>now)).slice(0,5).map(p=>({event:p.event,severity:p.severity||"Unknown",ends:p.expires||null,headline:p.headline||p.event,source:"National Weather Service"}));
}

const SOURCES = {
  fisheries:"https://www.michigan.gov/dnr/education/michigan-species/fish-species/smelt",
  opportunities:"https://www.michigan.gov/dnr/-/media/Project/Websites/dnr/Documents/Fisheries/misc/SmeltDipping-FishingOpps.pdf",
  rules:"https://www.michigan.gov/dnr/things-to-do/fishing/fishing-regulations",
  triggers:"https://www.michiganseagrant.org/lessons/lessons/by-broad-concept/life-science/predicting-smelt-runs/",
  water:"https://api.waterdata.usgs.gov/",
  weather:"https://www.weather.gov/documentation/services-web-api",
  ndbc:"https://www.ndbc.noaa.gov/",
  coastwatch:"https://coastwatch.glerl.noaa.gov/satellite-data-products/lake-surface-temperature/",
  ice:"https://glerl.noaa.gov/data/ice/",
  glos:"https://glos.org/data/faq/"
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
  const vals=(data.features||[]).map(f=>f.properties||{}).filter(p=>p.parameter_code==="00010"&&p.value!==null&&p.value!==""&&Number.isFinite(Number(p.value))&&p.time).map(p=>({time:p.time,c:Number(p.value)})).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
  if(!vals.length)return null;
  const last=vals.at(-1);const hours=(Date.now()-Date.parse(last.time))/3600000;
  return {station,waterF:Math.round((last.c*9/5+32)*10)/10,measuredAt:last.time,stale:!Number.isFinite(hours)||hours>18,history:vals.filter((x,i)=>i%Math.max(1,Math.floor(vals.length/35))===0).map(x=>({t:x.time,f:Math.round((x.c*9/5+32)*10)/10})).slice(-40),source:"USGS measured water temperature"};
}
function summarize(r,forecast,water,season,buoy,alerts){
  if(!season)return {status:"Off season",signal:"Historical opportunity only",reason:"Outside the spring spawning and netting window. No current-run prediction is made.",bestNight:null};
  if(!forecast?.length)return {status:"Data unavailable",signal:"Cannot assess upcoming nights",reason:"NWS hourly forecast could not be retrieved. No readiness ranking.",bestNight:null};
  const best=forecast.slice().sort((a,b)=>b.nightScore-a.nightScore)[0];
  if(alerts?.length)return {status:"Hazard watch",signal:"NWS alert in effect",reason:"NWS alert for this area: "+alerts.map(a=>a.event).join(", ")+". Check official warning details and local access safety; do not assume conditions are safe.",bestNight:null};
  if(water&&!water.stale&&water.waterF>=42&&water.waterF<=54){
    return {status:"Conditions promising",signal:"Measured temperature in spawning range",reason:"A nearby USGS stream sensor reads "+water.waterF+"°F; suitable temperatures and night weather suggest it may be worth checking locally. Fish presence is unverified.",bestNight:best.date};
  }
  if(water&&!water.stale)return {status:"Temperature watch",signal:"Measured water outside early trigger",reason:"USGS measures "+water.waterF+"°F at this river; warming trends alone do not confirm a run.",bestNight:best.date};
  if(buoy&&!buoy.stale&&buoy.tempF>=40&&buoy.tempF<=55)return {status:"Lake warming watch",signal:"Nearby lake buoy in spring range",reason:"NOAA buoy "+buoy.station+" measures lake surface water at "+buoy.tempF+"°F. This is not tributary temperature and is not evidence that smelt are running.",bestNight:best.date};
  return {status:"Weather watch",signal:"No verified local stream temperature",reason:"Night forecasts are available but cannot confirm smelt presence. Nearby lake buoys are only context.",bestNight:best.date};
}
export default async function handler(req,res){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed"});}
  res.setHeader("Cache-Control","public, s-maxage=1800, stale-while-revalidate=3600");
  res.setHeader("X-Robots-Tag","noindex");
  const now=new Date(),month=Number(new Intl.DateTimeFormat("en-US",{timeZone:"America/Detroit",month:"numeric"}).format(now));
  const season=month>=3&&month<=5;
  const desired=String(req.query.region||"all");if(desired!=="all"&&!REGIONS.some(r=>r.id===desired))return res.status(400).json({error:"Unknown region"});
  const list=desired==="all"?REGIONS:REGIONS.filter(r=>r.id===desired);
  // Share a single upstream request for stations used by multiple waters.
  const buoyRequests=new Map();
  const getBuoy=id=>{
    if(!buoyRequests.has(id))buoyRequests.set(id,ndbc(id).catch(()=>null));
    return buoyRequests.get(id);
  };
  const zoneRequests=new Map();
  const getZone=zone=>{if(!zoneRequests.has(zone))zoneRequests.set(zone,nwsMarine(zone).catch(()=>null));return zoneRequests.get(zone);};
  const regions=await Promise.all(list.map(async r=>{
    const marine=MARINE[r.id]||{zone:null,buoys:[]};
    let forecast=[],water=null,alerts=[],alertState=season?"unavailable":"off season",errors=[];
    const tasks=[];
    if(season){
      tasks.push(weather(r.lat,r.lon).then(f=>forecast=f).catch(()=>errors.push("NWS forecast missing")));
      if(r.station)tasks.push(streamTemp(r.station).then(t=>water=t).catch(()=>errors.push("USGS water reading missing")));
      tasks.push(nwsAlerts(r.lat,r.lon).then(a=>{alerts=a;alertState="checked";}).catch(()=>errors.push("NWS alert feed unavailable")));
    }
    const [buoys,zoneForecast]=await Promise.all([Promise.all(marine.buoys.map(getBuoy)),marine.zone?getZone(marine.zone):Promise.resolve(null)]);
    await Promise.all(tasks);
    const current=buoys.filter(Boolean).sort((a,b)=>(a.stale?1:0)-(b.stale?1:0)||a.ageHours-b.ageHours)[0]||null;
    return {...r,waterbody:r.water,forecast,water,buoy:current,
      buoyCandidates:marine.buoys,marineZone:marine.zone,marineForecast:zoneForecast,
      marineForecastUrl:marine.zone?"https://marine.weather.gov/MapClick.php?TextType=2&zoneid="+marine.zone:null,
      alerts,alertState,...summarize(r,forecast,water,season,current,alerts),errors};
  }));
  return res.status(200).json({updatedAt:now.toISOString(),season,seasonYear:month>=7?now.getUTCFullYear()+1:now.getUTCFullYear(),kind:"weather-and-water-conditions-not-fish-counts",regions,sources:SOURCES,model:{waterTriggerF:"42–45°F early trigger; spawning can continue warmer",bestHours:"10 PM – 2 AM (local time)",rankings:"A sensor-supported indicator is only offered when a fresh USGS water temperature exists. Buoys supply lake context only; stream temperature is a separate measurement. NWS alerts suppress positive signals."}});
}
