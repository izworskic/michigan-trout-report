// Strict, source-linked historic evidence dataset. Distinct from the
// human-reviewed ledger and from iNaturalist identification evidence.
import {PUBLISHED_LAKE_EVENTS} from '../data/published-lake-mayfly-events.js';
export const LAKES=Object.freeze(['Superior','Michigan','Huron','Erie','Ontario','Connecting waters']);
export const SITES=Object.freeze(['bass-islands','port-clinton','tawas-shore','northern-green-bay',
 'chequamegon-bay','st-louis-estuary','bay-of-quinte','lake-st-clair']);
export const CATEGORIES=Object.freeze(['documented_adult_swarms','reported_mass_swarm','community_first_sighting']);
const SITE_LAKE=Object.freeze({'bass-islands':'Erie','port-clinton':'Erie','tawas-shore':'Huron','northern-green-bay':'Michigan','chequamegon-bay':'Superior','st-louis-estuary':'Superior','bay-of-quinte':'Ontario','lake-st-clair':'Connecting waters'});
const DATE_BASIS=Object.freeze(['field_sampling_window','specific_observed_date','community_first_sighting_date']);
const allowedSource=new Set(['peer_reviewed_field_study','contemporaneous_local_reporting',
 'contemporaneous_news_photography','community_year_table']);
const DAY=86400000;
function safeDate(s){
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;
 const d=Date.parse(s+'T12:00:00Z');
 return Number.isFinite(d)&&new Date(d).toISOString().slice(0,10)===s?d:null;
}
function safeLink(s){
 try{
  const u=new URL(s);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&
   ['www.sciencedirect.com','www.13abc.com','www.yahoo.com','www.mayflynews.net'].includes(u.hostname);
 }catch{return false;}
}
export function validateHistory(items=PUBLISHED_LAKE_EVENTS,now=new Date()){
 if(!Array.isArray(items)||items.length>150)throw new Error('Invalid or oversized published history');
 const ids=new Set();
 return items.map((e,i)=>{
  const path='Entry '+(i+1);
  if(!e||typeof e!=='object'||Array.isArray(e))throw new Error(path+' not an object');
  const keys=['id','siteId','lake','place','firstDate','lastDate','dateBasis',
   'category','sourceType','sourceName','sourceURL','description','limitation','taxon'];
  for(const k of Object.keys(e))if(!keys.includes(k))throw new Error(path+' unexpected field '+k);
  for(const k of keys)if(typeof e[k]!=='string'||e[k].trim().length<3||e[k].length>750)
    throw new Error(path+' missing/invalid '+k);
  if(!/^[a-z0-9-]{6,90}$/.test(e.id)||ids.has(e.id))throw new Error(path+' invalid/duplicate ID');
  ids.add(e.id);
  if(!SITES.includes(e.siteId)||!LAKES.includes(e.lake))throw new Error(path+' unknown lake/site');
  if(SITE_LAKE[e.siteId]!==e.lake)throw new Error(path+' research location/lake mismatch');
  if(!DATE_BASIS.includes(e.dateBasis))throw new Error(path+' invalid provenance for date');
  const start=safeDate(e.firstDate),end=safeDate(e.lastDate);
  if(start===null||end===null||end<start||end-start>8*DAY||end>now.getTime()+DAY||start<Date.parse('1990-01-01T00:00:00Z'))
   throw new Error(path+' invalid or invented date');
  if(!CATEGORIES.includes(e.category)||!allowedSource.has(e.sourceType)||!safeLink(e.sourceURL))
   throw new Error(path+' ungrounded source or category');
  if(e.category==='documented_adult_swarms'&&e.sourceType!=='peer_reviewed_field_study')
   throw new Error(path+' scientific event without study');
  if(e.category==='community_first_sighting'&&e.sourceType!=='community_year_table')
   throw new Error(path+' first-sighting provenance mismatch');
  if(e.category==='community_first_sighting'&&e.dateBasis!=='community_first_sighting_date')throw new Error(path+' first sighting cannot be labeled as measured emergence');
  if(e.category==='documented_adult_swarms'&&e.dateBasis!=='field_sampling_window')throw new Error(path+' scientific field window must be disclosed');
  if(e.description.length<65||e.limitation.length<50)
   throw new Error(path+' insufficient provenance/limitation');
  return e;
 });
}
export function lakeHistory({lake='All five',site=null,now=new Date()}={}){
 if(lake!=='All five'&&!LAKES.includes(lake))throw new Error('Unsupported lake');
 if(site!==null&&!SITES.includes(site))throw new Error('Unsupported site');
 const validated=validateHistory(PUBLISHED_LAKE_EVENTS,now);
 const rows=validated.filter(e=>(lake==='All five'||e.lake===lake)&&(site===null||site===e.siteId))
  .sort((a,b)=>b.firstDate.localeCompare(a.firstDate)||a.id.localeCompare(b.id));
 const byCategory=Object.fromEntries(CATEGORIES.map(k=>[k,rows.filter(r=>r.category===k).length]));
 const years=[...new Set(rows.map(x=>Number(x.firstDate.slice(0,4))))].sort((a,b)=>a-b);
 const firstSightings=rows.filter(r=>r.category==='community_first_sighting'&&r.siteId==='port-clinton');
 const observedMonthDays=firstSightings.map(r=>r.firstDate.slice(5)).sort();
 const firstSightingSummary=firstSightings.length>=3?{
  location:'Port Clinton, western Lake Erie',
  recordType:'Community first sighting — not start, peak, or mass swarm',
  sampleYears:[...new Set(firstSightings.map(x=>Number(x.firstDate.slice(0,4))))].sort((a,b)=>a-b),
  earliestMonthDay:observedMonthDays[0],
  latestMonthDay:observedMonthDays.at(-1),
  medianMonthDay:observedMonthDays[Math.floor(observedMonthDays.length/2)],
  count:firstSightings.length,
  effortBiasNotice:'Uneven yearly volunteer reporting. These dates are NOT a calibrated hatch-window prediction.'
 }:null;
 return {
  success:true,scope:{lake,site},source:'Published study/report index, not human editorial review',
  compiledOn:'2026-10-16',total:rows.length,byCategory,years,
  entries:rows.map(e=>({...e})),
  firstSightingSummary,
  // Keep explicit null not zero for lakes without these particular sourced events.
  coverage:rows.length?'Selected dated source events found':'No qualifying dated adult-event reports in this curated sample; not evidence of no historic hatch.',
  limitations:'Nonexhaustive, unevenly observed source archive. Published dates refer to observed events or community first sightings, not annual peak estimates. Repeated community-first records are not independent survey events. Research-site map pins are approximate orientation, not event GPS coordinates. No record verifies a hatch is active now.',
  isCurrentHatchConfirmed:false
 };
}
