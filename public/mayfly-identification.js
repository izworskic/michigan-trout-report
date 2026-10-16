// Visual mayfly field guide, sourced specimens. No cloud uploads and no auto-ID.
// All images are sourced from Wikimedia Commons with file-level credits.
(() => {
'use strict';
const root=document.getElementById('mayflyPhotoGuide');
if(!root)return;
const PHOTOS=[
 {id:'hendrickson',stage:'Nymph · aquatic stage',name:'Hendrickson',taxon:'Ephemerella subvaria',when:'Mid-April – May',behavior:'Often afternoon',
  shade:'Reddish-brown / warm tan',size:'Medium',scale:'Around #12–14',
  clues:'Photo shows a submerged nymph (no wings). Adult Hendricksons have gray upright wings and tan-to-reddish-brown bodies; compare stage before matching.',
  image:'/images/mayflies/hendrickson.webp',
  source:'https://commons.wikimedia.org/wiki/File:Spiny_crawler_mayfly,_Ephemerella_subvaria.jpg',credit:'Bob Henricks',license:'CC BY-SA 2.0',
  sizeKey:'medium',colorKey:'brown',timeKey:['afternoon']},
 {id:'brown-drake',stage:'Adult · winged',name:'Brown Drake',taxon:'Ephemera simulans',when:'Late May – early July',behavior:'Dusk / evening',
  shade:'Tan to brown, often mottled',size:'Large',scale:'Around #8–12',
  clues:'Broad-winged, large brown/tan mayfly; look for patterning and dusk flights. Can resemble other big burrowers.',
  image:'/images/mayflies/brown-drake.webp',
  source:'https://commons.wikimedia.org/wiki/File:Ephemera_simulans_male.jpg',credit:'Beatriz Moisset',license:'CC BY-SA 4.0',
  sizeKey:'large',colorKey:'brown',timeKey:['evening']},
 {id:'hex',stage:'Adult · winged',name:'Hexagenia · Hex',taxon:'Hexagenia limbata',when:'Mid-June – July',behavior:'After dark',
  shade:'Tan / pale golden to brown',size:'Very large',scale:'Around #4–8',
  clues:'A striking large-bodied mayfly; often appears after sunset in suitable sand-and-silt reaches. Do not identify only by a porch-light sighting.',
  image:'/images/mayflies/hex.webp',
  source:'https://commons.wikimedia.org/wiki/File:Hexagenia_limbata_(giant_mayfly)_(Mitchell,_South_Dakota,_USA)_1.jpg',credit:'James St. John',license:'CC BY 2.0',
  sizeKey:'large',colorKey:'brown',timeKey:['night']},
 {id:'sulphur',stage:'Nymph · aquatic stage',name:'Sulphur',taxon:'Ephemerella dorothea (example)',when:'Late May – July',behavior:'Evening',
  shade:'Pale yellow / creamy',size:'Small to medium',scale:'Around #14–18',
  clues:'Photo shows an aquatic nymph (brown), NOT the pale-yellow winged adult. Sulphur adults are often creamy or yellow and fly in the evening.',
  image:'/images/mayflies/sulphur.webp',
  source:'https://commons.wikimedia.org/wiki/File:Spiny_crawler_mayfly,_Ephemerella_dorothea_(8561750415).jpg',credit:'Bob Henricks',license:'CC BY-SA 2.0',
  sizeKey:'medium',colorKey:'yellow',timeKey:['evening']},
 {id:'bwo',stage:'Adult · winged',name:'Blue-Winged Olive',taxon:'Baetis tricaudatus (example)',when:'Spring and fall',behavior:'Cool / cloudy afternoons',
  shade:'Olive / dusky',size:'Tiny to small',scale:'Around #16–22',
  clues:'Small olive-bodied mayflies, commonly with smoky gray wings. “BWO” covers several look-alike taxa.',
  image:'/images/mayflies/bwo.webp',
  source:'https://commons.wikimedia.org/wiki/File:Baetis_tricaudatus_male_imago.jpg',credit:'Jerry Friedman',license:'CC BY-SA 3.0',
  sizeKey:'small',colorKey:'olive',timeKey:['afternoon']}
];
let current='hex',previewURL=null;
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderCards(){
 const dest=$('mayflyPhotoCards');if(!dest)return;
 dest.innerHTML=PHOTOS.map(p=>'<article class="id-card'+(current===p.id?' picked':'')+'" data-identifies="'+p.id+'">'+
 '<a class="id-photo" target="_blank" rel="noopener" href="'+esc(p.source)+'" aria-label="Open original photo and license details for '+esc(p.name)+'"><img loading="lazy" decoding="async" src="'+esc(p.image)+'" alt="Photographed '+esc(p.taxon)+' shown as '+esc(p.stage)+'; species examples vary by sex and life stage"><span class="id-photo-fallback">View original photo and license ↗</span><span class="id-stage">'+esc(p.stage)+'</span></a>'+
 '<div class="id-card-inner"><div class="id-season">'+esc(p.when)+'</div><h3>'+esc(p.name)+'</h3><div class="id-latin">'+esc(p.taxon)+'</div>'+
 '<div class="id-keyline"><span>'+esc(p.size)+' · '+esc(p.scale)+'</span><span>'+esc(p.behavior)+'</span></div>'+
 '<p>'+esc(p.clues)+'</p><button type="button" data-pick-fly="'+p.id+'">Check '+esc(p.name)+' forecast →</button>'+
 '<small class="id-credit">Reference: <a href="'+esc(p.source)+'" target="_blank" rel="noopener">'+esc(p.credit)+'</a>, '+esc(p.license)+' · Wikimedia Commons</small></div></article>').join('');
 dest.querySelectorAll('[data-pick-fly]').forEach(btn=>btn.addEventListener('click',()=>{
  const fly=btn.dataset.pickFly;
  window.MayflyBoard?.selectFly?.(fly);
  updateSelected(fly);
  document.querySelector('#flySelect')?.scrollIntoView({behavior:'smooth',block:'start'});
 }));
}
function updateSelected(fly){
 if(!PHOTOS.some(p=>p.id===fly))return;
 current=fly;
 root.querySelectorAll('[data-identifies]').forEach(e=>e.classList.toggle('picked',e.dataset.identifies===fly));
}
function candidates(){
 const size=$('idSize')?.value||'',color=$('idColor')?.value||'',time=$('idTime')?.value||'';
 const hasClue=size||color||time;
 const list=PHOTOS.map(p=>{
  let score=0,matches=[];
  if(size&&p.sizeKey===size){score+=2;matches.push('size');}
  if(color&&p.colorKey===color){score+=2;matches.push('color');}
  if(time&&p.timeKey.includes(time)){score+=1;matches.push('time of day');}
  return {p,score,matches};
 }).sort((a,b)=>b.score-a.score||PHOTOS.findIndex(x=>x.id===a.p.id)-PHOTOS.findIndex(x=>x.id===b.p.id));
 const leading=hasClue?list.filter(x=>x.score===list[0].score && x.score>0):[];
 const dest=$('idCandidates');
 dest.innerHTML=!hasClue
  ?'<p>Select one or more clues to compare likely-looking reference flies.</p>'
  :leading.length
   ?'<strong>Compare these first, not a confirmed ID:</strong> '+leading.map(x=>'<button type="button" data-match-fly="'+esc(x.p.id)+'">'+esc(x.p.name)+' · '+esc(x.matches.join(' + '))+'</button>').join('')+
     '<p>Other mayflies can share these traits. Wings, body size, tail filaments, stage, locality and a clear photo help narrow it down.</p>'
   :'<p>No strong match in the five example groups. Try a different size, color, or time; many other Michigan mayflies exist.</p>';
 dest.querySelectorAll('[data-match-fly]').forEach(b=>b.addEventListener('click',()=>{
  const id=b.dataset.matchFly;updateSelected(id);
  root.querySelector('[data-identifies="'+id+'"]')?.scrollIntoView({behavior:'smooth',block:'center'});
 }));
}
function initPhoto(){
 const input=$('idPhotoInput'),preview=$('idPhotoPreview'),reset=$('idPhotoClear');
 if(!input||!preview)return;
 input.addEventListener('change',()=>{
  if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}
  const f=input.files?.[0];
  if(!f){preview.hidden=true;return;}
  if(!/^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(f.type)||f.size>10*1024*1024){
   $('idPhotoNote').textContent='Select an image up to 10 MB (JPEG, PNG, WebP, GIF or supported HEIC). The photo stays on your device.';
   input.value='';preview.hidden=true;return;
  }
  previewURL=URL.createObjectURL(f);
  preview.src=previewURL;preview.hidden=false;
  $('idPhotoNote').textContent='Your photo is visible only in this browser. It has not been sent to the website or classified by AI. Compare it to the credited specimens below.';
  reset.hidden=false;
 });
 reset?.addEventListener('click',()=>{
  input.value='';preview.hidden=true;preview.removeAttribute('src');reset.hidden=true;
  if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}
  $('idPhotoNote').textContent='Optional: select a photo on your device and compare it side by side. Nothing is uploaded.';
 });
 window.addEventListener('pagehide',()=>{if(previewURL)URL.revokeObjectURL(previewURL);});
}
renderCards();
['idSize','idColor','idTime'].forEach(id=>$(id)?.addEventListener('change',candidates));
candidates();initPhoto();
window.MayflyID={updateSelected,photoCount:PHOTOS.length};
})();
