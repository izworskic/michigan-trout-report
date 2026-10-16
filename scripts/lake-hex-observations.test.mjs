import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {OBSERVATION_AREAS,observationQuery,normalizeObservations,buildObservationEvidence} from '../lib/lake-hex-observations.js';
import handler,{fetchInat} from '../api/lake-hex-observations.js';
const now=new Date('2026-07-22T15:00:00Z');
function record(id,extra={}){
 return {id,observed_on:'2026-07-18',taxon:{name:'Hexagenia limbata'},
  quality_grade:'research',photos:[{id:42}],...extra};
}
function responseMock(){
 return {code:0,headers:{},setHeader(k,v){this.headers[k]=v;},
  status(code){this.code=code;return this;},
  json(body){this.body=body;return this;},end(){this.ended=true;return this;}};
}
test('regional API query is taxon-limited, one-year, photo-supported, and bounded to the right lake area',()=>{
 const one=new URL(observationQuery('western-erie',now));
 const two=new URL(observationQuery('saginaw-bay',now));
 assert.equal(one.hostname,'api.inaturalist.org');
 assert.equal(one.searchParams.get('taxon_name'),'Hexagenia');
 assert.equal(one.searchParams.get('quality_grade'),'research');
 assert.equal(one.searchParams.get('photos'),'true');
 assert.equal(one.searchParams.get('d1'),'2025-07-22');
 assert.equal(one.searchParams.get('per_page'),'100');
 assert.equal(one.searchParams.get('swlat'),'41.3');
 assert.equal(two.searchParams.get('swlat'),'43.4');
 assert.notEqual(one.searchParams.get('nelng'),two.searchParams.get('nelng'));
 assert.throws(()=>observationQuery('../../anything',now));
 assert.equal(Object.keys(OBSERVATION_AREAS).length,2);
});
test('normalization excludes casual/no-photo/wrong-taxon/invalid-date/duplicates/future',()=>{
 const raw={results:[
 record(10),record(10),record(11,{quality_grade:'needs_id'}),record(12,{photos:[]}),
 record(13,{taxon:{name:'Ephemera simulans'}}),record(14,{observed_on:'2025-01-01'}),
 record(15,{observed_on:'2026-02-30'}),record(16,{observed_on:'2026-07-29'}),
 record(17,{observed_on:'2026-06-22'}),record(18,{observed_on:'2026-07-17',taxon:{name:'Hexagenia'}})
 ]};
 const list=normalizeObservations(raw,now);
 assert.deepEqual(list.map(x=>x.id),[10,18,17]);
 assert.equal(list[0].url,'https://www.inaturalist.org/observations/10');
 assert.equal(list[0].hatchEvidence,'Not independently verified as a hatch');
 assert.equal(Object.hasOwn(list[0],'latitude'),false);
 assert.equal(Object.hasOwn(list[0],'image'),false);
});
test('taxonomic observation count never becomes a confirmed hatch claim',()=>{
 const evidence=buildObservationEvidence({region:'western-erie',now,
  payload:{total_results:52,results:[record(8),record(9,{observed_on:'2026-06-10'})]}});
 assert.equal(evidence.status,'records_found');
 assert.equal(evidence.latestDate,'2026-07-18');
 assert.equal(evidence.hatchVerification,'not_verified');
 assert.equal(evidence.recentDisplayed,1);
 assert.equal(evidence.totalMatched,52);
 assert.equal(evidence.records.length,2);
 assert.match(evidence.disclosure,/not emergence/i);
 assert(evidence.sourceUrl.includes('swlat=41.3'));
});
test('no records and a broken observation feed have DISTINCT statuses',()=>{
 const empty=buildObservationEvidence({region:'saginaw-bay',now,payload:{results:[],total_results:0}});
 const broken=buildObservationEvidence({region:'saginaw-bay',now,sourceAvailable:false});
 assert.equal(empty.status,'no_matching_records');
 assert.equal(broken.status,'unavailable');
 assert.equal(broken.totalMatched,null);
 assert.match(empty.absenceDisclosure,/not evidence/i);
});
test('observation API includes long-lived CDN cache and fails closed when iNat is offline',async()=>{
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async()=>{throw Error('iNat rate-limited');};
 try{
  const res=responseMock();
  await handler({method:'GET',query:{region:'saginaw-bay'}},res);
  assert.equal(res.code,200);
  assert.equal(res.body.status,'unavailable');
  assert.equal(res.body.hatchVerification,'not_verified');
  assert.match(res.headers['Cache-Control'],/s-maxage=21600/);
  const invalid=responseMock();
  await handler({method:'GET',query:{region:'nowhere'}},invalid);
  assert.equal(invalid.code,400);
 }finally{globalThis.fetch=oldFetch;}
});
test('observation API exposes only vetted fields from public records and no user details',async()=>{
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async url=>{
  assert(String(url).startsWith('https://api.inaturalist.org/v1/observations?'));
  return {ok:true,text:async()=>JSON.stringify({results:[
   record(45,{user:{login:'personal-handle'},location:'41.5,-83.2',photos:[{url:'http://example.com/photo.jpg'}]})
  ],total_results:1})};
 };
 try{
  const result=await fetchInat('western-erie',now);assert.equal(result.results.length,1);
  const res=responseMock();
  await handler({method:'GET',query:{region:'western-erie'}},res);
  const s=JSON.stringify(res.body);
  assert(!s.includes('personal-handle'));
  assert(!s.includes('http://example.com/photo.jpg'));
  assert(!s.includes('41.5,-83.2'));
 }finally{globalThis.fetch=oldFetch;}
});
test('page scripts parse and observation loading remains independent from buoy feed',()=>{
 const html=readFileSync('public/great-lakes-mayflies.html','utf8');
 for(const id of ['observationStatus','observationList','observationCount','observationUpdated',
  'observationsLink','status','waterTemp','eveningDays','lakeMap']){
   assert(html.includes('id="'+id+'"'),id+' not found');
 }
 assert(html.includes('void loadEvidence(id,count)'));
 assert(html.includes('/api/lake-hex-observations?region='));
 assert(!html.includes('basemaps.cartocdn.com'));
 assert(html.includes('tile.openstreetmap.org'));
 assert(html.includes('Not verified by this tool'));
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m=>!/src=/i.test(m[1])&&!/application\/ld\+json/i.test(m[1]));
 assert(scripts.length);
 scripts.forEach(x=>assert.doesNotThrow(()=>new Script(x[2])));
});
