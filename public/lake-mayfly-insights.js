/* Mayfly Insight Dashboard: measured observations + separately reviewed evidence.
 * The "pulse" is NOT a hatch prediction or occurrence classifier.
 * Use only NOAA original measurements, bounded iNaturalist photo specimens,
 * reviewed historical event ledger and nearby NWS forecast. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const DAY=86400000;
const NAMES={'western-erie':'Western Lake Erie','saginaw-bay':'Saginaw Bay'};
const state={region:'western-erie',lake:'All five',report:null,observations:null,reviewed:null,health:{report:'loading',observations:'loading',reviewed:'loading'}};
const localDate=d=>new Date(d).toLocaleDateString('en-US',{timeZone:'America/Detroit',month:'short',day:'numeric'});
const formatDay=date=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'America/Detroit',month:'short',day:'numeric'});
const safeDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))?Date.parse(s+'T12:00:00Z'):null;
const knownRegion=()=>state.lake==='All five'||(state.region==='western-erie'&&state.lake==='Erie')||(state.region==='saginaw-bay'&&state.lake==='Huron');
function clear(id,message){if($(id))$(id).innerHTML='<div class="pulse-empty">'+esc(message)+'</div>';}
function text(id,s){if($(id))$(id).textContent=s;}
function stage(report,reviewed){
 if(!report)return {title:'Checking measurements',why:'Waiting for source data.',index:-1};
 if(!report.seasonActive)return {title:'Outside broad season',why:'June–August is broad Hexagenia context, not a reliable local hatch-date calendar.',index:0};
 const t=report.metrics?.waterTempF;
 if(!Number.isFinite(t))return {title:'Water reading unavailable',why:'No fresh measured buoy temperature. An annual calendar cannot substitute for water data.',index:-1};
 if(state.region==='saginaw-bay')
  return {title:'Water conditions observed',why:'Saginaw Bay has no validated local 68°F Hexagenia trigger. Surface measurements alone do not establish hatch progression.',index:1};
 const recent=reviewed?.success&&reviewed.recent14Days>0;
 if(recent)return {title:'Recent past swarm documented',why:'A dated, editorially reviewed event occurred within 14 days. It does not prove a swarm is happening now.',index:3};
 if(t<64)return {title:'Below western Erie warming range',why:'Measured surface water is below the broad seasonal buildup range. Bottom habitat is not measured.',index:1};
 if(t<68)return {title:'Surface warming toward reference',why:'Surface water is near the published western Erie 68°F contextual cue. Actual bottom conditions remain unknown.',index:2};
 return {title:'Surface thermal watch',why:'The buoy reached the 68°F surface reference. This is neither an observed emergence nor a calibrated countdown.',index:2};
}
function drawMetrics(){
 const report=state.report,obs=state.observations,events=state.reviewed;
 const can=knownRegion();
 const info=can&&state.health.report==='ready'?stage(report,events):null;
 text('pulseTitle',!can?'No calibrated sensor for Lake '+state.lake:info?.title|| (state.health.report==='unavailable'?'Water feed unavailable':'Checking monitored water…'));
 text('pulseExplain',!can?'Live dashboards currently cover only western Erie and Saginaw Bay. No measurements are borrowed from other Great Lakes.':info?.why||'Awaiting the existing NOAA/NWS feed.');
 const now=report?.generatedAt?new Date(report.generatedAt):new Date();
 const inSeason=report?.seasonActive;
 text('pulseSeason',inSeason?'Broad summer window':report?'Off season':'Season not checked');
 const temp=can&&report?.metrics&&Number.isFinite(report.metrics.waterTempF)?report.metrics.waterTempF:null;
 text('pulseWater',temp===null?'—':temp.toFixed(1)+'°F');
 text('pulseWaterDetail',temp===null?'No fresh measured surface reading': 'At NOAA instrument only · '+localDate(report.metrics.measuredAt));
 const recentEvents=can&&state.health.reviewed==='ready'?events.recent14Days:null;
 text('pulseReviewed',recentEvents===null?'—':String(recentEvents));
 text('pulseReviewedDetail',recentEvents===null?'Reviewed feed pending or not in area':recentEvents>0?'Dated historic event(s), NOT a current swarm':'No recent approved events; not proof of no hatch');
 const latest=can&&state.health.observations==='ready'&&obs.status!=='unavailable'?obs.latestDate:null;
 text('pulseLatest',latest?formatDay(latest):'—');
 text('pulseLatestDetail',!can?'No specimen feed for this lake':state.health.observations!=='ready'||obs?.status==='unavailable'?'Specimen feed unavailable':latest?'Last publicly displayed Hexagenia specimen':'No matching specimen in displayed sample');
 const steps=['Seasonal pause','Surface buildup','Surface thermal watch','Dated historical event'];
 const mark=info?.index??-1;
 const rail=$('pulseStageRail');
 if(rail)rail.innerHTML=steps.map((name,i)=>'<li class="'+(mark===i?'current':'')+(mark>i?' passed':'')+'"><span class="pulse-stage-number">'+(i+1)+'</span><span>'+esc(name)+'</span></li>').join('');
 text('pulseStageCaveat',mark===3?'Recent event means previously observed—not actively swarming.':'The rail is an explanation of available evidence, not a progression or hatch percentage.');
}
function renderTemp(){
 const box=$('pulseTempGraph');if(!box)return;
 if(!knownRegion()){clear('pulseTempGraph','No verified buoy feed for this lake. Select western Erie or Saginaw Bay to see instrumented conditions.');return;}
 if(state.health.report==='loading'){clear('pulseTempGraph','Checking up to 14 days of measured buoy water temperatures…');return;}
 if(state.health.report!=='ready'){clear('pulseTempGraph','Measured history unavailable. There is no interpolated line.');return;}
 const history=(state.report?.metrics?.history||[]).filter(d=>safeDate(d.date)!==null&&Number.isFinite(d.meanF)&&Number.isFinite(d.minF)&&Number.isFinite(d.maxF)).slice(-14);
 if(!history.length){clear('pulseTempGraph','The NOAA buoy has no qualifying recent water-temperature history.');return;}
 const width=780,height=255,L=48,R=22,T=23,B=44;
 const values=history.flatMap(d=>[d.minF,d.maxF]);
 const showRef=state.region==='western-erie';
 if(showRef)values.push(68);
 const low=Math.max(20,Math.floor((Math.min(...values)-3)/5)*5),high=Math.min(100,Math.ceil((Math.max(...values)+3)/5)*5);
 const min=low,max=Math.max(low+10,high);
 const y=v=>T+(max-v)/(max-min)*(height-T-B);
 const start=safeDate(history[0].date),end=safeDate(history.at(-1).date);
 const span=Math.max(DAY,end-start);
 const x=s=>L+(safeDate(s)-start)/span*(width-L-R);
 let svg='<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Actual NOAA buoy daily mean temperatures in Fahrenheit, last available 14 dates. Gaps are not interpolated." preserveAspectRatio="xMidYMid meet">';
 for(let t=Math.ceil(min/5)*5;t<=max;t+=5){
  if(t%10!==0)continue;
  svg+='<line x1="'+L+'" x2="'+(width-R)+'" y1="'+y(t)+'" y2="'+y(t)+'" stroke="#dce8df" stroke-width="1"/>';
  svg+='<text x="5" y="'+(y(t)+4)+'" font-size="12" fill="#61786d">'+t+'°</text>';
 }
 if(showRef){
  svg+='<line x1="'+L+'" x2="'+(width-R)+'" y1="'+y(68)+'" y2="'+y(68)+'" stroke="#b47c41" stroke-dasharray="6 5" stroke-width="2"/>';
  svg+='<text x="'+(width-R)+'" y="'+(y(68)-8)+'" text-anchor="end" font-size="11" font-weight="700" fill="#a06e39">68°F western Erie surface reference</text>';
 }
 const pieces=[];let segment=[];
 for(let i=0;i<history.length;i++){
  const p=history[i],prior=history[i-1];
  if(prior&&safeDate(p.date)-safeDate(prior.date)>DAY*1.5){
   if(segment.length>1)pieces.push(segment.join(' '));
   segment=[];
  }
  segment.push(x(p.date).toFixed(1)+','+y(p.meanF).toFixed(1));
 }
 if(segment.length>1)pieces.push(segment.join(' '));
 for(const p of pieces)svg+='<polyline fill="none" stroke="#1c786e" stroke-width="3.5" points="'+p+'"/>';
 history.forEach((p,i)=>{
  const px=x(p.date),label=(i%Math.max(1,Math.ceil(history.length/6))===0||i===history.length-1);
  svg+='<line x1="'+px+'" x2="'+px+'" y1="'+y(p.minF)+'" y2="'+y(p.maxF)+'" stroke="#95c4b3" stroke-width="5" stroke-linecap="round"/>';
  svg+='<circle cx="'+px+'" cy="'+y(p.meanF)+'" r="4" fill="#135d55" stroke="white" stroke-width="1.5"/>';
  if(label)svg+='<text x="'+px+'" y="'+(height-12)+'" text-anchor="middle" font-size="11" fill="#667d70">'+esc(formatDay(p.date))+'</text>';
 });
 svg+='</svg>';
 box.innerHTML=svg;
 const complete=history.filter(d=>d.samples>=4);
 const textTrend=Number.isFinite(state.report.metrics.trendF)?'Latest two complete days: '+(state.report.metrics.trendF>=0?'+':'')+state.report.metrics.trendF.toFixed(1)+'°F. ':'Insufficient complete days to calculate a daily change. ';
 text('pulseTempFoot',history.length+' measured local dates within the last 14 days. '+textTrend+
  'Gaps show missing observations; shading shows sampled daily ranges, not uncertainty bands.'+(showRef?' The 68°F marker is context for western Erie, NOT an observed hatch.':' No 68°F threshold is validated for this Saginaw Bay location.'));
}
function renderTimeline(){
 const box=$('pulseEvidenceGraph');if(!box)return;
 if(!knownRegion()){clear('pulseEvidenceGraph','Observation timelines are only supported for western Erie and Saginaw Bay.');return;}
 const observations=state.observations,reviews=state.reviewed;
 if(state.health.observations==='loading'||state.health.reviewed==='loading'){clear('pulseEvidenceGraph','Checking dated public specimens and reviewed events…');return;}
 const obsReady=state.health.observations==='ready'&&observations?.status!=='unavailable';
 const evtReady=state.health.reviewed==='ready'&&reviews?.success;
 if(!obsReady&&!evtReady){clear('pulseEvidenceGraph','Evidence feeds unavailable; no absence of activity can be inferred.');return;}
 const now=state.report?.generatedAt?new Date(state.report.generatedAt):new Date();
 const anchor=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
 const days=Array.from({length:30},(_,i)=>new Date(anchor-(29-i)*DAY).toISOString().slice(0,10));
 const counts=days.map(d=>({date:d,sightings:0,events:0}));
 const lookup=new Map(counts.map(d=>[d.date,d]));
 if(obsReady)for(const r of observations.records||[]){
  const bin=lookup.get(r.date);
  if(bin)bin.sightings++;
 }
 if(evtReady)for(const r of reviews.events||[]){
  const bin=lookup.get(r.eventDate);if(bin)bin.events++;
 }
 const max=Math.max(1,...counts.map(x=>x.sightings+x.events));
 const W=780,H=235,L=33,R=12,T=29,B=46,step=(W-L-R)/counts.length,plotH=H-T-B;
 let svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="30-day timeline of displayed dated Research Grade specimen records and separately approved historic mass-emergence events, with no missing-day inference">';
 for(let n=0;n<=max;n++){if(n>8)break;const yy=T+plotH*(1-n/max);svg+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" stroke="#e1ebe4"/>';if(n===0||n===max)svg+='<text x="8" y="'+(yy+4)+'" fill="#718679" font-size="10">'+n+'</text>';}
 counts.forEach((r,i)=>{
  const x=L+i*step+step*.13,baseline=T+plotH;
  if(r.sightings){const h=r.sightings/max*plotH;svg+='<rect x="'+x+'" y="'+(baseline-h)+'" width="'+(step*.7)+'" height="'+h+'" rx="2" fill="#358d81"/>';}
  if(r.events){const h=r.events/max*plotH;svg+='<rect x="'+x+'" y="'+(baseline-h)+'" width="'+(step*.7)+'" height="'+h+'" rx="1" fill="#c78f4a" stroke="#fff" stroke-width="1"/>';}
  if(i===0||i===9||i===19||i===29)svg+='<text x="'+(x+step*.35)+'" y="'+(H-13)+'" fill="#607a6e" font-size="11" text-anchor="middle">'+esc(formatDay(r.date))+'</text>';
 });
 svg+='</svg>';box.innerHTML=svg;
 const nObs=counts.reduce((a,b)=>a+b.sightings,0),nRev=counts.reduce((a,b)=>a+b.events,0);
 text('pulseEvidenceFoot',(obsReady?nObs+' photo-supported specimen record'+(nObs===1?'':'s')+' in this display':'Specimen feed unavailable')+
  ' · '+(evtReady?nRev+' reviewed event'+(nRev===1?'':'s'):'Reviewed-event feed unavailable')+
  '. iNaturalist shows only its 12 most recent eligible records from a 365-day search; the chart is neither a census nor a rising/falling swarm trend. Empty bars do not mean insects were absent.');
}
function renderSeason(){
 const box=$('pulseSeasonChart');if(!box)return;
 const month=new Intl.DateTimeFormat('en-US',{timeZone:'America/Detroit',month:'numeric'}).format(state.report?.generatedAt?new Date(state.report.generatedAt):new Date());
 const m=Number(month);
 const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 box.innerHTML='<div class="pulse-season-row"><div class="pulse-season-names">'+months.map((x,i)=>'<span class="'+(i+1===m?'is-current':'')+'">'+x+'</span>').join('')+'</div><div class="pulse-season-cells">'+months.map((x,i)=>'<span title="'+esc(x)+(i>=5&&i<=7?' — broad Great Lakes summer reference':'')+'" class="'+(i>=5&&i<=7?'season-range ':'')+(i+1===m?'is-current':'')+'">'+(i>=5&&i<=7?'●':'')+'</span>').join('')+'</div></div><p class="pulse-season-explain"><strong>June–August:</strong> a broad Hexagenia viewing reference, not a measured peak or species-specific hatch date for every lake. Actual local timing can differ with habitat and weather. <strong>Historical dated example:</strong> adult Hexagenia swarms were counted near Tawas in June 2010; one example is not a lake-wide annual calendar.</p>';
}
function renderEvenings(){
 const box=$('pulseEveningGraph');if(!box)return;
 if(!knownRegion()){clear('pulseEveningGraph','No site-specific NWS proxy is validated for this lake.');return;}
 if(state.health.report!=='ready'){clear('pulseEveningGraph',state.health.report==='loading'?'Checking shoreline weather…':'Shoreline weather unavailable.');return;}
 const days=state.report?.evenings||[];
 if(!days.length){clear('pulseEveningGraph','No shoreline evening forecast returned.');return;}
 box.innerHTML=days.map(d=>{
  const has=d.coverageHours>=3&&Number.isFinite(d.maxEveningWindMph);
  const value=has?Math.min(100,d.maxEveningWindMph/30*100):0;
  const date=d.date?formatDay(d.date):'Unknown date';
  return '<div class="pulse-evening"><strong>'+esc(date)+'</strong><div class="pulse-wind-meter" role="img" aria-label="'+esc(has?'Forecast shoreline wind up to '+d.maxEveningWindMph+' mph':'Incomplete wind forecast')+'"><span style="width:'+value+'%"></span></div><span>'+esc(has?d.maxEveningWindMph+' mph':'No coverage')+'</span></div>';
 }).join('');
 text('pulseEveningFoot','NWS '+(state.report.sourceHealth?.weatherProxy||'shoreline')+' forecast for 6–11 PM ET. Wind affects shoreline visibility, not whether Hexagenia emerge. Later days are weather-only; offshore winds can differ.');
}
function render(){
 if(!$('mayflyInsights'))return;
 const can=knownRegion();
 text('pulseScope',!can?'LAKE '+state.lake.toUpperCase()+' · NO LIVE BUOY':NAMES[state.region].toUpperCase()+' · '+(state.health.report==='ready'?'LIVE SOURCE CHECKED':'CHECKING SOURCES'));
 for(const btn of document.querySelectorAll('[data-pulse-region]'))btn.setAttribute('aria-pressed',String(btn.dataset.pulseRegion===state.region&&can));
 drawMetrics();renderTemp();renderTimeline();renderSeason();renderEvenings();
}
function start(region){
 if(!Object.hasOwn(NAMES,region))return;
 state.region=region;
 state.report=null;state.observations=null;state.reviewed=null;
 state.health={report:'loading',observations:'loading',reviewed:'loading'};
 render();
}
function setLake(lake){
 state.lake=String(lake||'All five');
 // Do not silently display western Erie buoy conditions as if they were
 // measurements in Superior, Ontario, or Michigan.
 const inferred=lake==='Erie'?'western-erie':lake==='Huron'?'saginaw-bay':null;
 if(inferred&&inferred!==state.region&&typeof window.LAKE_BUOY_CHOOSE==='function'){
  window.LAKE_BUOY_CHOOSE(inferred);
 }else render();
}
function init(){
 document.querySelectorAll('[data-pulse-region]').forEach(b=>b.addEventListener('click',()=>{
  state.lake='All five';
  // Preserve the user's explicit sensor choice even when atlas is on
  // an unsupported lake; text identifies which gauge is used.
  const id=b.dataset.pulseRegion;
  if(typeof window.LAKE_BUOY_CHOOSE==='function')window.LAKE_BUOY_CHOOSE(id);
 }));
 render();
}
window.LAKE_INSIGHTS={
 start,report(data){state.report=data;state.health.report='ready';render();},
 observations(data){state.observations=data;state.health.observations=data?.status==='unavailable'?'unavailable':'ready';render();},
 reviewed(data){state.reviewed=data;state.health.reviewed='ready';render();},
 unavailable(kind){if(kind in state.health)state.health[kind]='unavailable';render();},
 setLake,getState:()=>({...state}),init
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
