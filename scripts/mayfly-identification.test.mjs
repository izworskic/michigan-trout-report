import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const page=readFileSync('public/michigan-mayfly-hatches.html','utf8');
const guide=readFileSync('public/mayfly-identification.js','utf8');
const css=readFileSync('public/mayfly-identification.css','utf8');

test('visual ID gallery, credited hero and offline-safe keyless CARTO map remain on page',()=>{
 for(const id of ['mayflyPhotoGuide','mayflyPhotoCards','idCandidates','idSize','idColor',
 'idTime','idPhotoInput','idPhotoPreview','idPhotoClear','idPhotoNote','flySelect',
 'riverMap','riverCards']){
  assert(page.includes('id="'+id+'"'),id);
 }
 assert(page.includes('hero-with-reference'));
 assert(page.includes('Photo: <a href="https://commons.wikimedia.org/wiki/File:Hexagenia_limbata.jpg"'));
 assert(page.includes('src="/mayfly-identification.js"'));
 assert(page.includes('href="/mayfly-identification.css"'));
 assert(page.includes('basemaps.cartocdn.com'));
 assert(page.includes('drawFallbackLocator'));
 assert(css.includes('@media(max-width:480px)'));
 assert(css.includes('scroll-snap-type:x mandatory'));
 const scripts=[...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m=>!/src=/i.test(m[1])&&!/application\/ld\+json/i.test(m[1]));
 assert(scripts.length);
 scripts.forEach((m,i)=>assert.doesNotThrow(()=>new Script(m[2],{filename:'inline '+i})));
 assert.doesNotThrow(()=>new Script(guide));
});

test('5 real photo references have a separate original, attribution and license, not generated scientific IDs',()=>{
 const ids=['hendrickson','brown-drake','hex','sulphur','bwo'];
 for(const id of ids)assert(guide.includes("id:'"+id+"'"));
 assert.equal((guide.match(/image:'https:\/\/upload.wikimedia.org\/wikipedia\/commons\/thumb\//g)||[]).length,5);
 assert.equal((guide.match(/source:'https:\/\/commons.wikimedia.org\/wiki\/File:/g)||[]).length,5);
 assert.equal((guide.match(/license:'CC BY/g)||[]).length,5);
 assert(guide.includes('photos are sourced')||guide.includes('All images are sourced'));
 assert(!guide.includes('classifyImage('));
 assert(!guide.includes('/api/classify'));
});

test('visual ID never automatically asserts exact taxon identity or uploads private photo',()=>{
 assert(page.includes('not automatic species identifications'));
 assert(page.includes('manual comparison'));
 assert(page.includes('A mayfly dun has more opaque wings'));
 assert(guide.includes('not a confirmed ID'));
 assert(guide.includes('Other mayflies can share these traits'));
 assert(guide.includes('URL.createObjectURL(f)'));
 assert(guide.includes('URL.revokeObjectURL(previewURL)'));
 assert(guide.includes('10*1024*1024'));
 assert(!/\b(fetch|XMLHttpRequest|sendBeacon)\s*\(/.test(guide));
});

test('tap on specimen controls the existing live mayfly forecast, not another truth layer',()=>{
 assert(page.includes('selectFly:(id)=>{if(names[id])selectSpecies(id);}'));
 assert(page.includes('window.MayflyID?.updateSelected?.(fly)'));
 assert(guide.includes('window.MayflyBoard?.selectFly?.(fly)'));
});

test('responsive five-photo gallery builds referenced photos and simple matching candidates',()=>{
 const ids=['mayflyPhotoGuide','mayflyPhotoCards','idCandidates','idSize','idColor','idTime',
 'idPhotoInput','idPhotoPreview','idPhotoClear','idPhotoNote'];
 const E=new Map(ids.map(id=>[id,{id,innerHTML:'',textContent:'',dataset:{},value:'',
  addEventListener(name,cb){this['on'+name]=cb;},querySelectorAll:()=>[],classList:{toggle(){}},scrollIntoView(){},
  files:[],setAttribute(){},removeAttribute(){}}]));
 E.get('mayflyPhotoCards').querySelectorAll=()=>[];
 E.get('idCandidates').querySelectorAll=()=>[];
 E.get('mayflyPhotoGuide').querySelectorAll=()=>[];
 const doc={getElementById:id=>E.get(id)||null,querySelector:()=>null};
 const w={addEventListener(){}};
 new Script(guide).runInNewContext({window:w,document:doc,URL:{createObjectURL(){throw Error('No upload');}},String,Array,Math,Map,RegExp});
 const gallery=E.get('mayflyPhotoCards').innerHTML;
 assert.equal((gallery.match(/<article class="id-card/g)||[]).length,5);
 assert(gallery.includes('Hendrickson')&&gallery.includes('Blue-Winged Olive'));
 assert(gallery.includes('Photo')||gallery.includes('Reference'));
 assert(gallery.includes('target="_blank" rel="noopener"'));
 E.get('idSize').value='large';E.get('idColor').value='brown';E.get('idTime').value='night';
 E.get('idTime').onchange();
 const matches=E.get('idCandidates').innerHTML;
 assert(matches.includes('Hex') && matches.includes('Compare these first'));
 assert(!matches.includes('100%'));
 assert.equal(w.MayflyID.photoCount,5);
});
