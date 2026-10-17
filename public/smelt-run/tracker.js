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
let map=null;const markers=new Map();
function badge(r){
 const s=r.status||"Weather watch",cls=s==="Conditions promising"?"promising":s==="Temperature watch"||s==="Weather watch"?"watch":"off";
 return '<span class="status '+cls+'">'+esc(s)+'</span>';
}
function ordered(rows){return rows.slice().sort((a,b)=>{
 const n=x=>x.status==="Conditions promising"?4:x.status==="Temperature watch"?3:x.history==="Good"?2:1;
 return n(b)-n(a)||fallback.findIndex(x=>x.id===a.id)-fallback.findIndex(x=>x.id===b.id);
});}
function board(){
 $("board").innerHTML=ordered(data).map(r=>'<button class="location '+(r.id===selected?'active':'')+'" type="button" data-region="'+esc(r.id)+'"><span><strong>'+esc(r.name)+'</strong><small>'+esc(r.area)+' · Historic: '+esc(r.history)+'</small></span>'+badge(r)+'</button>').join("");
 document.querySelectorAll(".location").forEach(b=>b.addEventListener("click",()=>select(b.dataset.region)));
 $("board-status").textContent=season?"Spring conditions":"Seasonal guide";
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
function nights(r){
 const forecast=r.forecast||[];
 if(!season){$("nights").innerHTML='<p class="explain">Next spring’s night-by-night forecast will appear during March–May. There is no October run forecast.</p>';return;}
 if(!forecast.length){$("nights").innerHTML='<p class="explain">The NWS forecast is temporarily unavailable for this region. No nights have been ranked.</p>';return;}
 $("nights").innerHTML=forecast.map(f=>{
 const score=Number(f.nightScore)||0;
 return '<div class="night"><div><b>'+esc(dateLabel(f.date))+'</b><small>'+esc(f.weather||"NWS hourly forecast")+'</small></div><div><div class="bar"><i style="width:'+Math.min(100,Math.max(0,score/3*100))+'%"></i></div><small>Night conditions only'+(f.precipChance==null?'':' · Rain chance '+esc(f.precipChance)+'%')+'</small></div><div class="right">'+esc(f.airF)+'°F<small>'+esc(f.windMph)+' mph wind</small></div></div>';
 }).join("");
}
function detail(){
 const r=data.find(x=>x.id===selected)||data[0];if(!r)return;
 $("detail-title").textContent=r.name;
 $("detail-sub").textContent=r.water+" · "+r.county+" County / counties";
 $("detail-badge").outerHTML=badge(r).replace('<span ','<span id="detail-badge" ');
 $("insight").textContent=(season?(r.reason||"Current condition evidence is unavailable."):"Off season: Michigan's spring smelt spawning run is not active now. This is a historical-opportunity and preparation guide.")+" "+r.detail;
 $("historical-value").textContent=r.history;
 $("history-text").textContent="Michigan DNR historic dipping opportunity · older survey, not a live catch estimate.";
 const w=r.water;
 $("water-value").textContent=w&&!w.stale?Number(w.waterF).toFixed(1)+"°F":"No live reading";
 $("water-source").textContent=!season?"Measured readings are evaluated during spring.":w&&!w.stale?"USGS station "+w.station+" · "+new Date(w.measuredAt).toLocaleString("en-US",{timeZone:"America/Detroit",dateStyle:"medium",timeStyle:"short"})+" ET":r.station?"USGS station "+r.station+" missing or older than 18h":"No local USGS stream thermometer verified. Air ≠ water.";
 const link=r.station?"https://waterdata.usgs.gov/monitoring-location/USGS-"+encodeURIComponent(r.station)+"/":"https://api.waterdata.usgs.gov/";
 $("gage-link").href=link;
 renderChart(season?w:null);nights(r);
}
function select(id,focus){
 if(!data.some(x=>x.id===id))return;selected=id;
 board();detail();paintMarkers();
 const url=new URL(location.href);url.searchParams.set("region",id);history.replaceState(null,"",url.pathname+url.search+url.hash);
 if(focus&&map){const r=data.find(x=>x.id===id);map.flyTo([r.lat,r.lon],8,{duration:.65});}
}
function paintMarkers(){
 markers.forEach((mark,id)=>{const r=data.find(x=>x.id===id);if(!r)return;
 const className="map-marker "+(r.history==="Limited"?"limited ":"")+(id===selected?"active":"");
 mark.setIcon(window.L.divIcon({html:'<span class="'+className+'"></span>',className:"",iconSize:[26,26],iconAnchor:[13,13]}));
 });
}
function startMap(){
 if(!window.L){$("map").innerHTML='<div style="padding:25px">Map temporarily unavailable. All seven regions remain selectable in the regional board.</div>';return;}
 try{
 map=L.map("map",{scrollWheelZoom:false,zoomControl:true}).setView([45.89,-86.7],6);
 L.tileLayer("https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',maxZoom:16}).addTo(map);
 for(const r of fallback){const m=L.marker([r.lat,r.lon],{title:r.name}).addTo(map);m.bindTooltip(esc(r.name));m.on("click",()=>select(r.id,true));markers.set(r.id,m);}
 paintMarkers();
 }catch(e){$("map").textContent="Map unavailable. Use the regional board to explore every location.";}
}
async function load(){
 const button=$("refresh");button.disabled=true;button.textContent="Updating…";
 try{
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
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
 board();detail();paintMarkers();
}
$("refresh").addEventListener("click",load);
board();detail();startMap();load();
})();