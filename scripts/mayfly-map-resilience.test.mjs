import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const page=readFileSync('public/michigan-mayfly-hatches.html','utf8');
const cfg=JSON.parse(readFileSync('vercel.json','utf8'));

test('fresh page has a prominent true hero and real photographed flies above the map',()=>{
 const hero=page.indexOf('class="hero-landscape"');
 const quick=page.indexOf('class="hatch-quick-grid"');
 const map=page.indexOf('id="riverMap"');
 const guide=page.indexOf('id="mayflyPhotoGuide"');
 assert(hero>0&&hero<quick&&quick<map&&map<guide);
 const imageSources=[...page.matchAll(/<img\b[^>]*src="(\/images\/mayflies\/[^"]+)"/g)].map(m=>m[1]);
 assert(imageSources.includes('/images/mayflies/ausable-sunset-hero.webp'));
 for(const id of ['hex','brown-drake','bwo','hendrickson','sulphur']){
  assert(imageSources.includes('/images/mayflies/'+id+'.webp'));
 }
 for(const src of imageSources){
  const data=readFileSync('public'+src);
  assert(data.length>5000,src+' missing or truncated');
  assert.equal(data.toString('ascii',0,4),'RIFF',src);
  assert.equal(data.toString('ascii',8,12),'WEBP',src);
 }
});

test('current map needs no token and older pages must revalidate',()=>{
 const source=page.slice(page.indexOf('function initMap(){'),page.indexOf('window.MayflyBoard={'));
 assert(source.includes('https://tile.openstreetmap.org/{z}/{x}/{y}.png'));
 assert(!/carto[_-]?api[_-]?key|access_token=|mapboxgl|google\.maps|maptiler/i.test(source));
 assert(source.includes('tileDeadline=setTimeout(fallbackIfNoTiles,8000)'));
 assert(source.includes('osm.on(\'tileerror\''));
 assert(source.includes('osm.on(\'tileload\''));
 const rule=cfg.headers.find(h=>h.source==='/michigan-mayfly-hatches.html');
 assert(rule,'header required for mobile cache recovery');
 assert(rule.headers.some(h=>h.key==='Cache-Control'&&/max-age=0, must-revalidate/.test(h.value)));
});

function simulateMap({library=true}={}){
 const calls={timers:[],cleared:[],tileHandlers:{},removed:0};
 const view={
  innerHTML:'',replaceChildren(){this.innerHTML='';},
  querySelectorAll(){return[];}
 };
 const spot={id:'test-station',lat:44.43,lon:-85.15,river:'Manistee',name:'Manistee · Sample Station',station:'04123500'};
 const L={
  map(){return{
   setView(){return this;},fitBounds(){return this;},
   remove(){calls.removed++;}
  };},
  tileLayer(){return{
   on(name,handler){calls.tileHandlers[name]=handler;return this;},
   addTo(){return this;}
  };},
  circleMarker(){return{
   addTo(){return this;},bindTooltip(){return this;},bindPopup(){return this;},
   on(){return this;},setStyle(){}
  };},
  latLngBounds(){return{pad(){return this;}}}
 };
 const start=page.indexOf('function drawFallbackLocator(){');
 const end=page.indexOf('window.MayflyBoard={',start);
 assert(start>0&&end>start);
 const snippet=page.slice(start,end);
 const ctx=createContext({
  window:{L:library?L:null},
  L,SPOTS:[spot],
  $:()=>view,esc:s=>String(s),
  setTimeout:(fn,ms)=>{calls.timers.push({fn,ms});return calls.timers.length;},
  clearTimeout:id=>calls.cleared.push(id),
  map:null,markers:{},
 });
 new Script(snippet+'\ninitMap();',{filename:'map-isolated-test.js'}).runInContext(ctx);
 return {calls,view,ctx};
}
test('if external map tiles silently hang, local interactive locator appears at eight seconds',()=>{
 const {calls,view}=simulateMap();
 assert.equal(view.innerHTML,'');
 assert.equal(calls.timers.length,1);
 assert.equal(calls.timers[0].ms,8000);
 calls.timers[0].fn();
 assert.match(view.innerHTML,/Monitoring station locator/);
 assert.match(view.innerHTML,/data-fallback-station="test-station"/);
 assert.match(view.innerHTML,/Schematic/);
 assert.equal(calls.removed,1);
});
test('successful tiles cancel timeout and preserve geographic map',()=>{
 const {calls,view}=simulateMap();
 calls.tileHandlers.tileload();
 assert(calls.cleared.includes(1));
 calls.timers[0].fn();
 assert.equal(view.innerHTML,'');
 assert.equal(calls.removed,0);
});
test('missing Leaflet library immediately displays the local map, not API errors',()=>{
 const {view,calls}=simulateMap({library:false});
 assert.match(view.innerHTML,/Monitoring station locator/);
 assert.equal(calls.timers.length,0);
});
test('two tile loading errors switch to local station map without user intervention',()=>{
 const {calls,view}=simulateMap();
 calls.tileHandlers.tileerror();
 assert.equal(view.innerHTML,'');
 calls.tileHandlers.tileerror();
 assert.match(view.innerHTML,/Monitoring station locator/);
});
