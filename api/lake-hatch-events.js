// GET /api/lake-hatch-events?region=saginaw-bay|western-erie
// This endpoint serves ONLY human-reviewed events committed to the repo.
// It does not read unmoderated issues, user input, or iNaturalist sightings.
import {REGIONS,buildCuratedEventReport} from '../lib/lake-hatch-review.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','public, s-maxage=3600, stale-while-revalidate=1800');
 res.setHeader('Access-Control-Allow-Origin','*');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const region=typeof req.query?.region==='string'?req.query.region:'saginaw-bay';
 if(!REGIONS.includes(region))return res.status(400).json({error:'Unsupported region'});
 try{
  return res.status(200).json({success:true,generatedAt:new Date().toISOString(),
   ...buildCuratedEventReport(region)});
 }catch(_){
  // Invalid curated data must not be presented as "no reports".
  return res.status(503).json({success:false,error:'Reviewed event ledger temporarily unavailable'});
 }
}
