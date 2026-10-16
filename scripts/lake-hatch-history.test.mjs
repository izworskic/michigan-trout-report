import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {PUBLISHED_LAKE_EVENTS} from '../data/published-lake-mayfly-events.js';
import {LAKES,CATEGORIES,SITES,lakeHistory,validateHistory} from '../lib/published-lake-history.js';
import handler from '../api/lake-hatch-history.js';

const HTML=readFileSync('public/great-lakes-mayflies.html','utf8');
const JS=readFileSync('public/lake-hatch-history.js','utf8');
const CSS=readFileSync('public/lake-hatch-history.css','utf8');
const NOW=new Date('2026-10-16T18:00:00Z');

test('nine dated source-linked records distinguish adult samples, contemporaneous reports, and first sightings',()=>{
 const entries=validateHistory(PUBLISHED_LAKE_EVENTS,NOW);
 assert.equal(entries.length,9);
 assert.equal(new Set(entries.map(e=>e.id)).size,9);
 assert.deepEqual([...new Set(entries.map(e=>e.category))].sort(),[...CATEGORIES].sort());
 assert(entries.every(e=>e.sourceURL.startsWith('https://')));
 assert(entries.some(e=>e.id==='tawas-2010'&&e.firstDate==='2010-06-22'&&e.lastDate==='2010-06-24'));
 assert(entries.some(e=>e.id==='port-clinton-2024'&&e.firstDate==='2024-06-09'));
 assert(entries.some(e=>e.id==='lake-st-clair-2024'&&e.firstDate==='2024-06-02'));
 assert(entries.some(e=>e.id==='first-port-clinton-2025'&&e.firstDate==='2025-06-06'));
});
test('all five lakes are browsable; unsupported source dates fail closed, not an absence-of-hatch assertion',()=>{
 assert.deepEqual([...LAKES],['Superior','Michigan','Huron','Erie','Ontario','Connecting waters']);
 assert(SITES.includes('bass-islands'));
 for(const lake of ['Michigan','Superior','Ontario']){
  const r=lakeHistory({lake,now:NOW});
  assert.equal(r.total,0);
  assert.equal(r.entries.length,0);
  assert.match(r.coverage,/not evidence of no historic hatch/i);
 }
 const all=lakeHistory({now:NOW});
 assert.equal(all.total,9);
 assert.equal(all.isCurrentHatchConfirmed,false);
 assert.deepEqual(all.byCategory,{documented_adult_swarms:1,reported_mass_swarm:3,community_first_sighting:5});
 assert.deepEqual([...all.years],[2010,2021,2022,2023,2024,2025]);
 assert.equal(lakeHistory({lake:'Huron',now:NOW}).total,1);
 assert.equal(lakeHistory({lake:'Connecting waters',now:NOW}).total,1);
 assert.equal(lakeHistory({site:'port-clinton',now:NOW}).total,7);
 assert.equal(lakeHistory({site:'bass-islands',now:NOW}).total,0);
});
test('source validation rejects spurious days, hidden private metadata, missing IDs, and faked verification',()=>{
 const bad=(patch)=>[{...PUBLISHED_LAKE_EVENTS[0],...patch}];
 assert.throws(()=>validateHistory(bad({lastDate:'2010-07-30'}),NOW),/invalid or invented date/);
 assert.throws(()=>validateHistory(bad({firstDate:'2010-06-31'}),NOW),/invalid or invented date/);
 assert.throws(()=>validateHistory(bad({firstDate:'2027-06-22',lastDate:'2027-06-23'}),NOW),/invalid or invented date/);
 assert.throws(()=>validateHistory(bad({sourceURL:'http://localhost/internal'}),NOW),/ungrounded source/);
 assert.throws(()=>validateHistory(bad({category:'documented_adult_swarms',sourceType:'community_year_table'}),NOW),/scientific event without study/);
 assert.throws(()=>validateHistory(bad({privateReporterEmail:'someone@example.com'}),NOW),/unexpected field/);
 assert.throws(()=>validateHistory(bad({reviewedBy:'an imaginary person'}),NOW),/unexpected field/);
 assert.throws(()=>validateHistory([PUBLISHED_LAKE_EVENTS[0],PUBLISHED_LAKE_EVENTS[0]],NOW),/duplicate ID/);
});
async function invoke(query={},method='GET'){
 const props={status:200,headers:{},body:null};
 const res={
  setHeader(k,v){props.headers[k]=v;return this;},
  status(s){props.status=s;return this;},
  json(v){props.body=v;return this;},
  end(){return this;}
 };
 await handler({query,method},res);
 return props;
}
test('API returns dated evidence for site/lake and rejects unsupported input',async()=>{
 const all=await invoke();
 assert.equal(all.status,200);assert.equal(all.body.entries.length,9);
 assert.match(all.headers['Cache-Control'],/s-maxage=86400/);
 assert.equal((await invoke({lake:'Huron'})).body.total,1);
 assert.equal((await invoke({lake:'Erie',site:'port-clinton'})).body.total,7);
 assert.equal((await invoke({lake:'Ontario'})).body.total,0);
 assert.equal((await invoke({lake:'Lake Fake'})).status,400);
 assert.equal((await invoke({site:'unknown'})).status,400);
 assert.equal((await invoke({},'POST')).status,405);
 assert.equal((await invoke({},'OPTIONS')).status,204);
});
test('published historical chart is prominent, sourced, scoped, and separated from existing field feeds',()=>{
 for(const id of ['publishedHatchHistory','historyTitle','historyMatrix','historyRecords',
 'historyCount','historyScope','historyClear','historySummary']){
  assert(HTML.includes('id="'+id+'"'),id);
 }
 assert(HTML.indexOf('id="mayflyInsights"')<HTML.indexOf('id="publishedHatchHistory"'));
 assert(HTML.indexOf('id="publishedHatchHistory"')<HTML.indexOf('id="pulseStageRail"'));
 assert(HTML.includes('src="/lake-hatch-history.js?v=1"'));
 assert(HTML.includes('href="/lake-hatch-history.css?v=1"'));
 assert(HTML.includes('/api/lake-mayflies?region='));
 assert(HTML.includes('/api/lake-hex-observations?region='));
 assert(HTML.includes('/api/lake-hatch-events?region='));
 assert.equal((HTML.match(/data-history-lake=/g)||[]).length,7);
 assert(CSS.includes('.history-matrix'));
 assert(CSS.includes('.history-records'));
 assert(CSS.includes('@media(max-width:480px)'));
 assert.doesNotThrow(()=>new Script(JS));
 const bodyScripts=[...HTML.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(
  x=>!/src=/i.test(x[1])&&!/application\/ld\+json/i.test(x[1]));
 bodyScripts.forEach((x,i)=>assert.doesNotThrow(()=>new Script(x[2],{filename:'lake-history-inline-'+i})));
 const atlas=readFileSync('public/lake-mayfly-atlas.js','utf8');
 assert(atlas.includes('window.LAKE_PUBLISHED_HISTORY?.setSite?.(id,p.lake)'));
 assert(atlas.includes('window.LAKE_PUBLISHED_HISTORY?.setLake?.(activeLake)'));
});
test('front-end chart renders dates with separated categories and never claims a current hatch',()=>{
 const els=new Map();
 const root=id=>{
  if(!els.has(id))els.set(id,{id,innerHTML:'',textContent:'',hidden:false,
    dataset:{},querySelectorAll:()=>[],setAttribute(){},addEventListener(){},
  });
  return els.get(id);
 };
 const callbacks=[];
 const doc={
  readyState:'loading',getElementById:root,querySelectorAll(){return [];},
  addEventListener(event,fn){if(event==='DOMContentLoaded')callbacks.push(fn);}
 };
 const win={};
 const fetch=async()=>({ok:true,json:async()=>lakeHistory({now:NOW})});
 new Script(JS).runInNewContext({document:doc,window:win,fetch,Intl,Date,Set,Map,String,Math,Array,Number,RegExp});
 assert.equal(callbacks.length,1);
 callbacks[0]();
 // Force processed payload through scheduled promise microtasks.
 return new Promise((resolve,reject)=>setImmediate(()=>{
   try{
    assert.equal(win.LAKE_PUBLISHED_HISTORY.getSnapshot().status,'ready');
    assert.match(root('historyMatrix').innerHTML,/2010/);
    assert.match(root('historyRecords').innerHTML,/Siersma/);
    assert.match(root('historyRecords').innerHTML,/FIRST SIGHTING/);
    assert.doesNotMatch(root('historyRecords').innerHTML,/hatching right now/i);
    win.LAKE_PUBLISHED_HISTORY.setLake('Superior');
    assert.match(root('historyMatrix').innerHTML,/No exact-dated adult swarm/);
    assert.equal(win.LAKE_PUBLISHED_HISTORY.getSnapshot().count,0);
    win.LAKE_PUBLISHED_HISTORY.setLake('Erie');
    assert.equal(win.LAKE_PUBLISHED_HISTORY.getSnapshot().count,7);
    win.LAKE_PUBLISHED_HISTORY.setSite('bass-islands','Erie');
    assert.equal(win.LAKE_PUBLISHED_HISTORY.getSnapshot().count,0);
    resolve();
   }catch(e){reject(e);}
 }));
});
