// Shared exploratory controls for real NOAA / NWS / USGS observations.
// This is a display layer, never a prediction of fish presence.
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const labelDate=date=>new Date(date+"T12:00:00Z").toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"});
const localDay=iso=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Detroit",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(iso));
const fmt=x=>Number.isFinite(Number(x))?Number(x).toFixed(1)+"°F":"—";
const sources=[
 {id:"stream",label:"USGS stream",color:"#10786b",description:"Measured tributary • provisional values possible"},
 {id:"buoy",label:"NOAA buoy",color:"#c27733",description:"Measured nearby lake surface"},
 {id:"lake",label:"NOAA GLSEA",color:"#346da3",description:"Satellite-derived whole-lake average"}
];
const availableSeries=r=>{
 const out={stream:[],buoy:[],lake:[]};
 if(r?.water&&Array.isArray(r.water.history)){
  out.stream=r.water.history.filter(x=>x?.t&&Number.isFinite(Number(x.f))).map(x=>({date:localDay(x.t),f:Number(x.f)}));
 }
 if(r?.buoy&&Array.isArray(r.buoy.history)){
  out.buoy=r.buoy.history.filter(x=>x?.t&&Number.isFinite(Number(x.f))).map(x=>({date:localDay(x.t),f:Number(x.f)}));
 }
 if(r?.satellite&&Array.isArray(r.satellite.history)){
  out.lake=r.satellite.history.filter(x=>x?.date&&Number.isFinite(Number(x.f))).map(x=>({date:x.date,f:Number(x.f)}));
 }
 // Several observations on a day are represented by the last actually recorded sample,
 // not an interpolated measurement or a modeled daily average.
 return Object.fromEntries(Object.entries(out).map(([k,rows])=>{
  const byDate=new Map(rows.sort((a,b)=>a.date.localeCompare(b.date)).map(x=>[x.date,x.f]));
  return [k,[...byDate].map(([date,f])=>({date,f}))];
 }));
};
const nearestForecast=(r,date)=>r?.forecast?.find(x=>x.date===date)||null;
export function createExplorer(root,{onRegion,onNight}){
 let regions=[],selected="",season=false,night=null,compareId=null,hoverDate=null;
 const layers=new Set(["stream","buoy","lake"]);
 const region=()=>regions.find(r=>r.id===selected)||regions[0]||null;
 const control=(selector)=>root.querySelector(selector);
 const temperature=r=>{
  const water=r?.water&&!r.water.stale?r.water:null,buoy=r?.buoy&&!r.buoy.stale?r.buoy:null,
   lake=r?.satellite&&!r.satellite.stale?r.satellite:null;
  return {water,buoy,lake};
 };
 const coverage=r=>{
  const {water,buoy,lake}=temperature(r);
  return water?{label:"USGS stream",short:"Measured stream "+fmt(water.waterF),grade:"direct"}
       :buoy?{label:"NOAA buoy",short:"Lake buoy "+fmt(buoy.tempF),grade:"context"}
       :lake?{label:"GLSEA mean",short:r.lakeBasin+" lake-wide "+fmt(lake.tempF),grade:"context"}
       :{label:"No current sample",short:"Only historical context",grade:"unknown"};
 };
 const matrixRows=()=>regions.map(r=>{
  const {water,buoy,lake}=temperature(r),f=night?nearestForecast(r,night):null;
  return '<button type="button" class="exp-row'+(selected===r.id?' current':'')+'" data-exp-region="'+esc(r.id)+'" aria-pressed="'+(selected===r.id)+'">'+
  '<span class="exp-row-name"><strong>'+esc(r.name)+'</strong><small>'+esc(r.area)+'</small></span>'+
  '<span class="exp-data '+(water?'direct':'missing')+'">'+(water?fmt(water.waterF):'—')+'<small>'+(water?'stream':'no gauge')+'</small></span>'+
  '<span class="exp-data '+(buoy?'context':'missing')+'">'+(buoy?fmt(buoy.tempF):'—')+'<small>'+(buoy?'lake buoy':'no buoy')+'</small></span>'+
  '<span class="exp-data '+(lake?'context':'missing')+'">'+(lake?fmt(lake.tempF):'—')+'<small>'+(lake?esc(r.lakeBasin)+' mean':'no average')+'</small></span>'+
  '<span class="exp-data '+(f?.weatherGrade==='Favorable'?'direct':f?.weatherGrade==='Poor'?'caution':'missing')+'">'+
  (night?esc(f?.weatherGrade||'—'):'—')+'<small>'+(night?'NWS weather':'off season')+'</small></span></button>';
 }).join("");
 const renderChart=r=>{
  const series=availableSeries(r),visible=sources.filter(x=>layers.has(x.id)&&series[x.id].length>0);
  const days=[...new Set(visible.flatMap(s=>series[s.id].map(p=>p.date)))].sort();
  if(!days.length)return '<div class="exp-chart-empty">No dated temperature history for this selection. Missing sources are not filled with modeled values.</div>';
  if(!hoverDate||!days.includes(hoverDate))hoverDate=days.at(-1);
  const all=visible.flatMap(s=>series[s.id].map(p=>p.f));
  const lo=Math.floor((Math.min(...all)-2)/5)*5,hi=Math.ceil((Math.max(...all)+2)/5)*5;
  const left=52,right=920,top=18,bottom=214,x=d=>left+(days.length===1?0:days.indexOf(d)/(days.length-1)*(right-left)),
   y=v=>bottom-(v-lo)/(hi-lo||1)*(bottom-top),picked=x(hoverDate);
  let svg='<svg class="exp-plot" viewBox="0 0 970 260" role="img" aria-label="Interactive chart comparing dated stream, buoy, and lake-wide temperature measurements. Change date using slider or chart." preserveAspectRatio="xMidYMid meet"><rect x="0" y="0" width="970" height="260" rx="13" fill="#f8fbfa"/>';
  for(let i=0;i<=4;i++){
   const value=lo+(hi-lo)*i/4,cy=y(value);
   svg+='<path d="M'+left+' '+cy+'H'+right+'" stroke="#ddeae7" stroke-width="1"/><text x="44" y="'+(cy+4)+'" text-anchor="end" fill="#617c7a" font-size="12">'+value.toFixed(0)+'°</text>';
  }
  const first=days[0],last=days.at(-1);
  svg+='<text x="'+left+'" y="247" fill="#627c78" font-size="12">'+esc(labelDate(first))+'</text><text x="'+right+'" y="247" text-anchor="end" fill="#627c78" font-size="12">'+esc(labelDate(last))+'</text>';
  for(const source of visible){
   const values=series[source.id].sort((a,b)=>a.date.localeCompare(b.date));
   // Do not bridge missing dates with an invented path.
   let path="",previous=null;
   for(const p of values){
    // Test real elapsed days, not array positions: a missing calendar day is not a measured trend.
    const elapsed=previous===null?Infinity:(Date.parse(p.date+"T12:00:00Z")-Date.parse(previous+"T12:00:00Z"))/86400000;
    if(elapsed>1.5||elapsed<=0)path+="M"+x(p.date).toFixed(1)+" "+y(p.f).toFixed(1);
    else path+=" L"+x(p.date).toFixed(1)+" "+y(p.f).toFixed(1);
    previous=p.date;
   }
   svg+='<path d="'+path+'" stroke="'+source.color+'" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round"/>';
   for(const p of values)svg+='<circle cx="'+x(p.date).toFixed(1)+'" cy="'+y(p.f).toFixed(1)+'" r="'+(p.date===hoverDate?5.5:3)+'" fill="'+source.color+'" stroke="white" stroke-width="1.5"><title>'+esc(source.label+' · '+p.date+' · '+fmt(p.f))+'</title></circle>';
  }
  svg+='<line x1="'+picked+'" y1="'+top+'" x2="'+picked+'" y2="'+bottom+'" stroke="#2d504e" stroke-width="1.5" stroke-dasharray="5 4"/>';
  for(const date of days){
   const a=x(date),w=days.length>1?(right-left)/(days.length-1):30;
   svg+='<rect data-exp-chart-date="'+esc(date)+'" x="'+Math.max(left,a-w/2).toFixed(1)+'" y="'+top+'" width="'+w.toFixed(1)+'" height="'+(bottom-top)+'" fill="transparent" style="cursor:crosshair"><title>Inspect '+esc(labelDate(date))+'</title></rect>';
  }
  svg+='</svg>';
  const dayIndex=days.indexOf(hoverDate),vals=sources.map(source=>{
   const items=series[source.id],hit=items.find(x=>x.date===hoverDate),last=items.at(-1);
   const value=!layers.has(source.id)?"hidden":hit?fmt(hit.f):last?fmt(last.f)+" (latest "+labelDate(last.date)+")":"not available";
   return '<span class="exp-snapshot-item"><i style="background:'+source.color+'"></i>'+esc(source.label)+': <b>'+esc(value)+'</b></span>';
  }).join("");
  return svg+'<div class="exp-scrub"><button data-exp-step="-1" type="button" aria-label="Previous observation date" '+(dayIndex===0?'disabled':'')+'>‹</button>'+
  '<label for="exp-date-slider">Inspect <strong>'+esc(labelDate(hoverDate))+'</strong></label>'+
  '<input id="exp-date-slider" type="range" min="0" max="'+(days.length-1)+'" value="'+dayIndex+'" aria-label="Temperature history date" data-exp-days="'+esc(days.join(","))+'">'+
  '<button data-exp-step="1" type="button" aria-label="Next observation date" '+(dayIndex===days.length-1?'disabled':'')+'>›</button></div>'+
  '<div class="exp-snapshot">'+vals+'</div>';
 };
 const compareOptions=(selectedId)=>regions.map(r=>'<option value="'+esc(r.id)+'"'+(r.id===selectedId?' selected':'')+'>'+esc(r.name)+'</option>').join("");
 const comparableObservation=(left,right)=>{
  // Only compare like with like. Lake-wide GLSEA means are shared across a basin and are NOT site comparisons.
  const w1=temperature(left).water,w2=temperature(right).water;
  if(w1&&w2){
   const a=Date.parse(w1.measuredAt),b=Date.parse(w2.measuredAt);
   if(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=24*3600000)
    return '<strong>Comparable measured stream temperatures:</strong> '+esc(left.name)+' '+fmt(w1.waterF)+
     ' versus '+esc(right.name)+' '+fmt(w2.waterF)+'. Difference: '+Math.abs(w1.waterF-w2.waterF).toFixed(1)+
     '°F (observations within 24 hours). This is not a fish-presence estimate.';
  }
  return '<strong>No valid stream-to-stream comparison.</strong> At least one location lacks a fresh independent USGS stream gauge. Lake readings are useful context, not substitutes for spawning tributary measurements.';
 };
 const renderCompare=()=>{
  const first=region(),second=regions.find(r=>r.id===compareId&&r.id!==selected);
  if(!first)return '<p class="exp-compare-help">The region data is not ready.</p>';
  const selector='<div class="exp-compare-controls">'+
   '<label>First region <select id="exp-compare-a" aria-label="First region for comparison">'+compareOptions(selected)+'</select></label>'+
   '<label>Compare with <select id="exp-compare-b" aria-label="Second region for comparison">'+
    '<option value="">Choose another region…</option>'+regions.filter(x=>x.id!==selected).map(r=>'<option value="'+esc(r.id)+'"'+(r.id===compareId?' selected':'')+'>'+esc(r.name)+'</option>').join("")+
   '</select></label></div>';
  if(!second)return selector+'<p class="exp-compare-help" role="status">Choose a second region above to view two real observation profiles side by side.</p>';
  const cell=(r,firstColumn)=>{
   const {water,buoy,lake}=temperature(r),c=coverage(r);
   const provenance=(reading,kind)=>reading?'<span class="exp-data-date">'+esc(
    reading.measuredAt?new Date(reading.measuredAt).toLocaleDateString("en-US",{timeZone:"America/Detroit",month:"short",day:"numeric"}):""
   )+(reading.provisional?" · provisional":"")+'</span>':'';
   return '<div class="exp-compare-card"><span class="exp-compare-role">'+(firstColumn?'REGION A · MAP + CHART':'REGION B · COMPARISON')+'</span>'+
    '<strong>'+esc(r.name)+'</strong><small>'+esc(c.label)+' · '+esc(r.history)+' historical opportunity</small>'+
    '<dl><div><dt>USGS measured stream</dt><dd>'+esc(water?fmt(water.waterF):'Unavailable')+provenance(water)+'</dd></div>'+
    '<div><dt>NOAA lake buoy</dt><dd>'+esc(buoy?fmt(buoy.tempF):'Unavailable')+(buoy?' <span class="exp-data-date">Station '+esc(buoy.station||"unverified")+'</span>':'')+provenance(buoy)+'</dd></div>'+
    '<div><dt>GLSEA whole-lake mean</dt><dd>'+esc(lake?fmt(lake.tempF):'Unavailable')+(lake?' <span class="exp-data-date">'+esc(r.lakeBasin)+' basin</span>':'')+'</dd></div>'+
    '<div><dt>Season status</dt><dd>'+esc(r.status||'Unknown')+'</dd></div></dl></div>';
  };
  const duplicateBuoy=first.buoy?.station&&first.buoy.station===second.buoy?.station;
  const basinShared=first.lakeBasin&&first.lakeBasin===second.lakeBasin;
  return selector+'<div class="exp-compare-grid" aria-live="polite">'+cell(first,true)+cell(second,false)+'</div>'+
   '<div class="exp-compare-assessment">'+comparableObservation(first,second)+'</div>'+
   (duplicateBuoy?'<p class="exp-fine"><strong>Same buoy:</strong> Both regions reference station '+esc(first.buoy.station)+'. This is one shared lake measurement, not two independent observations.</p>':'')+
   (basinShared?'<p class="exp-fine"><strong>Same lake basin:</strong> Both regions show the identical GLSEA basin average; it does not differentiate their tributaries.</p>':'')+
   '<p class="exp-fine">Data sources have different locations and observation times. Historical DNR opportunity does not establish current catches or legal dipping access.</p>';
 };
 const renderNights=()=>{
  if(!season)return '<div class="exp-no-nights"><strong>Spring night explorer is dormant.</strong> When March–May arrives, selectable NWS forecast nights will filter the weather evidence across all seven areas. No October run or weather forecast is invented.</div>';
  const dates=[...new Set(regions.flatMap(r=>(r.forecast||[]).map(f=>f.date)))].sort();
  if(!dates.length)return '<div class="exp-no-nights">NWS overnight forecasts are unavailable. No nights can be recommended.</div>';
  const buttons='<button type="button" data-exp-night="" class="exp-night-choice'+(!night?' chosen':'')+'" aria-pressed="'+(!night)+'">All nights</button>'+
   dates.map(date=>'<button type="button" data-exp-night="'+esc(date)+'" class="exp-night-choice'+(night===date?' chosen':'')+'" aria-pressed="'+(night===date)+'">'+esc(labelDate(date))+'</button>').join("");
  const chosen=night?nearestForecast(region(),night):null;
  const label=night?(chosen?esc(chosen.weatherGrade)+' weather · '+esc(chosen.airF)+'°F · peak wind '+(chosen.maxWindMph==null?'unavailable':esc(chosen.maxWindMph)+' mph'):'No forecast for selected region on this night'):'Choose a night to recolor regional markers by NWS nighttime weather grade.';
  return '<div class="exp-night-options">'+buttons+'</div><p class="exp-night-caption" id="exp-night-caption">'+label+
   ' <strong>Weather only—never a smelt count or trip safety clearance.</strong></p>';
 };
 function render(){
  const r=region();if(!r)return;
  const cov=coverage(r);
  root.innerHTML=
   '<div class="exp-heading"><div><div class="eyebrow">Interactive field intelligence / linked views</div>'+
   '<h2>Explore the spring signals</h2><p>Every selection updates the evidence matrix, temperature history, map and region briefing. Sources retain their own geography and dates.</p></div>'+
   '<div class="exp-heading-action"><span class="exp-evidence-badge '+cov.grade+'">'+esc(cov.label)+'</span><button type="button" id="exp-share">Copy this view ↗</button></div></div>'+
   '<div class="exp-top-grid"><div class="exp-chart-card"><div class="exp-card-top"><div><div class="eyebrow">01 / Temperature history</div><h3>'+esc(r.name)+'</h3><p>'+esc(cov.short)+' · '+esc(r.waterbody||r.water||"")+'</p></div>'+
   '<div class="exp-source-pills">'+sources.map(source=>'<button type="button" class="exp-layer '+(layers.has(source.id)?'on':'')+'" aria-pressed="'+layers.has(source.id)+'" data-exp-layer="'+source.id+'" title="'+esc(source.description)+'"><i style="background:'+source.color+'"></i>'+esc(source.label)+'</button>').join("")+'</div></div>'+
   renderChart(r)+'<div class="exp-chart-note">Dots are dated observations. Source readouts identify the latest sample when none exists on the selected date. Lines stop at missing calendar days—no values are interpolated. USGS = stream, NDBC = a lake buoy, GLSEA = a whole-lake satellite-derived mean. Off-season temperatures do not imply smelt are running.</div></div>'+
   '<aside class="exp-side-card"><div class="eyebrow">02 / Compare two regions</div><h3>See conditions side by side</h3>'+
   '<p class="exp-side-copy">Choose two regions here. The first controls the map and temperature chart; the second stays in the comparison. No pinning or scrolling required.</p>'+
   '<div class="exp-compare-body">'+renderCompare()+'</div></aside></div>'+
   '<div class="exp-matrix"><div class="exp-card-top"><div><div class="eyebrow">03 / Statewide evidence explorer</div><h3>Compare all seven regions</h3><p>Tap a row to sync the map, charts and briefing. “—” means no verified current reading—not zero.</p></div></div>'+
   '<div class="exp-table" role="group" aria-label="Seven smelt regions and observation coverage"><div class="exp-table-head"><span>Region / historic area</span><span>USGS stream</span><span>NOAA buoy</span><span>GLSEA basin mean</span><span>'+(night?'NWS '+esc(labelDate(night)):'NWS night')+'</span></div>'+matrixRows()+'</div></div>'+
   '<div class="exp-night-panel"><div class="eyebrow">04 / Time travel only as far as forecasts allow</div><h3>Explore upcoming nights</h3>'+
   renderNights()+'</div>';
 }
 root.addEventListener("click",event=>{
  const regionBtn=event.target.closest("[data-exp-region]");if(regionBtn){onRegion(regionBtn.dataset.expRegion);return;}
  const nightBtn=event.target.closest("[data-exp-night]");if(nightBtn){onNight(nightBtn.dataset.expNight||null);return;}
  const layer=event.target.closest("[data-exp-layer]");if(layer){const id=layer.dataset.expLayer;layers.has(id)?layers.delete(id):layers.add(id);hoverDate=null;render();return;}
  const rect=event.target.closest("[data-exp-chart-date]");if(rect){hoverDate=rect.dataset.expChartDate;render();return;}
  const step=event.target.closest("[data-exp-step]");
  if(step){
   const dates=(control("#exp-date-slider")?.dataset.expDays||"").split(",").filter(Boolean),i=dates.indexOf(hoverDate);
   hoverDate=dates[Math.max(0,Math.min(dates.length-1,i+Number(step.dataset.expStep)))];render();return;
  }
  if(event.target.closest("#exp-share")){
   const url=new URL(location.href);
   url.searchParams.set("region",selected);
   if(night)url.searchParams.set("night",night);else url.searchParams.delete("night");
   if(navigator.clipboard?.writeText){navigator.clipboard.writeText(url.toString()).then(()=>{
    const label=control("#exp-share");if(label)label.textContent="Link copied";
   }).catch(()=>{const label=control("#exp-share");if(label)label.textContent="Select URL to share";});}
   else {const label=control("#exp-share");if(label)label.textContent="Share your browser URL";}
  }
 });
 root.addEventListener("change",event=>{
  if(event.target.id==="exp-compare-a"){
   const id=event.target.value;
   if(regions.some(r=>r.id===id)&&id!==selected){
    // Keep the secondary region where possible, but prevent comparing a region with itself.
    if(compareId===id)compareId=selected;
    onRegion(id);
   }
   return;
  }
  if(event.target.id==="exp-compare-b"){
   const id=event.target.value;
   compareId=id&&id!==selected&&regions.some(r=>r.id===id)?id:null;
   render();
  }
 });
 root.addEventListener("input",event=>{
  if(event.target.id==="exp-date-slider"){
   const dates=(event.target.dataset.expDays||"").split(","),i=Number(event.target.value);
   if(dates[i]){hoverDate=dates[i];render();}
  }
 });
 return {
  update(nextRegions,nextSelected,nextSeason,nextNight){
   regions=nextRegions||[];selected=nextSelected;season=!!nextSeason;night=nextNight||null;
   if(!regions.some(r=>r.id===compareId&&r.id!==selected)){
    compareId=regions.find(r=>r.id!==selected)?.id||null;
   }
   render();
  },
  getCompareId:()=>compareId
 };
}
