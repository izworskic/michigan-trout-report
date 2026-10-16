// GET /api/lake-hex-observations?region=saginaw-bay|western-erie
// Public Research Grade Hexagenia observations: identification != confirmed hatch.
// One bounded API call per region; CDN caches for six hours to respect iNat limits.
import {OBSERVATION_AREAS,observationQuery,buildObservationEvidence} from '../lib/lake-hex-observations.js';
const APP_AGENT='MichiganTroutReport/1.0 (https://michigantroutreport.com)';
export async function fetchInat(region,now=new Date()){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8500);
 try {
  const response=await fetch(observationQuery(region,now),{
    headers:{Accept:'application/json','User-Agent':APP_AGENT},
    signal:controller.signal
  });
  if(!response.ok)throw Error('iNaturalist '+response.status);
  const raw=await response.text();
  if(raw.length>1_500_000)throw Error('Observation response too large');
  const payload=JSON.parse(raw);
  if(!payload||!Array.isArray(payload.results))throw Error('Invalid observation response');
  return payload;
 }finally{clearTimeout(timer);}
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','public, s-maxage=21600, stale-while-revalidate=3600');
 res.setHeader('Access-Control-Allow-Origin','*');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const region=typeof req.query?.region==='string'?req.query.region:'saginaw-bay';
 if(!Object.hasOwn(OBSERVATION_AREAS,region))return res.status(400).json({error:'Unsupported region'});
 const now=new Date();
 try{
  const payload=await fetchInat(region,now);
  return res.status(200).json({success:true,...buildObservationEvidence({region,now,payload})});
 }catch(_){
  return res.status(200).json({success:true,...buildObservationEvidence({region,now,sourceAvailable:false})});
 }
}
