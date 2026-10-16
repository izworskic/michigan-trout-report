import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {parseNdbcStandard,lakeMetrics} from '../lib/lake-mayflies.js';

const page=readFileSync('public/great-lakes-mayflies.html','utf8');
const js=readFileSync('public/lake-mayfly-insights.js','utf8');
const css=readFileSync('public/lake-mayfly-insights.css','utf8');
function fakeDOM(){
 const elements=new Map();
 const element=id=>{
  if(!elements.has(id))elements.set(id,{id,textContent:'',innerHTML:'',style:{},dataset:{},
   setAttribute(){},addEventListener(){},querySelectorAll(){return [];},classList:{add(){},remove(){},toggle(){}}});
  return elements.get(id);
 };
 const doc={readyState:'loading',getElementById:element,querySelectorAll(){return [];},addEventListener(){}};
 const w={LAKE_BUOY_CHOOSE:null};
 new Script(js,{filename:'lake-mayfly-insights.js'}).runInNewContext({window:w,document:doc,Date,Intl,Number,Array,String,Math,Map,Set,Object,RegExp});
 return {elements,element,app:w.LAKE_INSIGHTS,window:w};
}
const now='2026-06-23T13:00:00Z';
const report=(temperature=67)=>({generatedAt:now,seasonActive:true,region:{id:'western-erie'},
 metrics:{waterTempF:temperature,measuredAt:'2026-06-23T11:00:00Z',trendF:1.4,
  history:Array.from({length:14},(_,i)=>({
    date:new Date(Date.UTC(2026,5,9+i,12)).toISOString().slice(0,10),
    minF:temperature-3,maxF:temperature,meanF:temperature-1.5,samples:6
   }))},
 evenings:Array.from({length:7},(_,i)=>({
   date:new Date(Date.UTC(2026,5,23+i,12)).toISOString().slice(0,10),
   coverageHours:5,maxEveningWindMph:3+i,wetHours:0
 })),
 sourceHealth:{weatherProxy:'Toledo shoreline'}
});
const specimens={success:true,status:'records_found',latestDate:'2026-06-22',
 records:[{id:1,date:'2026-06-22',taxon:'Hexagenia limbata'}]};
const reviewed={success:true,reviewStandard:'Editorial',recent14Days:0,
 events:[],currentHatchConfirmed:false};
