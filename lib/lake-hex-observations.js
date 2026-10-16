// Separate citizen-science evidence from measured environmental conditions.
// Research Grade iNaturalist means a community-supported taxonomic ID,
// NOT proof of a mass Hexagenia emergence, hatch density or an on-lake location.
export const OBSERVATION_AREAS=Object.freeze({
  'saginaw-bay':Object.freeze({
    label:'Saginaw Bay and surrounding shores',
    swlat:43.4,swlng:-84.6,nelat:44.6,nelng:-82.95
  }),
  'western-erie':Object.freeze({
    label:'Western Lake Erie and surrounding shores',
    swlat:41.3,swlng:-83.9,nelat:42.05,nelng:-82.3
  })
});
export const INAT_API='https://api.inaturalist.org/v1/observations';
const DAY=86400000;
export function dateCutoff(now=new Date(),days=365){
  return new Date(now.getTime()-days*DAY).toISOString().slice(0,10);
}
export function observationQuery(region,now=new Date()){
  const area=OBSERVATION_AREAS[region];
  if(!area)throw new Error('Unknown observation area');
  const query=new URLSearchParams({
    taxon_name:'Hexagenia',quality_grade:'research',photos:'true',
    swlat:String(area.swlat),swlng:String(area.swlng),
    nelat:String(area.nelat),nelng:String(area.nelng),
    d1:dateCutoff(now),per_page:'100',order_by:'observed_on',order:'desc'
  });
  return INAT_API+'?'+query.toString();
}
function trustworthyDate(d,now){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return null;
  const value=Date.parse(d+'T12:00:00Z');
  if(!Number.isFinite(value)||new Date(value).toISOString().slice(0,10)!==d)return null;
  const interval=now.getTime()-value;
  return interval>=-DAY&&interval<=366*DAY?value:null;
}
export function normalizeObservations(raw,now=new Date()){
 const values=Array.isArray(raw?.results)?raw.results:[];
 const unique=new Set();
 const records=[];
 for(const observation of values){
  const id=Number(observation?.id);
  const observedOn=String(observation?.observed_on||'');
  const observedTs=trustworthyDate(observedOn,now);
  const taxon=observation?.taxon?.name;
  const photoCount=Array.isArray(observation?.photos)?observation.photos.length:0;
  // Never show obscured coordinates, user names or image hotlinks in this UI.
  if(!Number.isSafeInteger(id)||id<=0||unique.has(id)||observedTs===null||
      observation?.quality_grade!=='research'||photoCount===0||
      typeof taxon!=='string'||!/^Hexagenia(?:\s|$)/i.test(taxon))continue;
  unique.add(id);
  const ageDays=Math.max(0,Math.floor((now.getTime()-observedTs)/DAY));
  records.push({
    id,date:observedOn,ageDays,
    taxon:taxon.slice(0,90),url:'https://www.inaturalist.org/observations/'+id,
    taxonEvidence:'Research Grade species/genus identification',
    hatchEvidence:'Not independently verified as a hatch',
    // Coarse area only; observations may be inland and locations may be obscured.
    regionalOnly:true
  });
 }
 return records.sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).slice(0,12);
}
export function buildObservationEvidence({region,now=new Date(),payload=null,sourceAvailable=true}={}){
 const area=OBSERVATION_AREAS[region];
 if(!area)throw new Error('Unsupported region');
 const reports=sourceAvailable?normalizeObservations(payload,now):[];
 const total=Number(payload?.total_results);
 const recent=reports.filter(r=>r.ageDays<=30);
 return {
  region,area:area.label,source:'iNaturalist',
  sourceUrl:'https://www.inaturalist.org/observations?taxon_name=Hexagenia&quality_grade=research',
  fetchedAt:now.toISOString(),
  searchWindowDays:365,
  status:!sourceAvailable?'unavailable':reports.length?'records_found':'no_matching_records',
  totalMatched:sourceAvailable&&Number.isSafeInteger(total)&&total>=0?total:null,
  recentDisplayed:recent.length,
  latestDate:reports[0]?.date||null,
  records:reports,
  // Taxonomic evidence never becomes an affirmative hatch status.
  hatchVerification:'not_verified',
  disclosure:'Photo-backed iNaturalist Research Grade records support mayfly identification, not emergence of a mass hatch. Region searches include nearby land and may contain obscured coordinates. Observation dates are not submission dates. No lakebed, swarm size, or exact shoreline origin is verified.',
  absenceDisclosure:'No matching public records is not evidence that mayflies were absent.',
  limitations:'Only the 12 newest eligible records in a one-year regional search are displayed; 30-day counts refer to the displayed sample, not a census. Identifications and availability may change on iNaturalist.'
 };
}
