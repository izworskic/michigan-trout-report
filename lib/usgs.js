// Modern USGS observation and approved daily-mean normals APIs.
const IV = 'https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items';
const NORMALS = 'https://api.waterdata.usgs.gov/statistics/v0/observationNormals';
const PARAMS = {
  '00060':['flow','ft^3/s'], '00010':['temp_c','degC'], '00065':['gage','ft'],
  '63680':['turbidity_fnu','FNU'], '00300':['do_mgl','mg/l'],
};
const MAX_AGE_MS=24*60*60*1000;
const validNumber=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(Number(v));
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
// USGS v1 documents qualifier as a string; accept legacy arrays as well.
const normalizeQualifiers=v=>(Array.isArray(v)?v:typeof v==='string'?[v]:[]).flatMap(s=>s.split(/[,;\s]+/)).map(s=>s.trim().toUpperCase()).filter(Boolean);
const uniqIds=ids=>[...new Set(ids.filter(x=>typeof x==='string'&&/^\d{8,15}$/.test(x)))];
const emptyStats=gaugeId=>({gaugeId,p10:null,p25:null,p50:null,p75:null,p90:null});
const batch=(ids,n)=>Array.from({length:Math.ceil(ids.length/n)},(_,i)=>ids.slice(i*n,(i+1)*n));
const localMonthDay=now=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Detroit',month:'2-digit',day:'2-digit'}).format(now).replace('/','-');

async function fetchPayload(url,ms=12000){
 const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),ms);
 try{
  const response=await fetch(url,{signal:ctrl.signal,headers:{Accept:'application/json','User-Agent':'MichiganTroutReport/1.0 (freighterviewfarms.com)'}});
  if(!response.ok)throw Error('HTTP '+response.status);
  return await response.json();
 }finally{clearTimeout(timer);}
}

export function parseLiveObservations(payload,gaugeIds,now=Date.now()){
 const ids=new Set(gaugeIds);
 if(payload?.type!=='FeatureCollection'||!Array.isArray(payload.features)||payload.numberReturned!==payload.features.length||!Array.isArray(payload.links)||payload.links.some(x=>x?.rel==='next'))throw Error('Incomplete USGS observation collection');
 const groups=new Map(),readings={};
 for(const f of payload.features){
  const p=f?.properties, id=p?.monitoring_location_id?.replace(/^USGS-/,'');
  if(f?.type!=='Feature'||!record(p)||!ids.has(id)||p.monitoring_location_id!=='USGS-'+id||!Object.hasOwn(PARAMS,p.parameter_code)||typeof p.time!=='string'||typeof p.unit_of_measure!=='string'||!(p.qualifier==null||typeof p.qualifier==='string'||Array.isArray(p.qualifier)&&p.qualifier.every(x=>typeof x==='string')))throw Error('Invalid USGS observation identity');
  const key=id+':'+p.parameter_code;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(p);
 }
 for(const [key,values] of groups){
  const [id,param]=key.split(':'),[field,unit]=PARAMS[param];
  const reading=readings[id]??={siteId:id,siteName:null,flow:null,temp_c:null,gage:null,turbidity_fnu:null,do_mgl:null,timestamp:null,observationTimes:{},observationStates:{},observationQualifiers:{}};
  const parsed=values.map(p=>({...p,at:Date.parse(p.time)})).filter(p=>Number.isFinite(p.at)&&p.at<=now).sort((a,b)=>b.at-a.at);
  if(!parsed.length){reading.observationStates[field]='invalid-time';continue;}
  const last=parsed[0], same=parsed.filter(p=>p.at===last.at);
  const qualifiers=[...new Set(same.flatMap(p=>normalizeQualifiers(p.qualifier)))];
  const observedAt=new Date(last.at).toISOString();
  const status=qualifiers.includes('SEASONAL')?'seasonal':qualifiers.includes('DISCONTINUED')?'discontinued':now-last.at>MAX_AGE_MS?'stale':same.some(p=>p.unit_of_measure.toLowerCase()!==unit.toLowerCase())?'invalid-unit':same.some(p=>!validNumber(p.value)||Number(p.value)<=-9999||field!=='temp_c'&&field!=='gage'&&Number(p.value)<0)?'no-reading':new Set(same.map(p=>Number(p.value))).size!==1?'ambiguous':'fresh';
  reading.observationStates[field]=status;
  reading.observationQualifiers[field]=qualifiers;
  reading.observationTimes[field]=observedAt;
  if(status==='fresh'){
   reading[field]=Number(last.value);
   if(field==='flow')reading.timestamp=observedAt;
  }
 }
 return readings;
}

