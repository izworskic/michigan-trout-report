// NOAA CoastWatch GLSEA lake-wide satellite-derived daily means + USNIC nearshore ice polygons.
// This data provides context, NOT local tributary temperatures or observed smelt activity.
// All upstream URLs are hardcoded allowlists; absence/staleness must never become "ice free".
export const LAKE_CSV={
  Superior:"https://apps.glerl.noaa.gov/coastwatch/webdata/statistic/csv/all_year_glsea_avg_s_F.csv",
  Michigan:"https://apps.glerl.noaa.gov/coastwatch/webdata/statistic/csv/all_year_glsea_avg_m_F.csv",
  Huron:"https://apps.glerl.noaa.gov/coastwatch/webdata/statistic/csv/all_year_glsea_avg_h_F.csv"
};
export const ICE_LAYER="https://mapservices.weather.noaa.gov/vector/rest/services/obs/usnic_greatlakes_ice_chart/MapServer/0/query";
export const ICE_MAP="https://usicecenter.gov/Products/GreatLakesData";
const round=n=>Math.round(n*10)/10;
export function parseLakeCsv(csv,year,nowMs=Date.now()){
  if(typeof csv!=="string"||csv.length<30)return null;
  const lines=csv.trim().replace(/\r/g,"").split("\n");
  const head=lines[0].split(",").map(s=>s.trim());
  const col=head.indexOf(String(year));
  if(col<1)return null;
  const history=[];
  for(const line of lines.slice(1)){
    const cells=line.split(",");
    const doy=Number(cells[0]),raw=(cells[col]||"").trim(),f=Number(raw);
    if(!Number.isInteger(doy)||doy<1||doy>366||!raw||!Number.isFinite(f)||f<30||f>95)continue;
    const timestamp=Date.UTC(year,0,doy,12,0,0);
    if(new Date(timestamp).getUTCFullYear()!==year||timestamp>nowMs+2*3600000)continue;
    history.push({date:new Date(timestamp).toISOString().slice(0,10),f:round(f),timestamp});
  }
  if(!history.length)return null;
  history.sort((a,b)=>a.timestamp-b.timestamp);
  const last=history.at(-1),ageHours=(nowMs-last.timestamp)/3600000;
  const past=history.find(x=>x.date===new Date(last.timestamp-3*86400000).toISOString().slice(0,10));
  return {
    source:"NOAA CoastWatch GLSEA daily lake-wide average",kind:"Satellite-derived analyzed lake-wide mean; NOT a nearshore grid cell or stream temperature",
    measuredAt:new Date(last.timestamp).toISOString(),ageHours:round(ageHours),stale:ageHours>96,
    tempF:last.f,change3dF:past?round(last.f-past.f):null,
    history:history.slice(-21).map(({date,f})=>({date,f}))
  };
}
export function parseIceDate(value,nowMs=Date.now()){
  if(value===null||value===undefined||value==="")return null;
  const time=typeof value==="number"?value:Date.parse(value);
  if(!Number.isFinite(time)||time>nowMs+3600000||time<nowMs-365*86400000)return null;
  return new Date(time).toISOString();
}
// Official SIGRID-3 CT is a categorical WMO code, NOT a continuous percentage.
// Interpret according to the U.S. NWS map-service renderer, not as a percent.
export function iceBand(ct){
  const s=String(ct??"").padStart(2,"0");
  if(["00","55"].includes(s))return {label:"Ice-free in mapped lake polygon",category:"open"};
  if(s==="01")return {label:"Less than 1/10 ice",category:"trace"};
  if(["10","12","13","20","23","24","30"].includes(s))return {label:"1/10–3/10 ice",category:"light"};
  if(["34","35","40","45","46","50","56","57","60","67"].includes(s))return {label:"4/10–6/10 ice",category:"moderate"};
  if(["68","70","78","79","80"].includes(s))return {label:"7/10–8/10 ice",category:"heavy"};
  if(["81","89","90","91"].includes(s))return {label:"9/10–10/10 ice",category:"heavy"};
  if(s==="92")return {label:"Fast ice",category:"heavy"};
  return {label:"Ice concentration unknown",category:"unknown"};
}
export function parseIceResponse(json,nowMs=Date.now(),sample=null){
  if(!Array.isArray(json?.features))return {status:"unavailable",reason:"No valid USNIC feature response",observedAt:null};
  if(!json.features.length)return {status:"no coverage",reason:"No ice polygon intersects this offshore sample; this does not prove ice-free water",observedAt:null};
  const props=json.features[0]?.attributes||json.features[0]?.properties||{};
  const observedAt=parseIceDate(props.idp_filedate,nowMs);
  if(!observedAt)return {status:"unavailable",reason:"Ice observation date missing or invalid",observedAt:null};
  const ageHours=round((nowMs-Date.parse(observedAt))/3600000);
  if(ageHours>72)return {status:"stale",reason:"Latest National Ice Center analysis is older than 72 hours",observedAt,ageHours};
  const band=iceBand(props.ct);
  return {status:"current",observedAt,ageHours,code:String(props.ct??""),band:band.label,category:band.category,
    sample:sample||null,kind:"Offshore ice analysis polygon; not stream ice or guaranteed safe access"};
}
export async function fetchText(url,timeoutMs=4800){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{const r=await fetch(url,{signal:ctrl.signal,headers:{"User-Agent":"MichiganTroutReport-SmeltRun/1.3 (chrisizworski.com)","Accept":"text/plain,text/csv,application/json"}});
    if(!r.ok)throw new Error("Source HTTP "+r.status);
    return await r.text();
  }finally{clearTimeout(timer);}
}
export async function lakeAverage(lake,nowMs=Date.now()){
  const url=LAKE_CSV[lake];if(!url)return null;
  const source=await fetchText(url,5500);
  const year=new Date(nowMs).getUTCFullYear();
  const result=parseLakeCsv(source,year,nowMs);
  return result?{...result,lake,sourceUrl:url}:null;
}
const iceUrl=props=>ICE_LAYER+"?"+Object.entries(props).map(([k,v])=>encodeURIComponent(k)+"="+encodeURIComponent(String(v))).join("&");
async function iceQuery(props){
  const raw=await fetchText(iceUrl({...props,f:"pjson"}),5000);
  return JSON.parse(raw);
}
export async function iceAnalysis(nowMs=Date.now()){
  try{
    const j=await iceQuery({where:"1=1",outFields:"ct,idp_filedate",returnGeometry:false,resultRecordCount:1,orderByFields:"idp_filedate DESC"});
    // Source-wide date quality gate before asking for any regional point; winter outages must not imply clear ice.
    const head=parseIceResponse(j,nowMs);
    return head.status==="current"?head:head;
  }catch{
    return {status:"unavailable",reason:"National Ice Center ice service unavailable",observedAt:null};
  }
}
export async function offshoreIce(point,nowMs=Date.now()){
  if(!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lon))return {status:"unavailable",reason:"Offshore sample unavailable"};
  try{
    const j=await iceQuery({where:"1=1",geometry:point.lon+","+point.lat,geometryType:"esriGeometryPoint",inSR:4326,spatialRel:"esriSpatialRelIntersects",outFields:"ct,idp_filedate",returnGeometry:false});
    return {...parseIceResponse(j,nowMs,point),sourceUrl:ICE_MAP};
  }catch{
    return {status:"unavailable",reason:"USNIC regional ice query failed",observedAt:null,sourceUrl:ICE_MAP};
  }
}
