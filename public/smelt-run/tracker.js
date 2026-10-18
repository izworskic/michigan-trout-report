import {createExplorer} from "./explorer.js?v=20261018-compare-fix1";
// Mapping is optional: a blocked third-party CDN must never prevent NOAA/NWS/USGS data from rendering.
/* Michigan smelt tracker — client. No third-party map key required. */
(function(){
"use strict";
const fallback=[
  {id:"whitefish",name:"Whitefish Bay & Tahquamenon",area:"Eastern Upper Peninsula",water:"Tahquamenon River",county:"Chippewa / Luce",lat:46.61,lon:-85.05,history:"Good",detail:"Historic DNR good opportunity; current presence unconfirmed."},
  {id:"roxbury",name:"Roxbury & Galloway Creeks",area:"Eastern Upper Peninsula",water:"Roxbury Creek / Galloway Creek",county:"Chippewa",lat:46.49,lon:-84.76,history:"Good",detail:"Historic DNR good opportunity; current presence unconfirmed."},
  {id:"munising",name:"Munising & Anna River",area:"Central Lake Superior shore",water:"Anna River",county:"Alger",lat:46.40,lon:-86.66,history:"Good",detail:"Historic DNR good opportunity; current presence unconfirmed."},
  {id:"keweenaw",name:"Keweenaw Bay & Falls River",area:"Western Upper Peninsula",water:"Falls River",county:"Baraga",lat:46.80,lon:-88.45,history:"Good",station:"04043097",detail:"Historic DNR good opportunity and a measured USGS water-temperature gauge nearby."},
  {id:"marquette",name:"Marquette & Dead River",area:"Central Lake Superior shore",water:"Dead River",county:"Marquette",lat:46.54,lon:-87.39,history:"Limited",detail:"Historic DNR limited opportunity; current presence unconfirmed."},
  {id:"straits",name:"Straits & Carp River",area:"Northern Lakes Michigan / Huron",water:"Carp River",county:"Mackinac",lat:46.02,lon:-84.73,history:"Limited",detail:"Historic DNR limited opportunity; current presence unconfirmed."},
  {id:"huron",name:"Northeast Lake Huron",area:"Northern Lower Peninsula",water:"Au Sable River mouth / shoreline",county:"Iosco",lat:44.41,lon:-83.32,history:"Limited",detail:"Historic DNR limited opportunity; check stream-specific restrictions."}
];
const $=id=>document.getElementById(id);
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateLabel=d=>new Date(d+"T22:00:00-04:00").toLocaleDateString("en-US",{month:"short",day:"numeric",weekday:"short",timeZone:"America/Detroit"});
const year=Number(new Intl.DateTimeFormat("en-US",{timeZone:"America/Detroit",year:"numeric"}).format(new Date()));
const month=Number(new Intl.DateTimeFormat("en-US",{timeZone:"America/Detroit",month:"numeric"}).format(new Date()));
let data=fallback.map(r=>({...r,status:"Off season",signal:"Historical opportunity only",forecast:[],water:null,reason:"No current fish run claim."}));
let season=month>=3&&month<=5;
let selected=(new URLSearchParams(location.search)).get("region")||"whitefish";
if(!fallback.some(x=>x.id===selected))selected="whitefish";
let night=new URLSearchParams(location.search).get("night")||null;
let map=null,maplibregl=null;const markers=new Map();
let explorer=null;
function badge(r){
 const s=r.status||"Weather watch",cls=s==="Conditions promising"?"promising":s==="Temperature watch"||s==="Weather watch"||s==="Lake warming watch"||s==="Weather caution"?"watch":s==="Hazard watch"||s==="Ice watch"||s==="Safety data unavailable"?"hazard":"off";
 return '<span class="status '+cls+'">'+esc(s)+'</span>';
}
function ordered(rows){
 const priority=r=>!season?(r.history==="Good"?2:1):({
  "Conditions promising":6,"Temperature watch":5,"Lake warming watch":4,
  "Weather watch":3,"Weather caution":2,"Data unavailable":1,
  "Safety data unavailable":0,"Ice watch":0,"Hazard watch":0
 }[r.status]??1);
 return rows.slice().sort((a,b)=>priority(b)-priority(a)||(b.history==="Good"?1:0)-(a.history==="Good"?1:0)||fallback.findIndex(x=>x.id===a.id)-fallback.findIndex(x=>x.id===b.id));
}
function evidenceLabel(r){
 const temp=r.water&&typeof r.water==="object"&&!r.water.stale?r.water:null;
 if(temp)return "Measured stream "+Number(temp.waterF).toFixed(1)+"°F · "+(temp.provisional?"USGS provisional":"USGS verified");
 if(r.station)return "Stream sensor has no fresh reading";
 const buoy=r.buoy&&!r.buoy.stale?r.buoy:null;
 if(buoy)return "Lake buoy "+Number(buoy.tempF).toFixed(1)+"°F · stream unknown";
 return "No verified stream gauge · historical opportunity only";
}
function nightWeatherLabel(r){
 const f=r.forecast?.find(x=>x.date===night);
 if(!f)return "NWS forecast unavailable for this night";
 return "NWS "+f.weatherGrade+" weather · "+(f.maxWindMph==null?"wind unknown":f.maxWindMph+" mph peak")+" · not fish activity";
}
function board(){
 $("board").innerHTML=ordered(data).map(r=>'<button class="location '+(r.id===selected?'active':'')+'" type="button" data-region="'+esc(r.id)+'"><span><strong>'+esc(r.name)+'</strong><small>'+esc(r.area)+' · Historic: '+esc(r.history)+'</small><small class="evidence-note">'+esc(evidenceLabel(r))+'</small>'+(season&&night?'<small class="night-indicator">'+esc(nightWeatherLabel(r))+'</small>':'')+'</span>'+badge(r)+'</button>').join("");
 document.querySelectorAll(".location").forEach(b=>b.addEventListener("click",()=>select(b.dataset.region)));
 $("board-status").textContent=season?"Spring readiness":"Seasonal guide";
}
function renderChart(water){
 const svg=$("temp-chart");svg.innerHTML="";
 if(!water||water.stale||!water.history||water.history.length<2)return;
 const rows=water.history.filter(r=>Number.isFinite(Number(r.f)));if(rows.length<2)return;
 const vals=rows.map(r=>r.f),min=Math.min(35,...vals)-2,max=Math.max(55,...vals)+2;
 const x=i=>10+i/Math.max(1,rows.length-1)*315;
 const y=v=>91-(v-min)/(max-min)*75;
 const points=rows.map((r,i)=>x(i).toFixed(1)+","+y(r.f).toFixed(1)).join(" ");
 svg.innerHTML='<rect width="340" height="105" rx="6" fill="#f1f8f5"/><rect x="10" y="'+y(54).toFixed(1)+'" width="315" height="'+(y(42)-y(54)).toFixed(1)+'" fill="#ddf0e0"/><line x1="10" x2="325" y1="'+y(42).toFixed(1)+'" y2="'+y(42).toFixed(1)+'" stroke="#79b9a5" stroke-dasharray="4 3"/><polyline points="'+points+'" fill="none" stroke="#177d76" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><text x="12" y="102" fill="#6a817f" font-size="10">USGS measured · recent 7 days</text><text x="292" y="14" fill="#48716c" font-size="10">°F</text>';
}
function lakeTrend(sat){
 const svg=$("lake-chart");svg.innerHTML="";
 if(!sat?.history?.length||sat.history.length<2)return;
 const rows=sat.history.filter(x=>Number.isFinite(x.f));if(rows.length<2)return;
 const values=rows.map(x=>x.f),min=Math.min(...values)-2,max=Math.max(...values)+2;
 const scaleY=v=>87-(v-min)/(max-min)*70;
 const pts=rows.map((r,i)=>(10+i/(rows.length-1)*310).toFixed(1)+","+scaleY(r.f).toFixed(1)).join(" ");
 svg.innerHTML='<rect width="340" height="105" rx="7" fill="#f1f7f6"/><polyline points="'+pts+'" fill="none" stroke="#1c7280" stroke-width="2.4" stroke-linejoin="round"/><text x="11" y="102" font-size="10" fill="#59777b">NOAA GLSEA · '+esc(rows[0].date)+' → '+esc(rows.at(-1).date)+'</text>';
}
function nights(r){
 const forecast=r.forecast||[];
 if(!season){$("nights").innerHTML='<p class="explain">Night-by-night outlook resumes in spring. October conditions are not a smelt-run forecast.</p>';return;}
 if(!forecast.length){$("nights").innerHTML='<p class="explain">The NWS overnight forecast is missing. No nights are ranked.</p>';return;}
 const unsafe=r.status==="Hazard watch"||r.status==="Safety data unavailable"||r.status==="Ice watch";
 const notice=unsafe?'<p class="explain"><strong>Do not use night ratings as go recommendations:</strong> safety or ice evidence requires a separate check.</p>':"";
 $("nights").innerHTML=notice+forecast.map(f=>{
  const grade=f.weatherGrade||"Incomplete";
  const pct=f.nightScore==null?0:Math.round(Math.min(3,Math.max(0,f.nightScore))/3*100);
  const chance=f.precipChance==null?"Rain chance unavailable":"Rain chance "+esc(f.precipChance)+"%";
  const wind=f.maxWindMph==null?"Wind estimate unavailable":"Peak forecast wind "+esc(f.maxWindMph)+" mph";
  return '<button type="button" data-night-date="'+esc(f.date)+'" class="night'+(night===f.date?' chosen-night':'')+'" aria-pressed="'+(night===f.date)+'"><div><b>'+esc(dateLabel(f.date))+'</b><small>'+esc(f.weather||"NWS hourly forecast")+'</small></div><div><div class="bar"><i style="width:'+pct+'%"></i></div><span class="night-grade '+(grade==="Poor"?"poor":grade==="Incomplete"?"incomplete":"")+'">'+esc(grade)+' weather</span><small>'+chance+' · '+wind+'</small></div><div class="right">'+esc(f.airF)+'°F<small>'+(f.windMph==null?"No wind value":esc(f.windMph)+" mph avg")+'</small></div></button>';
 }).join("");
}
function decision(r){
 const measured=r.water&&typeof r.water==="object"&&!r.water.stale?r.water:null;
 const when=r.bestNight?dateLabel(r.bestNight):null;
 const title=!season?"Not smelt-dipping season":r.status==="Conditions promising"?"Conditions worth scouting"+(when?" — "+when:""):r.status==="Hazard watch"?"Official weather hazard: check before heading out":r.status==="Safety data unavailable"?"Safety alert information unavailable":r.status==="Ice watch"?"Lake ice deserves caution":r.status==="Weather caution"?"Water in range, but nights not favorable":r.status==="Temperature watch"?"Measured stream temperature outside early spawning range":r.status==="Lake warming watch"?"Lake warming — stream conditions unverified":"Not enough evidence to recommend a night";
 const explanation=!season?"Watch the lake and stream through winter; return in spring for measured-water and nightly forecasts. Historical spots are not a guarantee of fish.":r.reason||"No run-confirming observations.";
 $("decision-title").textContent=title;
 $("decision-description").textContent=explanation;
 $("decision-temperature").textContent=measured?"Stream gauge: "+Number(measured.waterF).toFixed(1)+"°F · "+(measured.provisional?"provisional":"observed"):r.station?"Stream gauge: missing or older than 18h":"Stream gauge: none verified";
 $("decision-weather").textContent=!season?"Nights: available during spring":night?"Selected "+dateLabel(night)+": "+nightWeatherLabel(r):r.forecast?.length?"NWS nights: "+r.forecast.length+" · weather only":"NWS nights: unavailable";
 $("decision-alerts").textContent=!season?"NWS alerts: checked in spring":r.alertState==="checked"?(r.alerts?.length?"Alerts: "+r.alerts.length+" active":"Alerts: none matched"):"NWS alerts: unchecked";
}
function detail(){
 const r=data.find(x=>x.id===selected)||data[0];if(!r)return;
 decision(r);
 $("detail-title").textContent=r.name;
 $("detail-sub").textContent=(r.waterbody||r.water||"Waterway") +" · "+r.county+" County / counties";
 $("detail-badge").outerHTML=badge(r).replace('<span ','<span id="detail-badge" ');
 $("insight").textContent=(season?(r.reason||"Current condition evidence is unavailable."):"Off season: Michigan's spring smelt spawning run is not active now. This is a historical-opportunity and preparation guide.")+" "+r.detail;
 $("historical-value").textContent=r.history;
 $("history-text").textContent="Michigan DNR historic dipping opportunity · older survey, not a live catch estimate.";
 const w=typeof r.water==="object"?r.water:null;
 $("water-value").textContent=w&&!w.stale?Number(w.waterF).toFixed(1)+"°F":"No live reading";
 $("water-source").textContent=w&&!w.stale?"USGS station "+w.station+" · "+new Date(w.measuredAt).toLocaleString("en-US",{timeZone:"America/Detroit",dateStyle:"medium",timeStyle:"short"})+" ET · "+(w.provisional?"Provisional reading":"Observed")+" · "+(!season?"Off season, no run claim":"Spring context"):r.station?"USGS station "+r.station+" missing or older than 18h":"No local USGS stream thermometer verified. Air ≠ water.";
 const link=r.station?"https://waterdata.usgs.gov/monitoring-location/USGS-"+encodeURIComponent(r.station)+"/":"https://api.waterdata.usgs.gov/";
 $("gage-link").href=link;
 const buoy=r.buoy||null,usable=buoy&&!buoy.stale,stationList=(r.buoyCandidates||[]).join(", ");
 $("buoy-value").textContent=usable?Number(buoy.tempF).toFixed(1)+"°F":"No fresh reading";
 $("buoy-source").textContent=buoy?(buoy.name+" · "+buoy.station+" · "+(buoy.stale?"stale":"measured "+new Date(buoy.measuredAt).toLocaleString("en-US",{dateStyle:"short",timeStyle:"short",timeZone:"America/Detroit"})+" ET")):stationList?"No reports from NOAA station(s): "+stationList:"No vetted local lake buoy for this area";
 const trend=usable&&buoy.change24hF!=null?(buoy.change24hF>0?"+":"")+Number(buoy.change24hF).toFixed(1)+"°F in 24 h. ":"";
 const wind=usable&&buoy.windMph!=null?" · Wind "+buoy.windMph+" mph":"";
 const wave=usable&&buoy.waveFt!=null?" · Wave "+buoy.waveFt+" ft":"";
 $("buoy-trend").textContent=usable?trend+"Measured in the lake, not in the tributary."+wind+wave:buoy?"Most recent lake reading is older than 12 hours and is excluded from readiness.":"Buoy readings may be unavailable seasonally or when a sensor fails. No reading is invented.";
 $("buoy-link").href=buoy?buoy.url:"https://www.ndbc.noaa.gov/mobile/region.php?reg=great_lakes";
 const hazards=r.alerts||[];
 $("nws-status").textContent=hazards.length?hazards.map(a=>a.event).join(" · "):r.alertState==="checked"?"No matching active alerts":"No current alert check";
 $("nws-alert-state").textContent=hazards.length?"NWS active warning: check details before entering cold spring water.":r.alertState==="checked"?"No selected hazards returned. This does not establish safe river or lake conditions.":season?"Alert feed unavailable; do not assume safe conditions.":"Active alerts will be checked during spring.";
 $("nws-marine-link").href=r.marineForecastUrl||"https://www.weather.gov/marine/greatlakestext";
 const marine=r.marineForecast;
 $("marine-periods").innerHTML=marine?.periods?.length?
 marine.periods.slice(0,2).map(p=>'<div class="explain" style="padding:7px 8px;background:#f5f9f7;border:1px solid #e0e9e5;border-radius:7px"><strong>'+esc(p.name)+'</strong>: '+esc(p.text)+'</div>').join("")
 :'<p class="explain">No NWS nearshore periods returned. Use the official link; nearshore products may not be issued year-round.</p>';
 const sat=r.satellite||null,ice=r.ice||null;
 $("sat-value").textContent=sat&&!sat.stale?Number(sat.tempF).toFixed(1)+"°F":"No current reading";
 $("sat-date").textContent=sat?(r.lakeBasin+" lake-wide average · "+(sat.stale?"STALE ":"")+"Last GLSEA date "+new Date(sat.measuredAt).toLocaleDateString("en-US",{timeZone:"UTC",dateStyle:"medium"})):"No NOAA GLSEA analysis available";
 $("sat-trend").textContent=sat?(sat.change3dF!==null?"Three-day change "+(sat.change3dF>=0?"+":"")+sat.change3dF.toFixed(1)+"°F. ":"")
 +"Satellite-derived and blended lake-wide average, NOT the temperature in "+(r.waterbody||"this stream")+"."
 +(sat.stale?" Older than 96h; excluded from current readiness.":""):"No lake average available. The site will not estimate nearshore water from air temperatures.";
 lakeTrend(sat);
 $("ice-value").textContent=ice?.status==="current"?ice.band:ice?.status==="stale"?"Stale ice analysis":ice?.status==="no coverage"?"No chart coverage":"Ice data unavailable";
 $("ice-date").textContent=ice?.observedAt?"USNIC analysis dated "+new Date(ice.observedAt).toLocaleDateString("en-US",{dateStyle:"medium",timeZone:"UTC"})+(ice.status==="stale"?" · EXCLUDED from current conditions":""):"No dated ice analysis for this sample";
 $("ice-explain").textContent=ice?.status==="current"
   ?(ice.band+" at a mapped offshore point, not a surveyed dipping access or stream. Open water in a chart cannot guarantee safe access.")
   :(ice?.reason||"No usable analysis; missing data does not establish ice-free water.");
 renderChart(season?w:null);nights(r);
}
function select(id,focus){
 if(!data.some(x=>x.id===id))return;
 selected=id;
 board();detail();paintMarkers();explorer?.update(data,selected,season,night);
 syncUrl();
 if(map){
  const r=data.find(x=>x.id===id);
  map.easeTo({center:[r.lon,r.lat],zoom:focus?8:Math.max(6,map.getZoom()),duration:600,essential:true});
 }
 if(focus)$("explorer").scrollIntoView({behavior:"smooth",block:"start"});
}
function syncUrl(){
 const url=new URL(location.href);
 url.searchParams.set("region",selected);
 if(night&&season)url.searchParams.set("night",night);else url.searchParams.delete("night");
 history.replaceState(null,"",url.pathname+url.search+url.hash);
}
function selectNight(date){
 if(!season)return;
 const known=[...new Set(data.flatMap(r=>(r.forecast||[]).map(x=>x.date)))];
 night=date&&known.includes(date)?date:null;
 board();detail();paintMarkers();explorer?.update(data,selected,season,night);
 syncUrl();
}
function paintMarkers(){
 const legend=$("map-legend");
 if(legend)legend.innerHTML=season&&night?
  '<strong>NWS weather on '+esc(dateLabel(night))+' (not fish activity):</strong> <span style="color:#147260">● Favorable</span> · <span style="color:#a18028">● Marginal</span> · <span style="color:#a95232">● Poor</span> · <span style="color:#7e9296">● Missing</span>'
  :'<span style="color:#176d69">● Good historical opportunity</span> &nbsp; <span style="color:#b47b31">● Limited historical opportunity</span>';
 markers.forEach((mark,id)=>{
  const r=data.find(x=>x.id===id);if(!r)return;
  const element=mark.getElement();
  element.classList.toggle("limited",r.history==="Limited");
  element.classList.toggle("active",id===selected);
  for(const grade of ["favorable","marginal","poor","incomplete"])element.classList.remove("weather-"+grade);
  const f=season&&night?r.forecast?.find(x=>x.date===night):null;
  if(f)element.classList.add("weather-"+String(f.weatherGrade||"Incomplete").toLowerCase());
  element.setAttribute("aria-pressed",id===selected?"true":"false");
 });
}
async function startMap(){
 const target=$("map");
 target.setAttribute("aria-busy","true");
 try{
  // The optional third-party stylesheet also loads after the data UI has started.
  if(!document.querySelector('link[data-smelt-map-style]')){
   const stylesheet=document.createElement("link");
   stylesheet.rel="stylesheet";
   stylesheet.href="https://unpkg.com/maplibre-gl@6.13.0/dist/maplibre-gl.css";
   stylesheet.dataset.smeltMapStyle="optional";
   document.head.appendChild(stylesheet);
  }
  // A blocked map module only disables mapping, never the NOAA/NWS/USGS observations.
  maplibregl=await import("https://unpkg.com/maplibre-gl@6.13.0/dist/maplibre-gl.mjs");
  map=new maplibregl.Map({
   container:"map",
   style:"https://tiles.openfreemap.org/styles/positron",
   center:[-86.7,45.89],
   zoom:6,
   maxZoom:16,
   dragRotate:false,
   pitchWithRotate:false,
   attributionControl:false
  });
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),"top-right");
  map.addControl(new maplibregl.AttributionControl({customAttribution:'<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>',compact:true}),"bottom-right");
  for(const r of fallback){
   const el=document.createElement("button");
   el.type="button";
   el.className="map-marker";
   el.title=r.name;
   el.setAttribute("aria-label","Explore "+r.name+" smelt conditions");
   const m=new maplibregl.Marker({element:el,anchor:"center"}).setLngLat([r.lon,r.lat]).addTo(map);
   el.addEventListener("click",()=>select(r.id,true));
   markers.set(r.id,m);
  }
  paintMarkers();
  map.on("load",()=>{map.resize();});
  map.on("error",e=>{
   // A service failure should not leave an unexplained blank map; retain the region board.
   const msg=String(e?.error?.message||"");
   if(/style|source|tile|fetch|network/i.test(msg)&&!target.querySelector(".map-error")){
    const alert=document.createElement("p");
    alert.className="map-error";
    alert.setAttribute("role","status");
    alert.textContent="Map background temporarily unavailable. Select any region from the list.";
    target.appendChild(alert);
   }
  });
 }catch(error){
  map=null;
  target.innerHTML='<p class="map-error">Map tiles are unavailable in this browser. Live water and weather observations are still available in the region list and explorer.</p>';
 }finally{
  target.removeAttribute("aria-busy");
 }
}
async function load(){
 const button=$("refresh");button.disabled=true;button.textContent="Updating…";
 try{
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),22000);
 let response;
 try{response=await fetch("/api/smelt-run",{signal:ctrl.signal,cache:"no-store"});}finally{clearTimeout(timer);}
 if(!response.ok)throw Error("API "+response.status);
 const payload=await response.json();
 if(!Array.isArray(payload.regions)||!payload.regions.length)throw Error("No region data");
 data=payload.regions;season=!!payload.season;
 const nextYear=payload.seasonYear;
 $("season-banner").textContent=season?"Spring watch is active · Conditions are not confirmed fish activity":"Off season · Preparing for spring "+nextYear;
 $("updated").textContent="Reviewed "+new Date(payload.updatedAt).toLocaleString("en-US",{timeZone:"America/Detroit",dateStyle:"medium",timeStyle:"short"})+" ET";
 }catch(err){
 data=fallback.map(r=>({...r,status:season?"Data unavailable":"Off season",forecast:[],water:null,reason:"Live API currently unavailable. Showing sourced historic locations only."}));
 $("season-banner").textContent=season?"Live data unavailable · Historic guide only":"Off season · Spring "+(month>=7?year+1:year)+" guide";
 $("updated").textContent="No live ranking displayed";
 }
 button.disabled=false;button.textContent="↻ Refresh conditions";
 if(!season)night=null;
 else if(night&&!data.some(r=>r.forecast?.some(f=>f.date===night)))night=null;
 board();detail();paintMarkers();explorer?.update(data,selected,season,night);syncUrl();
}
explorer=createExplorer($("smelt-explorer"),{
 onRegion:id=>select(id,false),
 onNight:date=>selectNight(date)
});
$("nights").addEventListener("click",event=>{
 const target=event.target.closest("[data-night-date]");
 if(target)selectNight(target.dataset.nightDate);
});
$("refresh").addEventListener("click",load);
board();detail();explorer.update(data,selected,season,night);
// Start the API first; map imports and map tiles are independent of live data.
void load();
void startMap();
})();