// Fixed-size batches preserve coverage without a request per sensor.
export async function fetchLiveReadings(gaugeIds,{timeoutMs=12000}={}){
 const ids=uniqIds(gaugeIds);if(!ids.length)return {};
 const chunks=batch(ids,80);
 const results=await Promise.all(chunks.map(async group=>{
  const url=IV+'?f=json&monitoring_location_id='+group.map(id=>'USGS-'+id).join(',')+'&parameter_code='+Object.keys(PARAMS).join(',')+'&limit=1000';
  try{return parseLiveObservations(await fetchPayload(url,timeoutMs),group);}
  catch(e){console.warn('[usgs] live observations unavailable:',e.message);return {};}
 }));
 return Object.assign({},...results);
}

export function parseSeasonalNormals(payload,gaugeIds,monthDay){
 if(payload?.type!=='FeatureCollection'||!Array.isArray(payload.features)||payload.next!==null)throw Error('Incomplete USGS normals collection');
 const ids=new Set(gaugeIds),result=Object.fromEntries(gaugeIds.map(id=>[id,emptyStats(id)])),candidates=new Map();
 for(const f of payload.features){
  const p=f?.properties,id=p?.monitoring_location_id?.replace(/^USGS-/,'');
  if(f?.type!=='Feature'||!record(p)||!ids.has(id)||p.monitoring_location_id!=='USGS-'+id||!Array.isArray(p.data))throw Error('Invalid USGS normals identity');
  for(const series of p.data){
   // Only approved historical daily MEAN discharge, never stage or instantaneous statistics.
   if(series?.parameter_code!=='00060'||series.unit_of_measure!=='ft^3/s'||series.parent_statistic_id!=='00003'||!Array.isArray(series.values))continue;
   for(const row of series.values){
    if(row?.time_of_year!==monthDay||row.time_of_year_type!=='day_of_year'||row.approval_status!=='approved'||!Number.isInteger(row.sample_count)||row.sample_count<1||row.computation!=='percentile'||!Array.isArray(row.percentiles)||!Array.isArray(row.values)||row.percentiles.length!==row.values.length)continue;
    const stats=emptyStats(id);
    for(const n of [10,25,50,75,90]){
     const index=row.percentiles.findIndex(x=>String(x)===String(n));
     const val=row.values[index];
     if(validNumber(val)&&Number(val)>=0)stats['p'+n]=Number(val);
    }
    const vals=[stats.p10,stats.p25,stats.p50,stats.p75,stats.p90];
    if(vals.some(x=>x===null)||vals.some((x,i)=>i>0&&x<vals[i-1]))continue;
    if(!candidates.has(id))candidates.set(id,[]);
    candidates.get(id).push(stats);
   }
  }
 }
 // Multiple incompatible historical series cannot silently select a different baseline.
 for(const [id,values] of candidates)if(new Set(values.map(x=>JSON.stringify(x))).size===1)result[id]=values[0];
 return result;
}
export async function fetchAllStats(gaugeIds,{timeoutMs=12000,now=new Date()}={}){
 const ids=uniqIds(gaugeIds),day=localMonthDay(now);
 const chunks=batch(ids,25),out=Object.fromEntries(ids.map(id=>[id,emptyStats(id)]));
 for(let i=0;i<chunks.length;i+=3){
  const rs=await Promise.all(chunks.slice(i,i+3).map(async group=>{
   const url=NORMALS+'?'+group.map(id=>'monitoring_location_id=USGS-'+id).join('&')+'&parameter_code=00060&normal_type=DOY&start_date='+day+'&end_date='+day+'&computation_type=percentile&page_size=1000';
   try{return parseSeasonalNormals(await fetchPayload(url,timeoutMs),group,day);}
   catch(e){console.warn('[usgs] historical normals unavailable:',e.message);return {};}
  }));
  Object.assign(out,...rs);
 }
 return out;
}
export async function fetchSeasonalStats(gaugeId,options={}){
 return (await fetchAllStats([gaugeId],options))[gaugeId]||emptyStats(gaugeId);
}
