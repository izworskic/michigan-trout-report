import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync('public/great-lakes-mayflies.html','utf8');
const script=readFileSync('public/lake-mayfly-atlas.js','utf8');
const css=readFileSync('public/lake-mayfly-atlas.css','utf8');
function atlas(){
 const root={LAKE_ATLAS:null};
 const doc={readyState:'loading',addEventListener(){}};
 new Script(script).runInNewContext({window:root,document:doc,Set,Map,Array,String,URL,Math,Error});
 return root.LAKE_ATLAS;
}
test('atlas independently identifies exactly five Great Lakes with researched local areas',()=>{
 const list=atlas().spots;
 const lakeNames=[...new Set(list.filter(x=>x.lake!=='Connecting waters').map(x=>x.lake))];
 assert.deepEqual(lakeNames.sort(),['Erie','Huron','Michigan','Ontario','Superior']);
 assert(list.length>=8);
 assert.equal(new Set(list.map(x=>x.id)).size,list.length);
 assert(list.some(x=>x.id==='chequamegon-bay'));
 assert(list.some(x=>x.id==='bay-of-quinte'));
 assert(list.some(x=>x.id==='bass-islands'));
 assert(list.some(x=>x.id==='northern-green-bay'));
 assert(list.some(x=>x.id==='tawas-shore'));
 assert(list.some(x=>x.id==='lake-st-clair'&&x.lake==='Connecting waters'));
});
test('every place has a real research source, dated context and major absence-of-hatch caveat',()=>{
 const list=atlas().spots;
 for(const p of list){
  assert(typeof p.year==='string'&&p.year.length>3,p.id);
  assert(/^(https:\/\/www\.usgs\.gov|https:\/\/www\.sciencedirect\.com|https:\/\/publications\.gc\.ca|https:\/\/www\.michiganseagrant\.org)/.test(p.source),p.id);
  assert(p.evidence.length>=90&&p.why.length>=70&&p.headline.length>30,p.id);
  assert(/not |no |does not |cannot |neither |neither/i.test(p.why),p.id+' must warn against overconfident interpretation');
  assert(p.where.toLowerCase().includes('not')||p.where.toLowerCase().includes('approximate'),p.id);
  assert(Number.isFinite(p.lat)&&Number.isFinite(p.lon));
  assert(p.liveRegion===null||['western-erie','saginaw-bay'].includes(p.liveRegion),p.id);
  assert(!/forecastNow|chanceOfHatch|predictionScore/.test(JSON.stringify(p)));
 }
});
test('map no longer contains unauthorized CARTO watermarks and only instruments existing two buoys',()=>{
 assert(!html.includes('basemaps.cartocdn.com'));
 assert(html.includes('tile.openstreetmap.org/{z}/{x}/{y}.png'));
 assert(html.includes('if(!window.L||!data)'));
 assert(html.includes('L.divIcon'));
 assert(html.includes('REGION.forEach'));
 assert(html.includes('data.spots.forEach'));
 assert(html.includes('window.LAKE_BUOY_CHOOSE=choose'));
 assert(html.includes("current='western-erie'"));
 assert(html.includes('NOAA surface water'));
});
test('atlas is the primary five-lake user experience, legacy live sensors still have own lower section',()=>{
 for(const id of ['atlas','atlasTitle','atlasCount','atlasSites','atlasDetail',
   'lakeMap','stationH','waterTemp','trendChart','observationList','reviewEventList']){
  assert(html.includes('id="'+id+'"'),id);
 }
 assert(html.indexOf('id="atlas"')<html.indexOf('id="stationH"'));
 assert(html.indexOf('id="atlas"')<html.indexOf('id="observationList"'));
 assert(html.includes('src="/lake-mayfly-atlas.js?v=2"'));
 assert(html.includes('href="/lake-mayfly-atlas.css?v=2"'));
 assert(!html.includes('No map key required.</p>'));
 assert(html.includes('Research history is not a forecast for tonight'));
 assert(css.includes('@media(max-width:620px)'));
});
test('all newly added scripts and unchanged original page inline JS parse',()=>{
 assert.doesNotThrow(()=>new Script(script));
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
 .filter(x=>!/src=/i.test(x[1])&&!/application\/ld\+json/i.test(x[1]));
 assert(scripts.length>=1);
 scripts.forEach((x,i)=>assert.doesNotThrow(()=>new Script(x[2],{filename:'inline '+i})));
});
test('the two live sensor endpoints remain separate and no new inferred sensor appears',()=>{
 assert(html.includes('/api/lake-mayflies?region='));
 assert(html.includes('/api/lake-hex-observations?region='));
 assert(html.includes('/api/lake-hatch-events?region='));
 const live=atlas().spots.filter(x=>x.liveRegion!==null);
 assert(live.every(x=>['western-erie','saginaw-bay'].includes(x.liveRegion)));
 assert(live.length<atlas().spots.length);
});


test('visual redesign is a materially new five-lake map-first experience, not old compact hero/sidebar',()=>{
 assert(html.includes('Five lakes.'));
 assert(html.includes('atlas-cinematic-hero'));
 assert(html.includes('atlas-hero-specimen'));
 assert(html.includes('atlas-hero-statline'));
 assert(html.includes('02 / THE INTERACTIVE MAP'));
 assert(html.includes('Choose a place. Discover its story.'));
 assert(html.includes('class="lake-navigation"'));
 assert.equal((html.match(/<button type="button" data-lake=/g)||[]).length,6);
 assert(html.includes('class="lake-navigation-extra" data-lake="Connecting waters"'), 'Lake St Clair must remain outside the five Great Lakes tiles');
 assert(html.indexOf('class="lake-navigation"')<html.indexOf('<main>'),'large lake selectors must be above the map');
 assert(html.indexOf('id="lakeMap"')<html.indexOf('id="atlasSites"'),'full-width map must precede research cards');
 assert(html.indexOf('id="atlasSites"')<html.indexOf('id="atlasDetail"'));
 assert(html.includes('id="atlasMapLabel"'));
 assert(html.includes('window.LAKE_BUOY_CHOOSE=choose'));
 assert(html.includes("data.onLakeChange((lake,selected)=>"));
 assert(html.includes("map.removeLayer(pin)"),'nonmatching pins must be filtered');
 assert(css.includes('.atlas-cinematic-hero h1'));
 assert(css.includes('.lake-navigation .atlas-switch'));
 assert(css.includes('.atlas-map-wrap #lakeMap{height:548px!important'));
 assert(css.includes('scroll-snap-type:x mandatory'));
 assert(!html.includes('Saginaw Bay & Western Lake Erie</title>'));
});
test('lake navigation updates both map and editorial state without inventing live monitoring',()=>{
 assert(script.includes('lakeChanged(activeLake,match)'));
 assert(script.includes("lakeChanged(activeLake,p)"));
 assert(script.includes('currentLake:()=>activeLake'));
 assert(script.includes("activeLake==='All five'?'ALL FIVE GREAT LAKES'"));
 assert(script.includes("aria-pressed"));
 const buf=JSON.stringify(atlas().spots);
 assert(!buf.includes('chanceOfHatch'));
 assert(!buf.includes('forecastNow'));
});
