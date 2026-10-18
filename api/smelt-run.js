import {lakeAverage,iceAnalysis,offshoreIce,ICE_MAP} from "../lib/smelt-environment.js";
import {forecastNights,parseUsgsWater,assessSmelt} from "../lib/smelt-decisions.js";
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
// Offshore samples are contextual ice-chart points, not public dipping accesses.
const ENVIRONMENT = {
  whitefish:{lake:"Superior",offshore:{lat:46.75,lon:-85.10}},
  roxbury:{lake:"Superior",offshore:{lat:46.75,lon:-85.10}},
  munising:{lake:"Superior",offshore:{lat:46.46,lon:-86.59}},
  keweenaw:{lake:"Superior",offshore:{lat:46.83,lon:-88.48}},
  marquette:{lake:"Superior",offshore:{lat:46.64,lon:-87.40}},
  straits:{lake:"Huron",offshore:{lat:46.10,lon:-84.60}},
  huron:{lake:"Huron",offshore:{lat:44.40,lon:-83.35}}
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
  // NWS API zone-forecast route returns 404 for some Great Lakes marine UGCs.
  // Use the official NWS marine text page, but never display a stale issuance.
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),5000);
  try{
    const resp=await fetch("https://marine.weather.gov/MapClick.php?TextType=2&zoneid="+zone,{
      signal:ctrl.signal,headers:{"Accept":"text/html","User-Agent":"MichiganTroutReport-SmeltRun/1.2 chrisizworski.com"}});
    if(!resp.ok)throw Error("NWS marine HTTP "+resp.status);
    const html=(await resp.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ");
    const plain=html.replace(/<br\s*\/?>/gi,"\n").replace(/<\/(?:p|div|li|h[1-6]|tr)>/gi,"\n")
      .replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;|&apos;/gi,"'")
      .replace(/&quot;/gi,'"');
    const line=plain.replace(/\s+/g," ");
    const stamp=line.match(/Last Update:\s*(\d{3,4})\s*(AM|PM)\s*(EST|EDT|CST|CDT)\s*\w+\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})/i);
    if(!stamp)return null;
    const hh=stamp[1].padStart(4,"0"),issued=Date.parse(stamp[4]+" "+stamp[5]+" "+stamp[6]+" "+Number(hh.slice(0,-2))+":"+hh.slice(-2)+" "+stamp[2]+" "+stamp[3]);
    if(!Number.isFinite(issued)||issued>Date.now()+3600000||Date.now()-issued>36*3600000)return null;
    const lines=plain.split(/\n/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean);
    const regex=/^(Tonight|Today|This Afternoon|Overnight|Monday(?: Night)?|Tuesday(?: Night)?|Wednesday(?: Night)?|Thursday(?: Night)?|Friday(?: Night)?|Saturday(?: Night)?|Sunday(?: Night)?):\s*(.*)/i;
    const periods=[];
    for(let i=0;i<lines.length;i++){
      const m=lines[i].match(regex);
      if(!m)continue;
      let body=m[2];if(body.length<18)body+=" "+(lines[i+1]||"");
      if(body.length>15)periods.push({name:m[1],text:body.slice(0,440)});
      if(periods.length===3)break;
    }
    return periods.length?{zone,updatedAt:new Date(issued).toISOString(),kind:"Official NWS nearshore marine forecast; not fish activity",periods}:null;
  }finally{clearTimeout(timer);}
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
  glos:"https://glos.org/data/faq/",
  lakeAverages:"https://coastwatch.glerl.noaa.gov/statistics/average-surface-water-temperature-glsea/",
  iceChart:ICE_MAP
};
async function json(url,timeout=5300){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);
  try{const r=await fetch(url,{headers:{"Accept":"application/geo+json, application/json","User-Agent":"MichiganTroutReport-SmeltRun/1.0 (public research tool; chrisizworski.com)"},signal:c.signal});if(!r.ok)throw Error("HTTP "+r.status);return await r.json();}
  finally{clearTimeout(timer);}
}
async function weather(lat,lon){
  const p=await json("https://api.weather.gov/points/"+lat+","+lon);
  const hourly=p?.properties?.forecastHourly;if(!hourly?.startsWith("https://api.weather.gov/"))throw Error("Forecast unavailable");
  const h=await json(hourly);return forecastNights(h?.properties?.periods);
}
async function streamTemp(station){
 if(!station)return null;
 // Modern USGS OGC continuous endpoint; samples must be for this exact station and degC.
 const url="https://api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items?f=json&monitoring_location_id=USGS-"+station+"&parameter_code=00010&time=P7D&limit=1500";
 const raw=await json(url,5800);
 return parseUsgsWater(raw,station);
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
  const lakeRequests=new Map();
  const getLake=lake=>{if(!lakeRequests.has(lake))lakeRequests.set(lake,lakeAverage(lake,now.getTime()).catch(()=>null));return lakeRequests.get(lake);};
  const basinIcePromise=iceAnalysis(now.getTime());
  const iceRequests=new Map();
  const getIce=(env,id)=>basinIcePromise.then(basinIce=>{
    if(basinIce.status!=="current")return {...basinIce,kind:"Latest regional NOAA ice chart status (not a current stream observation)"};
    const sampleKey=env.offshore.lat+","+env.offshore.lon;
    if(!iceRequests.has(sampleKey))iceRequests.set(sampleKey,offshoreIce(env.offshore,now.getTime()));
    return iceRequests.get(sampleKey);
  });
  const getZone=zone=>{if(!zoneRequests.has(zone))zoneRequests.set(zone,nwsMarine(zone).catch(()=>null));return zoneRequests.get(zone);};
  const regions=await Promise.all(list.map(async r=>{
    const marine=MARINE[r.id]||{zone:null,buoys:[]};
    let forecast=[],water=null,alerts=[],alertState=season?"unavailable":"off season",errors=[];
    const tasks=[];
    if(season){
      tasks.push(weather(r.lat,r.lon).then(f=>forecast=f).catch(()=>errors.push("NWS forecast missing")));
      tasks.push(nwsAlerts(r.lat,r.lon).then(a=>{alerts=a;alertState="checked";}).catch(()=>errors.push("NWS alert feed unavailable")));
    }
    // Keep checking verified stream instrumentation all year, so spring breakage is not hidden in the off-season.
    if(r.station)tasks.push(streamTemp(r.station).then(t=>{water=t;if(!t)errors.push("No recent USGS stream temperature");}).catch(()=>errors.push("USGS stream-temperature feed unavailable")));
    const env=ENVIRONMENT[r.id];
    const [buoys,zoneForecast,satellite,ice]=await Promise.all([Promise.all(marine.buoys.map(getBuoy)),marine.zone?getZone(marine.zone):Promise.resolve(null),getLake(env.lake),getIce(env,r.id)]);
    await Promise.all(tasks);
    const current=buoys.filter(Boolean).sort((a,b)=>(a.stale?1:0)-(b.stale?1:0)||a.ageHours-b.ageHours)[0]||null;
    return {...r,waterbody:r.water,forecast,water,buoy:current,
      satellite,ice,lakeBasin:env.lake,
      buoyCandidates:marine.buoys,marineZone:marine.zone,marineForecast:zoneForecast,
      marineForecastUrl:marine.zone?"https://marine.weather.gov/MapClick.php?TextType=2&zoneid="+marine.zone:null,
      alerts,alertState,...assessSmelt({season,forecast,water,buoy:current,alerts,alertState,ice}),errors};
  }));
  return res.status(200).json({updatedAt:now.toISOString(),season,seasonYear:month>=7?now.getUTCFullYear()+1:now.getUTCFullYear(),kind:"weather-and-water-conditions-not-fish-counts",regions,sources:SOURCES,model:{waterTriggerF:"42–45°F early trigger; spawning can continue warmer",bestHours:"10 PM – 2 AM (local time)",rankings:"A promising condition indicator requires verified NWS warnings, a valid nighttime forecast, and a fresh USGS water-temperature reading. Satellite readings are LAKE-WIDE averages (not per-region pixels), USNIC chart samples are offshore, and neither confirms fish. NWS alerts and heavy observed ice suppress optimistic labels."}});
}
