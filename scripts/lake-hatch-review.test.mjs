import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {APPROVED_HEX_EVENTS} from '../data/approved-hex-events.js';
import {validateCuratedLedger,buildCuratedEventReport} from '../lib/lake-hatch-review.js';
import handler from '../api/lake-hatch-events.js';
const NOW=new Date('2027-06-29T18:30:00Z');
const base={
 id:'2027-06-23-western-erie-toledo-swarm',
 region:'western-erie',eventDate:'2027-06-23',
 placeLabel:'Toledo public shoreline',
 eventType:'documented_mass_swarm',
 evidenceUrl:'https://example.org/original/summer-mayflies',
 evidenceSummary:'Original dated video independently reviewed showing hundreds of identifiable Hexagenia flying over a public shoreline in early summer.',
 sourceAttribution:'Original video publisher',
 sourceDate:'2027-06-24',
 reviewedBy:'editor-1',
 reviewedOn:'2027-06-25',
 reviewNote:'Reviewed the original video and publication date; a large group of Hexagenia is visibly present, but exact lake origin remains unknown.'
};
function resMock(){return{code:0,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(x){this.data=x;return this;},end(){this.ended=true;return this;}};}
test('publication ledger starts empty, not with fabricated mass swarms',()=>{
 assert.deepEqual(APPROVED_HEX_EVENTS,[]);
 const report=buildCuratedEventReport('saginaw-bay',NOW);
 assert.equal(report.verificationLevel,'no_reviewed_events');
 assert.equal(report.totalReviewed,0);
 assert.equal(report.recent14Days,0);
 assert.equal(report.latestEventDate,null);
 assert.equal(report.currentHatchConfirmed,false);
});
test('legitimate editorial event becomes historical evidence, never an active hatch',()=>{
 const valid=validateCuratedLedger([base],NOW);
 assert.equal(valid.length,1);
 const published=buildCuratedEventReport('western-erie',NOW,[base]);
 assert.equal(published.verificationLevel,'documented_editorial_event');
 assert.equal(published.status,'Recent documented events');
 assert.equal(published.totalReviewed,1);
 assert.equal(published.recent14Days,1);
 assert.equal(published.currentHatchConfirmed,false);
 assert.equal(published.events[0].reviewedBy,'editor-1');
 assert.equal(published.events[0].evidenceUrl,base.evidenceUrl);
 assert.equal(Object.hasOwn(published.events[0],'reviewNote'),false);
 assert.equal(buildCuratedEventReport('saginaw-bay',NOW,[base]).totalReviewed,0);
});
test('older events are retained as history but cannot label today a recent event',()=>{
 const future=new Date('2027-10-17T18:30:00Z');
 const r=buildCuratedEventReport('western-erie',future,[base]);
 assert.equal(r.totalReviewed,1);
 assert.equal(r.recent14Days,0);
 assert.equal(r.status,'No recent reviewed events');
 assert.equal(r.currentHatchConfirmed,false);
});
test('invalid editorial events never enter public ledger',()=>{
 const cases=[
 {id:'fake-now'},{region:'saginaw-bay'}, {eventDate:'2027-06-40'},
 {eventDate:'2027-07-20',id:'2027-07-20-western-erie-toledo-swarm'},
 {evidenceUrl:'http://example.org/video'},
 {evidenceUrl:'https://localhost/demo'}, {evidenceUrl:'https://user:pass@a.com/demo'},
 {evidenceUrl:'https://example.org/file#section'}, {placeLabel:'41.5981,-83.53322'},
 {eventType:'individual_specimen'}, {reviewedBy:''}, {reviewedOn:'2027-06-22'},
 {reviewNote:'Too short'}, {sourceDate:'not-a-date'},
 {reporterEmail:'private@example.org'}, {observerGps:'41.58,-83.53'},
 ];
 for(const patch of cases){
  assert.throws(()=>validateCuratedLedger([{...base,...patch}],NOW),
   undefined,'should reject '+JSON.stringify(patch));
 }
 assert.throws(()=>validateCuratedLedger([base,base],NOW),/duplicate/i);
 assert.throws(()=>validateCuratedLedger([{...base,reviewedOn:'2028-01-01'}],NOW),/review/i);
});
test('reviewed-event API has read-only design, region allowlist, and honest empty state',async()=>{
 const ok=resMock();
 await handler({method:'GET',query:{region:'western-erie'}},ok);
 assert.equal(ok.code,200);
 assert.equal(ok.data.success,true);
 assert.equal(ok.data.totalReviewed,0);
 assert.equal(ok.data.currentHatchConfirmed,false);
 assert.match(ok.headers['Cache-Control'],/s-maxage=3600/);
 const reject=resMock();
 await handler({method:'GET',query:{region:'../../evil'}},reject);
 assert.equal(reject.code,400);
 const write=resMock();
 await handler({method:'POST',query:{region:'western-erie'},body:{event:base}},write);
 assert.equal(write.code,405);
});
test('issue form requires date, region, original evidence and public privacy acknowledgement',()=>{
 const form=readFileSync('.github/ISSUE_TEMPLATE/lake-mayfly-swarm.yml','utf8');
 for(const s of ['Saginaw Bay','Western Lake Erie','event-date','evidence','required: true',
   'This GitHub Issue and attachments are public','privacy-and-review']){
   assert(form.includes(s),'Missing intake field '+s);
 }
 assert(!form.includes('assignees:'));
});
test('UI includes separate approved-events and specimen panels with working fetch guards',()=>{
 const html=readFileSync('public/great-lakes-mayflies.html','utf8');
 for(const id of ['reviewStatus','reviewRecent','reviewEventList','reviewFreshness',
  'observationStatus','observationList','waterTemp','lakeMap']){
   assert(html.includes('id="'+id+'"'),'Missing UI target '+id);
 }
 assert(html.includes('/api/lake-hatch-events?region='));
 assert(html.includes('void loadReviewedEvents(id,count);'));
 assert(html.includes('github.com/izworskic/michigan-trout-report/issues/new?template=lake-mayfly-swarm.yml'));
 assert(html.includes('No approved events does not mean'));
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m=>!/src=/i.test(m[1])&&!/application\/ld\+json/i.test(m[1]));
 assert(scripts.length>0);
 scripts.forEach((m,i)=>assert.doesNotThrow(()=>new Script(m[2],{filename:'inline '+i})));
});
