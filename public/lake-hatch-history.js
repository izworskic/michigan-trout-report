/* Source-linked historical lake mayfly chronology.
 * A dated report is not a modern sensor, a recurring hatch date, or proof
 * that insects emerged at the site's public map pin. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const labels={
 documented_adult_swarms:'Scientifically sampled adults',
 reported_mass_swarm:'Contemporaneous shoreline report',
 community_first_sighting:'Community first sighting (not a hatch)'
};
const categories={
 documented_adult_swarms:'field',
 reported_mass_swarm:'reported',
 community_first_sighting:'first'
};
const months=['May','Jun','Jul','Aug','Sep'];
let dataset=null,status='loading',lake='All five',site=null,focus=null;
function setText(id,s){if($(id))$(id).textContent=s;}
function dates(e){
 const format=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'});
 return e.firstDate===e.lastDate?format(e.firstDate):format(e.firstDate)+'–'+format(e.lastDate);
}
function filtered(){
 if(!dataset?.entries)return [];
 return dataset.entries.filter(e=>(lake==='All five'||e.lake===lake)&&(!site||e.siteId===site));
}
function available(e){
 if(!focus)return true;
 const [yr,mon]=focus.split('-');
 return e.firstDate.slice(0,4)===yr&&e.firstDate.slice(5,7)===mon;
}
function render(){
 const root=$('historyRecords');if(!root)return;
 const all=filtered();
 const visible=all.filter(available);
 setText('historyScope',site?'RESEARCH AREA · '+(dataset?.entries.find(e=>e.siteId===site)?.place||site).toUpperCase():
  lake==='All five'?'ALL FIVE LAKES + CONNECTING WATER':'LAKE '+lake.toUpperCase());
 setText('historyCount',status==='ready'?all.length+' source-linked record'+(all.length===1?'':'s'):status==='unavailable'?'Archive unavailable':'Checking published records…');
 for(const btn of document.querySelectorAll('[data-history-lake]')){
  btn.setAttribute('aria-pressed',String(!site&&btn.dataset.historyLake===lake));
 }
 if(status!=='ready'){
  $('historyMatrix').innerHTML='<p class="history-empty">'+(status==='unavailable'?'The historical source archive is unavailable, not an absence of hatch reports.':'Loading historical source records…')+'</p>';
  root.innerHTML='<p class="history-empty">No unsupported hatch dates are displayed.</p>';
  return;
 }
 const years=[...new Set(all.map(e=>e.firstDate.slice(0,4)))].sort();
 const matrix=$('historyMatrix');
 if(!years.length){
  matrix.innerHTML='<p class="history-empty">No exact-dated adult swarm or first-sighting record has been validated for this selection. The location may still have historical nymph research; an empty archive is not an absence of mayflies.</p>';
 }else{
  const cells=[...years].flatMap(year=>months.map((m,i)=>{
   const mm=String(i+5).padStart(2,'0');
   const list=all.filter(e=>e.firstDate.slice(0,7)===year+'-'+mm);
   const cn=year+'-'+mm;
   const selected=cn===focus;
   return '<button type="button" data-history-cell="'+cn+'" aria-pressed="'+String(selected)+'" class="history-cell'+(list.length?' populated':'')+(selected?' focused':'')+'" title="'+esc(year+' '+m+' · '+list.length+' sourced records')+'" aria-label="'+esc(year+' '+m+': '+list.length+' dated source entries')+'">'+
    (list.length?list.map(e=>'<span class="history-dot '+categories[e.category]+'" aria-hidden="true"></span>').join(''):'<span class="history-cell-empty" aria-hidden="true">·</span>')+
    '</button>';
  }));
  matrix.innerHTML='<div class="history-matrix" role="group" aria-label="Verified publication-linked record dates by year and month">'+
   '<div class="history-cell-spacer">Year</div>'+months.map(m=>'<div class="history-month">'+m+'</div>').join('')+
   years.map((y,i)=>'<div class="history-year">'+y+'</div>'+cells.slice(i*5,i*5+5).join('')).join('')+'</div>';
  matrix.querySelectorAll('[data-history-cell]').forEach(b=>b.addEventListener('click',()=>{
   focus=focus===b.dataset.historyCell?null:b.dataset.historyCell;
   render();
  }));
 }
 const a=$('historyClear');
 if(a){a.hidden=!focus;a.textContent=focus?'Show all source dates':'';}
 if(!all.length)root.innerHTML='<p class="history-empty">No event-level dates passed the source rules for this lake or research area. This does NOT indicate that Hexagenia are absent. Explore the lake habitat research above, or choose another lake.</p>';
 else if(!visible.length)root.innerHTML='<p class="history-empty">No dated records in the selected month and year. Other archived years are still available.</p>';
 else root.innerHTML=visible.map(e=>'<article class="history-event"><div class="history-event-when"><strong>'+esc(dates(e))+'</strong><span class="history-category '+categories[e.category]+'">'+esc(labels[e.category])+'</span></div>'+
  '<div class="history-event-body"><strong>'+esc(e.place)+'</strong><span>'+esc(e.lake==='Connecting waters'?'Lake St. Clair · connecting waters':'Lake '+e.lake)+'</span><p>'+esc(e.description)+'</p>'+
  '<p class="history-limit"><strong>Limit:</strong> '+esc(e.limitation)+'</p><a href="'+esc(e.sourceURL)+'" rel="noopener" target="_blank">Original evidence · '+esc(e.sourceName)+' ↗</a></div></article>').join('');
 setText('historySummary',all.length?
  'Showing '+visible.length+' of '+all.length+' dated source record'+(all.length===1?'':'s')+'. These are separate literature/news/community entries, not the official human-reviewed mass-event ledger.':
  'Only confirmed source dates are shown. There is no invented peak day for lakes with insufficient reports.');
}
function setLake(value){
 if(!['All five','Erie','Huron','Superior','Michigan','Ontario','Connecting waters'].includes(value))return;
 lake=value;site=null;focus=null;render();
}
function setSite(id,lakeName){
 if(typeof id!=='string'||!id)return;
 site=id;lake=lakeName||'All five';focus=null;render();
}
function init(){
 document.querySelectorAll('[data-history-lake]').forEach(b=>b.addEventListener('click',()=>{
  setLake(b.dataset.historyLake);
 }));
 $('historyClear')?.addEventListener('click',()=>{focus=null;render();});
 render();
 fetch('/api/lake-hatch-history',{headers:{Accept:'application/json'}})
  .then(r=>{if(!r.ok)throw Error('History API '+r.status);return r.json();})
  .then(data=>{
   if(!data?.success||!Array.isArray(data.entries))throw Error('Invalid history response');
   dataset=data;status='ready';render();
  })
  .catch(()=>{status='unavailable';render();});
}
window.LAKE_PUBLISHED_HISTORY={setLake,setSite,getSnapshot:()=>({lake,site,focus,status,count:filtered().length})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
