// Experience enhancements for Michigan's trout-river mayfly board.
// Reuses existing NOAA-free / USGS + NWS report, no extra HTTP requests.
// Maps temperature observations and explicit experimental bands; no hatch detections.
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 const FLY={
   hex:{label:'Hexagenia',time:'After dark',fly:'Large Hex nymph / extended-body dry',seasons:[[6,7]],explain:'The legendary night hatch depends on suitable slow, sandy or silty habitat and development. A warm gauge is a clue, not evidence of emergence.'},
   hendrickson:{label:'Hendrickson',time:'Afternoons',fly:'Hendrickson dry / Red Quill',seasons:[[4,5]],explain:'An early-season dry-fly signal: warming spring water can favor afternoon emergence. Stream sections respond differently.'},
   'brown-drake':{label:'Brown Drake',time:'Dusk',fly:'Brown Drake dry and spinner',seasons:[[5,7]],explain:'Brown Drakes tend to favor suitable sand-bottom stretches. Dusk spinner activity and daytime emergence are different observations.'},
   sulphur:{label:'Sulphur',time:'Evenings',fly:'Pale-yellow emerger and rusty spinner',seasons:[[5,7]],explain:'Sulphur groups can have overlapping hatches. Weather and water temperature are only supporting clues.'},
   bwo:{label:'Blue-Winged Olive',time:'Cool / overcast afternoons',fly:'Tiny BWO emerger / parachute',seasons:[[3,5],[9,11]],explain:'Small olives can be active on cooler, cloudy days during separate spring and fall windows.'}
 };
 let selection='red-oak';
 function board(){return window.MayflyBoard?.get?.()||null;}
 const detroitMonth=()=>Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Detroit',month:'numeric'}).format(new Date()));
 function labelDate(iso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso)))return String(iso||'');
  const d=new Date(iso+'T12:00:00Z');
  return d.toLocaleDateString('en-US',{timeZone:'America/Detroit',month:'short',day:'numeric'});
 }
 function svgChart(report){
  const raw=report?.outlook?.history||[];
  const historical=raw.filter(h=>Number.isFinite(h.meanF)&&/^\d{4}-\d{2}-\d{2}$/.test(h.date)).slice(-7);
  const scenarios=(report?.outlook?.days||[]).filter(d=>d.dayNumber<=3&&d.tempBand&&Number.isFinite(d.tempBand.lowF)&&Number.isFinite(d.tempBand.highF));
  const measured=Number.isFinite(report?.waterTempF)&&report?.observedAt?report.waterTempF:null;
  if(!historical.length&&measured===null){
   return '<p class="data-empty">No measured water-temperature series is available for this gauge. A flow-only station cannot supply a temperature graph or a modeled hatch-window forecast.</p>';
  }
  const history=historical.length?historical:measured!==null?[{date:report.observedAt.slice(0,10),meanF:measured}]:[];
  const values=[...history.map(h=>h.meanF),...scenarios.flatMap(d=>[d.tempBand.lowF,d.tempBand.highF])];
  if(!values.length)return '<p class="data-empty">Measured water history is unavailable.</p>';
  const min=Math.floor((Math.min(...values,68)-3)/5)*5,max=Math.ceil((Math.max(...values,68)+3)/5)*5;
  const ymin=Math.max(20,min),ymax=Math.min(95,Math.max(ymin+10,max));
  const w=700,h=252,padL=46,padR=22,padT=21,padB=42;
  const plotW=w-padL-padR,plotH=h-padT-padB;
  const count=history.length+scenarios.length;
  const x=i=>padL+(count===1?plotW/2:plotW*i/(count-1));
  const y=t=>padT+(ymax-t)/(ymax-ymin)*plotH;
  let svg='<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="USGS measured daily water temperatures and experimental three-day temperature scenario ranges in degrees Fahrenheit">';
  for(let t=Math.ceil(ymin/5)*5;t<=ymax;t+=5){
   if(t%10!==0&&t!==68)continue;
   svg+='<line x1="'+padL+'" x2="'+(w-padR)+'" y1="'+y(t)+'" y2="'+y(t)+'" stroke="#e4ebe4"/>';
   svg+='<text x="5" y="'+(y(t)+4)+'" font-size="12" fill="#64796e">'+t+'°</text>';
  }
  svg+='<line x1="'+padL+'" x2="'+(w-padR)+'" y1="'+y(68)+'" y2="'+y(68)+'" stroke="#a97841" stroke-width="2" stroke-dasharray="5 5"/>';
  svg+='<text x="'+(w-19)+'" y="'+(y(68)-7)+'" text-anchor="end" font-size="11" font-weight="700" fill="#936b3b">68°F trout caution</text>';
  if(history.length>=2)svg+='<polyline points="'+history.map((p,i)=>x(i)+','+y(p.meanF)).join(' ')+'" fill="none" stroke="#19795a" stroke-width="3" stroke-linejoin="round"/>';
  history.forEach((p,i)=>{
    const px=x(i);
    svg+='<circle cx="'+px+'" cy="'+y(p.meanF)+'" r="4" fill="#19795a"/>';
    svg+='<text x="'+px+'" y="'+(h-15)+'" font-size="11" text-anchor="middle" fill="#637c6e">'+esc(labelDate(p.date))+'</text>';
  });
  if(scenarios.length&&history.length){
   svg+='<line x1="'+x(history.length-1)+'" y1="'+y(history.at(-1).meanF)+'" x2="'+x(history.length)+'" y2="'+y(scenarios[0].tempBand.centerF)+'" stroke="#bb8850" stroke-dasharray="4 5" stroke-width="2"/>';
  }
  scenarios.forEach((d,i)=>{
   const px=x(history.length+i),b=d.tempBand;
   svg+='<line x1="'+px+'" x2="'+px+'" y1="'+y(b.lowF)+'" y2="'+y(b.highF)+'" stroke="#c28c49" stroke-width="9" stroke-linecap="round"/>';
   svg+='<circle cx="'+px+'" cy="'+y(b.centerF)+'" r="4" fill="#ffffff" stroke="#b28046" stroke-width="2"/>';
   svg+='<text x="'+px+'" y="'+(h-15)+'" font-size="11" text-anchor="middle" fill="#936b3b">'+esc(labelDate(d.date))+'*</text>';
  });
  svg+='</svg>';
  const note=scenarios.length?'* Amber bars are experimental low–high water-temperature scenarios, not future measurements or confirmed hatches.':'No experimental scenario is shown without adequate recent measured history and weather.';
  return svg+'<p class="experience-subnote">'+esc(note)+'</p>';
 }
 function seasonHTML(fly){
  const meta=FLY[fly]||FLY.hex,m=detroitMonth();
  let html='<div class="season-track" role="img" aria-label="Broad typical months for '+esc(meta.label)+' activity">';
  for(let i=1;i<=12;i++){
   const active=meta.seasons.some(([a,b])=>i>=a&&i<=b);
   html+='<div class="season-cell '+(active?'in-season ':'')+(i===m?'current':'')+'"><span>'+MONTHS[i-1]+'</span><b>'+((active)?'●':'·')+'</b></div>';
  }
  return html+'</div><p class="experience-subnote"><strong>Highlighted months:</strong> broad Michigan field-guide timing only, not a prediction for your selected river. Outlined month is the current month.</p>';
 }
 function weatherTiles(report,fly){
  const data=report?.outlook?.days||[];
  if(!data.length)return '<p class="data-empty">Seven-day outlook currently unavailable.</p>';
  return data.map(d=>{
   const item=(d.species||[]).find(s=>s.id===fly);
   const week=d.dayNumber>3;
   const warm=d.safety==='measured_heat_caution'||d.safety==='possible_heat_caution';
   let label=warm?'Trout heat caution':item?.signal||'Seasonal / weather context';
   if(d.confidence==='unavailable')label='Forecast unavailable';
   if(!item&&d.confidence!=='unavailable'&&d.dayNumber<=3&&!warm)label='No species signal';
   const air=d.weather&&Number.isFinite(d.weather.meanAirF)?Math.round(d.weather.meanAirF)+'°F air':'Air unavailable';
   const wind=d.weather&&Number.isFinite(d.weather.maxWindMph)?Math.round(d.weather.maxWindMph)+' mph wind':'Wind unavailable';
   const span=d.tempBand?'Water scenario '+Math.round(d.tempBand.lowF)+'–'+Math.round(d.tempBand.highF)+'°F':'No water-temperature projection';
   return '<article class="weather-tile"><div class="weather-date">'+esc(labelDate(d.date))+'</div><div class="weather-meta">'+(week?'Days 4–7 · weather only':d.tempBand?'Experimental day '+d.dayNumber:'Seasonal context')+'</div><strong>'+esc(label)+'</strong><div class="weather-air">'+esc(air)+'</div><div class="weather-wind">'+esc(wind)+'</div><p>'+esc(span)+'</p></article>';
  }).join('');
 }
 function setText(id,value){const x=$(id);if(x)x.textContent=value;}
 function syncChoices(spots){
  const nav=$('stationChoices');if(!nav)return;
  if(nav.dataset.initialized==='1')return;nav.dataset.initialized='1';
  nav.innerHTML=spots.map(s=>'<button type="button" data-station="'+esc(s.id)+'" aria-pressed="'+String(s.id===selection)+'">'+esc(s.river)+' · '+esc(s.name.split('·').at(-1).trim())+'</button>').join('');
  nav.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
   selection=b.dataset.station;
   render();
  }));
 }
 function render(){
  const b=board();if(!b)return;
  const {spots,loaded,chosen}=b;
  syncChoices(spots);
  const spot=spots.find(x=>x.id===selection)||spots[0];
  const report=loaded.get(spot.id)||null;
  const meta=FLY[chosen]||FLY.hex;
  $('stationChoices')?.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.station===spot.id)));
  b.highlight?.(spot.id);
  setText('experienceFly',meta.label);
  setText('experienceRiver',spot.name);
  setText('experienceTime',meta.time);
  setText('experiencePattern',meta.fly);
  setText('experienceExplain',meta.explain);
  $('seasonTimeline').innerHTML=seasonHTML(chosen);
  if(!report||report.error){
   setText('experienceStatus',report?.error?'USGS or weather service unavailable':'Checking river observations…');
   setText('experienceHeadline',report?.error?'Live data cannot be checked right now.':'Reading the station and local weather…');
   setText('experienceWhy','No measured reading means we cannot make a current hatch-readiness claim.');
   setText('experienceDataQuality','Waiting for USGS + NWS sources.');
   $('riverTempGraph').innerHTML='<p class="data-empty">No measured water temperatures to plot yet.</p>';
   $('outlookTiles').innerHTML='<p class="data-empty">Waiting for the seven-day outlook.</p>';
   return;
  }
  const item=report.species?.find(s=>s.id===chosen);
  const season=item?.signal==='Off season';
  const water=report.waterTempF;
  const hot=report.troutHeatCaution;
  const measured=Number.isFinite(water);
  setText('experienceStatus',season?'Off season':hot?'Trout heat caution':measured?item?.signal||'Conditions unknown':'Temperature unavailable');
  setText('experienceHeadline',season?meta.label+' season is not active at this gauge today.'
   :hot?'Measured water is at or above 68°F. Trout safety comes before chasing a hatch.'
   :measured?'Measured river water is '+water.toFixed(1)+'°F. This is a conditions watch, not a reported hatch.'
   :'There is no fresh water-temperature measurement at this gauge.');
  setText('experienceWhy',item?.reason||'A confirmed hatch requires direct sightings and suitable stream habitat.');
  let quality=measured?'USGS measured '+water.toFixed(1)+'°F at '+spot.station+' · '+new Date(report.observedAt).toLocaleString('en-US',{timeZone:'America/Detroit',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET'
   :'USGS '+spot.station+' · measured river temperature unavailable';
  setText('experienceDataQuality',quality+' · weather '+(report.dataQuality?.weather||'unknown'));
  setText('experienceScope',spot.scope);
  const outlook=report.outlook||{};
  setText('experienceModel',outlook.confidence||'No forecast confidence information available.');
  $('riverTempGraph').innerHTML=svgChart(report);
  $('outlookTiles').innerHTML=weatherTiles(report,chosen);
 }
 // Called from the existing page after a gauge response or fly selection.
 window.MayflyExperience={notify:render,selectStation:id=>{
   const b=board();if(b?.spots?.some(s=>s.id===id)){selection=id;render();$('riverStory')?.scrollIntoView({behavior:'smooth',block:'start'});}
 }};
 // Defer script runs after document parse; initial responses are also guarded.
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);
 else render();
})();
