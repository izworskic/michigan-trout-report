/* Research-led Great Lakes Hexagenia atlas, not a live insect detector.
   Region pins below are APPROXIMATE place anchors, not sampling coordinates.
   Historical sources describe lake sectors, often decades ago. Do not imply
   those places currently have an active hatch or particular local density.
   Live buoy widgets are separate and never rank these destinations. */
(function(){
'use strict';
const SOURCES={
 erie:'https://www.usgs.gov/publications/distribution-and-abundance-burrowing-mayflies-hexagenia-spp-lake-erie-1997-2005',
 erieShore:'https://www.usgs.gov/publications/recovery-burrowing-mayflies-ephemeroptera-ephemeridae-hexagenia-western-lake-erie',
 huron:'https://www.sciencedirect.com/science/article/abs/pii/S0380133014000562',
 michigan:'https://www.usgs.gov/publications/burrowing-mayflies-indicators-ecosystem-health-status-populations-western-lake-erie',
 superior:'https://www.usgs.gov/publications/burrowing-mayflies-indicators-ecosystem-health-status-populations-two-western-lake',
 ontario:'https://publications.gc.ca/collections/Collection/En40-11-35-2003E.pdf',
 stclair:'https://www.michiganseagrant.org/blog/2024/03/11/when-will-the-mayflies-arrive/'
};
const SPOTS=Object.freeze([
 {id:'bass-islands',lake:'Erie',name:'Bass Islands & western basin',near:'Put-in-Bay / western Lake Erie',lat:41.654,lon:-82.818,
  year:'1997–2005',kind:'extensive_benthic_research',level:'strong_historical',
  headline:'The most scientifically established lake Hexagenia area in this atlas.',
  evidence:'Lake Erie nymph surveys documented substantial burrowing-mayfly populations in the western basin, including island areas. Abundance varied by sampling year and location.',
  why:'Shallow western-basin sediments, oxygen and development matter. No current swarm can be inferred from these historical population surveys.',
  where:'Map pin is Put-in-Bay as a broad orientation landmark, not a sampled nymph location.',source:SOURCES.erie,liveRegion:'western-erie'},
 {id:'port-clinton',lake:'Erie',name:'Port Clinton & Ohio shoreline',near:'Port Clinton / Sandusky shores',lat:41.512,lon:-82.937,
  year:'1990s–2000s',kind:'regional_shore_context',level:'shore_watch',
  headline:'A useful shore-facing place to understand western Erie mass-emergence reports.',
  evidence:'USGS documented burrowing-mayfly recolonization and increasingly large adult swarms along western Lake Erie shores. Evidence is for the lake sector, not a verified swarm at this exact pin.',
  why:'Wind and nighttime lighting affect what people see on shore; a shoreline report does not identify the lakebed emergence location.',
  where:'Port Clinton is a public geographic reference, not the position of a confirmed hatch.',source:SOURCES.erieShore,liveRegion:'western-erie'},
 {id:'tawas-shore',lake:'Huron',name:'Tawas City shoreline',near:'Tawas City / Saginaw Bay',lat:44.269,lon:-83.515,
  year:'2010; sampled 2009–12',kind:'documented_adult_swarms',level:'documented_historical',
  headline:'Researchers actually counted adult Hexagenia swarms near this shoreline.',
  evidence:'A published study counted adult swarms at three Tawas-area illuminated sites in June 2010, while finding much lower bay nymph abundance than pre-decline historical levels.',
  why:'This is meaningful historic swarm evidence, not proof that all Saginaw Bay shorelines now support abundant hatches.',
  where:'Approximate public town location; the field-study sites are not plotted.',source:SOURCES.huron,liveRegion:'saginaw-bay'},
 {id:'northern-green-bay',lake:'Michigan',name:'Northern Green Bay',near:'Western Door County / northern bay',lat:45.119,lon:-87.252,
  year:'2001 research',kind:'localized_benthic_samples',level:'limited_historical',
  headline:'Northern-bay populations have a documented scientific basis, but evidence is sparse.',
  evidence:'A USGS study found Hexagenia nymphs at only 6 of 48 Green Bay stations; densities and biomass were greatest toward the northern end of the bay.',
  why:'This does not establish a current mass-swarm destination in Door County. Lower Green Bay historically lost much of its population.',
  where:'Approximate northern Green Bay region anchor, not a study-station location.',source:SOURCES.michigan,liveRegion:null},
 {id:'chequamegon-bay',lake:'Superior',name:'Chequamegon Bay',near:'Ashland / Washburn, Wisconsin',lat:46.610,lon:-90.885,
  year:'2002 research',kind:'benthic_population',level:'documented_historical',
  headline:'A real, researched Lake Superior embayment—not a generic open-water guess.',
  evidence:'USGS researchers found burrowing-mayfly nymphs generally abundant in suitable cohesive fine sediments within the surveyed western Superior embayment.',
  why:'Their fieldwork documented nymph populations, not a modern visible adult swarm or a June/July arrival date.',
  where:'Approximate Ashland-area shoreline pin for orientation only; not a scientific sample location. Sampling extended around the bay.',source:SOURCES.superior,liveRegion:null},
 {id:'st-louis-estuary',lake:'Superior',name:'St. Louis River estuary',near:'Duluth / Superior harbor region',lat:46.745,lon:-92.105,
  year:'2002 research',kind:'patchy_benthic_population',level:'qualified_historical',
  headline:'Hexagenia habitat exists in parts of this estuary, but it is sharply patchy.',
  evidence:'USGS surveys found nymphs in suitable substrates, but none at 11 sampled eastern St. Louis Bay / harbor sites affected by contaminated sediments.',
  why:'Neither downtown Duluth nor the entire harbor is a documented mass-hatch hotspot. Conditions are not transferable across the estuary.',
  where:'Approximate estuary orientation, not the point of a confirmed emergence.',source:SOURCES.superior,liveRegion:null},
 {id:'bay-of-quinte',lake:'Ontario',name:'Bay of Quinte',near:'Belleville / eastern Lake Ontario',lat:44.160,lon:-77.382,
  year:'2003 ecosystem assessment',kind:'historical_recovery',level:'qualified_historical',
  headline:'Lake Ontario has a documented recovery story, but not a reliable live Hex forecast here.',
  evidence:'The 2003 State of the Great Lakes assessment reported that burrowing mayflies had returned to Bay of Quinte. That statement is historical and does not document current density or mass swarms.',
  why:'The main deep open lake and a productive sheltered bay are ecologically different. The site currently has no verified fresh lakebed sensor or swarm record.',
  where:'Belleville-area pin is orientation only, not a scientific sample site.',source:SOURCES.ontario,liveRegion:null},
 {id:'lake-st-clair',lake:'Connecting waters',name:'Lake St. Clair',near:'St. Clair Shores / Detroit region',lat:42.482,lon:-82.884,
  year:'Published lake-science guidance',kind:'documented_lake_population',level:'strong_historical',
  headline:'A major Great Lakes basin fish-fly location, but not one of the five lakes.',
  evidence:'Michigan Sea Grant explicitly addresses summer Hexagenia arrivals on the western shores of Lake St. Clair and western Lake Erie.',
  why:'Lake St. Clair is not one of the five Great Lakes. It is included as a well-documented connecting water, not falsely classified as Lake Huron or Lake Erie.',
  where:'St. Clair Shores is an orientation location, not a verified current hatch.',source:SOURCES.stclair,liveRegion:null}
]);
const ids=new Set(SPOTS.map(s=>s.id));
if(ids.size!==SPOTS.length)throw Error('Duplicate atlas location');
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const LAKES=['All five','Superior','Michigan','Huron','Erie','Ontario','Connecting waters'];
let activeLake='All five',selected='bass-islands';
let markerSelect=null;
function grade(p){
 const labels={strong_historical:'Extensive historic nymph research',
 documented_historical:'Historic field observations',
 shore_watch:'Regional shore watch · not local hatch proof',
 limited_historical:'Sparse older sampling',
 qualified_historical:'Historic evidence with major caveats'};
 return labels[p.level]||'Research context';
}
function card(p){
 return '<button type="button" class="atlas-spot'+(selected===p.id?' selected':'')+'" data-atlas-site="'+esc(p.id)+'" aria-pressed="'+String(selected===p.id)+'">'+
  '<span class="atlas-lake">LAKE '+esc(p.lake.toUpperCase())+'</span>'+
  '<strong>'+esc(p.name)+'</strong><span class="atlas-near">'+esc(p.near)+'</span>'+
  '<span class="atlas-proof">'+esc(grade(p))+'</span>'+
  '</button>';
}
function detail(p){
 const link=p.liveRegion
  ?'<a class="atlas-action" href="#stationH" data-atlas-buoy="'+esc(p.liveRegion)+'">View the '+esc(p.liveRegion==='western-erie'?'western Erie':'Saginaw Bay')+' buoy watch ↓</a>'
  :'<span class="atlas-monitor-note">No validated live buoy model for this exact place. Do not borrow temperatures from another lake.</span>';
 $('atlasDetail').innerHTML=
  '<div class="atlas-detail-head"><div><div class="atlas-lake">LAKE '+esc(p.lake.toUpperCase())+' · '+esc(p.year)+'</div>'+
  '<h3>'+esc(p.name)+'</h3><p>'+esc(p.near)+'</p></div><span class="atlas-class">'+esc(grade(p))+'</span></div>'+
  '<p class="atlas-leading">'+esc(p.headline)+'</p>'+
  '<div class="atlas-facts"><div><strong>What scientists actually documented</strong><p>'+esc(p.evidence)+'</p></div>'+
  '<div><strong>What this does not prove</strong><p>'+esc(p.why)+'</p></div></div>'+
  '<p class="atlas-disclosure">'+esc(p.where)+'</p>'+
  '<div class="atlas-actions"><a href="'+esc(p.source)+'" target="_blank" rel="noopener">Read original research ↗</a>'+link+'</div>';
 $('atlasDetail').querySelector('[data-atlas-buoy]')?.addEventListener('click',()=>{
  window.LAKE_BUOY_CHOOSE?.(p.liveRegion);
 });
}
function render(){
 if(!$('atlasSites'))return;
 const visible=SPOTS.filter(p=>activeLake==='All five'?p.lake!=='Connecting waters':p.lake===activeLake);
 $('atlasSites').innerHTML=visible.map(card).join('');
 $('atlasSites').querySelectorAll('[data-atlas-site]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.atlasSite)));
 document.querySelectorAll('[data-lake]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lake===activeLake)));
 $('atlasCount').textContent=visible.length+' research-led location'+(visible.length===1?'':'s');
 const location=SPOTS.find(x=>x.id===selected)||visible[0]||SPOTS[0];detail(location);
}
function select(id,pan=true){
 const p=SPOTS.find(s=>s.id===id);if(!p)return;
 if(activeLake!=='All five'&&activeLake!==p.lake)activeLake='All five';
 selected=id;render();
 if(pan&&markerSelect)markerSelect(p);
}
function init(){
 document.querySelectorAll('[data-lake]').forEach(b=>b.addEventListener('click',()=>{
  activeLake=b.dataset.lake;
  const match=SPOTS.find(p=>activeLake==='All five'?p.lake!=='Connecting waters':p.lake===activeLake);
  if(match)selected=match.id;
  render();if(match&&markerSelect)markerSelect(match);
 }));
 render();
}
window.LAKE_ATLAS={spots:SPOTS,select,init,onMapSelect(fn){markerSelect=fn},selected:()=>selected};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
