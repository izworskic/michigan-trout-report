// /api/lake-hatch-history?lake=Erie|Huron|...|All%20five&site=port-clinton
// Nonexhaustive published historical dates, NOT user-submitted,
// editorially approved, or currently active hatches.
import {LAKES,SITES,lakeHistory} from '../lib/published-lake-history.js';
export default function handler(req,res){
 res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=86400');
 res.setHeader('Access-Control-Allow-Origin','*');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const lake=typeof req.query?.lake==='string'?req.query.lake:'All five';
 const site=typeof req.query?.site==='string'?req.query.site:null;
 if(lake!=='All five'&&!LAKES.includes(lake))return res.status(400).json({error:'Unsupported lake'});
 if(site!==null&&!SITES.includes(site))return res.status(400).json({error:'Unsupported research location'});
 try{return res.status(200).json(lakeHistory({lake,site}));}
 catch(_){return res.status(503).json({success:false,error:'Historical source index unavailable'});}
}
