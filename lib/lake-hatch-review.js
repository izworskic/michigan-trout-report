// Server-side reviewed-event publication and freshness rules.
// The ledger is an EDITORIAL RECORD, not an automatic emergence detector.
import { APPROVED_HEX_EVENTS } from '../data/approved-hex-events.js';

export const REGIONS = Object.freeze(['saginaw-bay','western-erie']);
export const EVIDENCE_TYPES=Object.freeze([
  'documented_mass_swarm',
  'documented_water_emergence',
  'agency_radar_report'
]);
const DAY=86400000;
function safeDate(s) {
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;
 const n=Date.parse(s+'T12:00:00Z');
 return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?n:null;
}
function safePublicUrl(s) {
 if(typeof s!=='string'||s.length>700)return false;
 try{
  const u=new URL(s);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return false;
  if(!/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(u.hostname))return false;
  const host=u.hostname.toLowerCase();
  if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local'))return false;
  return true;
 }catch{return false;}
}
export function validateCuratedLedger(items,now=new Date()) {
 if(!Array.isArray(items))throw new Error('Curated ledger must be an array');
 if(items.length>250)throw new Error('Maximum 250 events; archive older years');
 const seen=new Set();
 const valid=[];
 for(const [i,e] of items.entries()) {
  const path='event '+(i+1);
  if(!e||typeof e!=='object'||Array.isArray(e))throw new Error(path+': not an object');
  if(typeof e.id!=='string'||!/^\d{4}-\d{2}-\d{2}-(saginaw-bay|western-erie)-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.id))
   throw new Error(path+': invalid event ID');
  if(seen.has(e.id))throw new Error(path+': duplicate ID');
  seen.add(e.id);
  if(!REGIONS.includes(e.region)||!e.id.startsWith(e.eventDate+'-'+e.region+'-'))
   throw new Error(path+': mismatched region and ID');
  const eventMillis=safeDate(e.eventDate),reviewMillis=safeDate(e.reviewedOn),sourceMillis=safeDate(e.sourceDate);
  const dateNow=now.getTime();
  if(eventMillis===null||eventMillis>Date.now()+DAY||eventMillis<Date.parse('2010-01-01T12:00:00Z'))
   throw new Error(path+': invalid event date');
  if(reviewMillis===null||reviewMillis<eventMillis||reviewMillis>dateNow+DAY)
   throw new Error(path+': invalid review timestamp');
  if(sourceMillis===null||sourceMillis<eventMillis-DAY||sourceMillis>reviewMillis+DAY)
   throw new Error(path+': invalid source date');
  if(!EVIDENCE_TYPES.includes(e.eventType))throw new Error(path+': invalid evidence type');
  if(!safePublicUrl(e.evidenceUrl))throw new Error(path+': unsafe or missing primary evidence URL');
  if(typeof e.placeLabel!=='string'||e.placeLabel.trim().length<5||e.placeLabel.length>90||
     /[-+]?\d{2,3}\.\d{3,}\s*,\s*-?\d{2,3}\.\d{3,}/.test(e.placeLabel))
   throw new Error(path+': location must be approximate and public, not GPS coordinates');
  if(typeof e.evidenceSummary!=='string'||e.evidenceSummary.trim().length<35||
      e.evidenceSummary.length>500)throw new Error(path+': evidence review description required (35–500 chars)');
  if(typeof e.sourceAttribution!=='string'||e.sourceAttribution.trim().length<4||
      e.sourceAttribution.length>110)throw new Error(path+': original publisher attribution required');
  if(typeof e.reviewedBy!=='string'||!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37})$/.test(e.reviewedBy))
   throw new Error(path+': named GitHub reviewer required');
  if(typeof e.reviewNote!=='string'||e.reviewNote.trim().length<30||e.reviewNote.length>500)
   throw new Error(path+': human review note required (30–500 chars)');
  // Block unexpected metadata and raw reporter contact/private coordinates
  // so manual PR authors cannot accidentally expose personal submissions.
  const allowed=['id','region','eventDate','placeLabel','eventType','evidenceUrl',
   'evidenceSummary','sourceAttribution','sourceDate','reviewedBy','reviewedOn','reviewNote'];
  for(const key of Object.keys(e))if(!allowed.includes(key))throw new Error(path+': private or unsupported field '+key);
  valid.push({...e});
 }
 return valid.sort((a,b)=>b.eventDate.localeCompare(a.eventDate)||a.id.localeCompare(b.id));
}
export function buildCuratedEventReport(region,now=new Date(),items=APPROVED_HEX_EVENTS) {
 if(!REGIONS.includes(region))throw new Error('Unknown region');
 const reviewed=validateCuratedLedger(items,now).filter(e=>e.region===region);
 // Event date is a documented occurrence; it never means the event is
 // happening NOW. Avoid "hatching now" even for same-day news.
 const latest=reviewed[0]||null;
 const age=latest?Math.max(0,Math.floor((now.getTime()-safeDate(latest.eventDate))/DAY)):null;
 const recent=reviewed.filter(e=>{
  const d=now.getTime()-safeDate(e.eventDate);
  return d>=-DAY&&d<=14*DAY;
 });
 const pub=e=>({
   id:e.id,eventDate:e.eventDate,placeLabel:e.placeLabel,eventType:e.eventType,
   evidenceUrl:e.evidenceUrl,evidenceSummary:e.evidenceSummary,
   sourceAttribution:e.sourceAttribution,sourceDate:e.sourceDate,
   reviewedBy:e.reviewedBy,reviewedOn:e.reviewedOn,
   // Reviewer notes are audit material, kept in the repository only.
 });
 return {
  region,
  reviewStandard:'Editorially reviewed public source, not scientific population census',
  verificationLevel:latest?'documented_editorial_event':'no_reviewed_events',
  currentHatchConfirmed:false,
  // Even same-day events are historical observations, not proof of ongoing hatch.
  status:recent.length?'Recent documented events':'No recent reviewed events',
  lastEventAgeDays:age,
  latestEventDate:latest?.eventDate||null,
  totalReviewed:reviewed.length,
  recent14Days:recent.length,
  events:reviewed.slice(0,10).map(pub),
  evidenceSeparation:'A documented past mass swarm is not a current hatch, a measurement of nymph populations, or a calibrated emergence forecast. iNaturalist specimens are a separate, lower-level evidence source.',
  queuePolicy:'Reports received through GitHub Issues are never auto-published. A human reviews primary evidence and adds eligible records through a reviewed repository change.'
 };
}