test('extended NOAA history parses 8-day-old rows and charts up to 14 measured dates',()=>{
 const at=new Date('2026-06-23T14:00:00Z');
 const head='#YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS PTDY TIDE\n'+
 '#yr mo dy hr mn degT m/s m/s m sec sec degT hPa degC degC degC nmi hPa ft\n';
 const row=d=>d+' 180 2 4 0.3 4 MM 210 1012 18 20 MM MM MM MM';
 const obs=parseNdbcStandard(head+row('2026 06 14 12 00')+'\n'+row('2026 06 23 12 00')+'\n','45165',at);
 assert.equal(obs.length,2,'oldest record must extend beyond old six-day ingestion window');
 const values=Array.from({length:16},(_,i)=>({
  at:new Date(Date.UTC(2026,5,23-i,12)).toISOString(),
  waterF:62+i*.2,windMph:4
 }));
 const metrics=lakeMetrics(values,at);
 assert.equal(metrics.history.length,14);
 assert.equal(metrics.history[0].date,'2026-06-10');
});
test('dashboard has genuine SVG charts, labels, sensor selector, 30-day timeline and evidence disclaimers',()=>{
 for(const id of ['mayflyInsights','pulseMainTitle','pulseScope','pulseTitle','pulseExplain',
  'pulseWater','pulseReviewed','pulseLatest','pulseTempGraph','pulseEvidenceGraph',
  'pulseSeasonChart','pulseStageRail','pulseEveningGraph','pulseEvidenceFoot']){
  assert(page.includes('id="'+id+'"'),id);
 }
 assert(page.includes('src="/lake-mayfly-insights.js?v=1"'));
 assert(page.includes('href="/lake-mayfly-insights.css?v=1"'));
 assert.equal((page.match(/data-pulse-region=/g)||[]).length,2);
 assert(page.indexOf('id="atlas"')<page.indexOf('id="mayflyInsights"'));
 assert(page.indexOf('id="mayflyInsights"')<page.indexOf('id="stationH"'));
 assert(css.includes('grid-template-columns:repeat(4,minmax(0,1fr))'));
 assert(css.includes('@media(max-width:620px)'));
 assert.doesNotThrow(()=>new Script(js));
 for(const script of [...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(x=>!/src=/i.test(x[1])&&!/application\/ld\+json/i.test(x[1]))){
   assert.doesNotThrow(()=>new Script(script[2]));
 }
});
test('real conditions stage cannot become hatch-on just because 68 F was reached',()=>{
 const {app,element}=fakeDOM();
 app.start('western-erie');app.report(report(70));app.observations(specimens);app.reviewed(reviewed);
 assert.equal(element('pulseTitle').textContent,'Surface thermal watch');
 assert(!/hatching now|confirmed active|100%/i.test(element('pulseTitle').textContent));
 assert.match(element('pulseExplain').textContent,/neither an observed emergence/i);
 assert.equal(element('pulseReviewed').textContent,'0');
 assert.match(element('pulseReviewedDetail').textContent,/not proof of no hatch/i);
 assert.match(element('pulseTempGraph').innerHTML,/<svg/);
 assert.match(element('pulseTempGraph').innerHTML,/68°F western Erie surface reference/);
 assert.match(element('pulseEvidenceGraph').innerHTML,/<svg/);
 assert.match(element('pulseEveningGraph').innerHTML,/pulse-evening/);
 assert.match(element('pulseSeasonChart').innerHTML,/June–August/);
});
test('recent reviewed mass event is a past dated event, never current swarm confirmation',()=>{
 const {app,element}=fakeDOM();
 app.start('western-erie');
 app.report(report(71));
 app.observations(specimens);
 app.reviewed({...reviewed,recent14Days:1,events:[{
  id:'2026-06-22-western-erie-shoreline-swarm',eventDate:'2026-06-22'
 }]});
 assert.equal(element('pulseTitle').textContent,'Recent past swarm documented');
 assert.match(element('pulseExplain').textContent,/does not prove a swarm is happening now/);
 assert.equal(element('pulseReviewed').textContent,'1');
 assert.match(element('pulseEvidenceFoot').textContent,/1 reviewed event/);
});
test('off-season stays off-season even if warm temperatures were measured',()=>{
 const {app,element}=fakeDOM();
 app.start('western-erie');
 app.report({...report(72),seasonActive:false,generatedAt:'2026-10-16T14:00:00Z'});
 app.reviewed(reviewed);app.observations({...specimens,records:[]});
 assert.equal(element('pulseTitle').textContent,'Outside broad season');
 assert.match(element('pulseExplain').textContent,/June–August/);
 assert.equal(element('pulseWater').textContent,'72.0°F');
});
test('other lakes show no synthetic station information or borrowed chart',()=>{
 const {app,element}=fakeDOM();
 app.start('western-erie');app.report(report(71));app.reviewed(reviewed);app.observations(specimens);
 app.setLake('Superior');
 assert.match(element('pulseTitle').textContent,/No calibrated sensor for Lake Superior/);
 assert.equal(element('pulseWater').textContent,'—');
 assert.doesNotMatch(element('pulseTempGraph').innerHTML,/<svg/);
 assert.match(element('pulseEvidenceGraph').innerHTML,/only supported for western Erie and Saginaw Bay/);
 assert.match(element('pulseScope').textContent,/LAKE SUPERIOR/);
 app.setLake('All five');
 assert.match(element('pulseTempGraph').innerHTML,/<svg/);
});
test('Huron water reading does not inherit the western Erie 68 F threshold',()=>{
 const {app,element}=fakeDOM();
 app.start('saginaw-bay');
 app.report(report(69));app.reviewed(reviewed);app.observations(specimens);
 assert.equal(element('pulseTitle').textContent,'Water conditions observed');
 assert.match(element('pulseExplain').textContent,/no validated local 68°F/);
 assert.doesNotMatch(element('pulseTempGraph').innerHTML,/68°F western Erie surface reference/);
});
test('missing observations and sensor outage never render false zero or a hatch confirmation',()=>{
 const {app,element}=fakeDOM();
 app.start('saginaw-bay');
 app.unavailable('report');app.unavailable('observations');app.unavailable('reviewed');
 assert.equal(element('pulseWater').textContent,'—');
 assert.equal(element('pulseReviewed').textContent,'—');
 assert.match(element('pulseTempGraph').innerHTML,/Measured history unavailable/);
 assert.match(element('pulseEvidenceGraph').innerHTML,/feeds unavailable/);
 assert(!/confirmed hatch/i.test(element('pulseTitle').textContent));
});
test('only bounded, explicitly sampled research records are counted, not all-time iNaturalist totals',()=>{
 const {app,element}=fakeDOM();
 app.start('western-erie');app.report(report(67));
 app.reviewed(reviewed);
 app.observations({...specimens,totalMatched:100000,recentDisplayed:1});
 assert.match(element('pulseEvidenceFoot').textContent,/1 photo-supported specimen record/);
 assert.match(element('pulseEvidenceFoot').textContent,/only its 12 most recent eligible records/);
 assert.doesNotMatch(element('pulseEvidenceFoot').textContent,/100000/);
});
test('existing NOAA, reviewed-event and photo-specimen callbacks are reused with stale-response guards',()=>{
 for(const method of ["start","report","observations","reviewed","unavailable"]){
 assert(page.includes('window.LAKE_INSIGHTS?.'+method+'?.('),method);
 }
 assert(page.includes('if(requestToken!==reqCounter)return;'));
 assert(page.includes('if(count!==reqCounter)return;'));
 const atlas=readFileSync('public/lake-mayfly-atlas.js','utf8');
 assert(atlas.includes('window.LAKE_INSIGHTS?.setLake?.(activeLake)'));
});
