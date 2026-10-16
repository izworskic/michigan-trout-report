import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const html=readFileSync('public/mayfly-hatches.html','utf8');

test('new next-week outlook preserves the known current conditions and map',()=>{
 for (const id of ['reaches','watertemp','flow','weather','species','sevenDays','tempHistoryChart','map','outlookStatus']){
  assert.match(html,new RegExp('id="'+id+'"'),id+' target must exist');
 }
 assert.match(html,/chooseReach\(active\)/);
 assert.match(html,/renderSevenDays\(\)/);
 assert.match(html,/USGS station locations/);
});
test('each inline browser script parses as JavaScript',()=>{
 const blocks=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
 .filter(m=>!/\bsrc=/i.test(m[1])&&!/application\/ld\+json/i.test(m[1]));
 assert(blocks.length>0);
 blocks.forEach((m,i)=>assert.doesNotThrow(()=>new Script(m[2],{filename:'mayfly-hatches inline '+i})));
});
test('page does not label future water as measured or as a calibrated probability',()=>{
 assert.match(html,/Experimental water scenario/);
 assert.match(html,/Weather only · water unknown/);
 assert.match(html,/not calibrated/);
 assert.match(html,/No verified hatches|no verified hatches|No hatch sightings/i);
 assert.doesNotMatch(html,/\b\d+% chance of hatch\b/i);
});
