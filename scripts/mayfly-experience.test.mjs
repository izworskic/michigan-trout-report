import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const html=readFileSync('public/michigan-mayfly-hatches.html','utf8');
const js=readFileSync('public/mayfly-experience.js','utf8');
const css=readFileSync('public/mayfly-experience.css','utf8');

test('new chart and explanatory experience is linked and all critical targets exist',()=>{
 for(const id of ['riverStory','riverTempGraph','stationChoices','seasonTimeline',
   'experienceHeadline','experienceWhy','experienceScope','experienceModel',
   'experienceDataQuality','outlookTiles','riverComparison']){
   assert(html.includes('id="'+id+'"'),id+' not found');
 }
 assert(html.includes('src="/mayfly-experience.js"'));
 assert(html.includes('href="/mayfly-experience.css"'));
 assert(css.includes('.story-evidence'));
 assert(css.includes('max-width:680px'));
 assert(html.includes('CARTO'));
 assert(html.includes('Experimental'));
});

test('a missing CARTO API key cannot make this page inaccessible',()=>{
 assert(!/key=\$\{|access_token=|carto_api_key|api-key-needed/i.test(html));
 assert(html.includes('basemaps.cartocdn.com/light_all'));
 assert(html.includes('tile.openstreetmap.org/'));
 assert(html.includes('function drawFallbackLocator'));
 assert(html.includes('if(!window.L){drawFallbackLocator();return;}'));
 assert(html.includes('osm.on(\'tileerror\''));
 assert(html.includes('data-fallback-station'));
 assert(html.includes('aria-label="Approximate relative location'));
});

test('inline page JS and independently cached experience JS parse',()=>{
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m=>!/src=/i.test(m[1])&&!/application\/ld\+json/i.test(m[1]));
 assert(scripts.length>=1);
 scripts.forEach((s,i)=>assert.doesNotThrow(()=>new Script(s[2],{filename:'inline-'+i})));
 assert.doesNotThrow(()=>new Script(js,{filename:'mayfly-experience.js'}));
});

test('field experience charts measured readings and never turns off-season into a claim',()=>{
 const elements=new Map();
 const node=id=>{if(!elements.has(id))elements.set(id,{
  id,textContent:'',innerHTML:'',dataset:{},querySelectorAll:()=>[],
  scrollIntoView(){},setAttribute(){},addEventListener(){}
 });return elements.get(id);};
 const fresh='2026-10-16T10:00:00Z';
 const reports=new Map([['red-oak',{
  observedAt:fresh,waterTempF:51.3,flowCfs:1010,troutHeatCaution:false,
  species:[{id:'hex',signal:'Off season',reason:'Outside the usual hatch window.'}],
  dataQuality:{weather:'NWS hourly forecast'},
  outlook:{history:[{date:'2026-10-15',meanF:52.1},{date:'2026-10-16',meanF:51.3}],
   days:[{dayNumber:1,date:'2026-10-17',safety:'none',confidence:'season-only',tempBand:null,
     species:[],weather:{meanAirF:51,maxWindMph:10}}],
   confidence:'Seven-day weather and seasonal context only'}
 }]]);
 const spots=[{id:'red-oak',name:'Au Sable · Red Oak',river:'Au Sable',station:'04136000',
  scope:'Only station area'}, {id:'pere-marquette',name:'Pere Marquette · Scottville',
  river:'Pere Marquette',station:'04122500',scope:'Flow only'}];
 reports.set('pere-marquette',{waterTempF:null,observedAt:null,outlook:{history:[],days:[]},species:[]});
 const w={MayflyBoard:{get:()=>({spots,loaded:reports,chosen:'hex',highlight:()=>{}})}};
 const document={readyState:'loading',getElementById:node,addEventListener(){}};
 new Script(js).runInNewContext({window:w,document,Intl,Date,Number,Math,Map,Set,Array,String,RegExp,URL});
 w.MayflyExperience.notify();
 assert.equal(node('experienceStatus').textContent,'Off season');
 assert.match(node('experienceHeadline').textContent,/not active/i);
 assert.match(node('riverTempGraph').innerHTML,/<svg/);
 assert.match(node('riverTempGraph').innerHTML,/USGS/);
 assert.match(node('riverComparison').innerHTML,/No fresh water temperature/);
 assert.match(node('seasonTimeline').innerHTML,/Jun/);
 assert.match(node('outlookTiles').innerHTML,/Seasonal/);
 // Selecting the uninstrumented flow-only station must fail closed.
 w.MayflyExperience.selectStation('pere-marquette');
 assert.match(node('experienceHeadline').textContent,/no fresh water-temperature measurement/i);
 assert.doesNotMatch(node('riverTempGraph').innerHTML,/<svg/);
 assert.match(node('riverTempGraph').innerHTML,/flow-only station/i);
});
