import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { availableGuideGroups, bookReadingRoutes, findSuzanneGuideBook, getLandingGuide, LANDING_GUIDES, ENGLISH_LANDING_GUIDES, suzanneBookGuide } from './landing-guides.ts';
import { editorialTopLists, getEditorialWorkSourceId, localizeEditorialList } from '../catalog/top-lists.ts';
import type { Book } from '../../app/data/books.ts';

const book=(id:string,title='Verified Dutch title',author='Verified author'):Book=>({id,source:'supabase',workId:id,openLibraryWorkId:getEditorialWorkSourceId(id),title,author,score:null,ratingsCount:null,match:null,cover:'orbit',editionAvailable:true});
test('target guides retain candidates/order while links use real language-selected identities',()=>{
  for(const guide of LANDING_GUIDES.slice(1)){
    const path=guide.path.slice(3), list=editorialTopLists.find(l=>'/toplijsten/'+l.slug===path)!;
    const localized=localizeEditorialList(list,'nl');
    assert.equal(localized.workIds.length,list.slug==='fantasy-sciencefiction'?25:10);assert.equal(getLandingGuide(path,'en')?.path,'/en'+path);
    assert.equal(new Set(localized.workIds).size,localized.workIds.length);
    assert.deepEqual(guide.cards!.map(c=>c.work_id),localized.workIds);
    assert.deepEqual(guide.groups!.flatMap(g=>g.work_ids.map(String)).sort(),[...localized.workIds].sort());
    assert.doesNotMatch(guide.h1,/\btien\b|\b10\b/);
    const first=guide.cards![0].work_id, chosen={...book(first),workId:'999999',title:'Actual Dutch edition title'};
    const groups=availableGuideGroups(guide,[{...chosen,editionAvailable:false},chosen]);
    assert.deepEqual(groups.flatMap(g=>g.entries),[{candidateId:first,workId:'999999',title:'Actual Dutch edition title'}]);
    assert.equal(availableGuideGroups(guide,[]).length,0);
    // Routes are capped at three; use a work that is exclusive to this guide
    // in the dedicated replacement regression below to check locale routing.
    assert.ok(bookReadingRoutes(chosen,'nl').length>0);
    assert.ok(bookReadingRoutes(chosen,'en').length>0);
  }
});

test('all English guides retain the original selections and give complete, source-bound reading advice',()=>{
  assert.equal(ENGLISH_LANDING_GUIDES.length,12);
  for(const guide of ENGLISH_LANDING_GUIDES){
    const list=editorialTopLists.find(l=>guide.path==='/en/toplijsten/'+l.slug)!;
    assert.deepEqual(guide.cards!.map(c=>c.work_id),list.workIds);
    assert.deepEqual(guide.groups!.flatMap(g=>g.work_ids.map(String)).sort(),[...list.workIds].sort());
    assert.ok(guide.intro.length>=2 && guide.faq.length>=4);
    assert.ok(guide.cards!.every(c=>c.text.length>=150 && c.reader_angle && c.sources.length>0));
    const example={...book(list.workIds[0]),workId:'987654'};
    assert.ok(availableGuideGroups(guide,[example]).some(g=>g.entries.some(e=>e.workId==='987654')));
    const routes=bookReadingRoutes(example,'en');
    for(const route of routes)assert.equal(route.title,getLandingGuide(route.href,'en')!.h1);
    assert.equal(getLandingGuide('/collection/suzanne-vermeer','en'),null);
  }
});
test('Dutch substitutions preserve English identities and use portable source links',()=>{
 const list=editorialTopLists.find(l=>l.slug==='feelgood-voor-een-leesavond')!;
 const original=[...list.workIds],nl=localizeEditorialList(list,'nl');
 assert.ok(nl.workIds.includes('774'));assert.ok(!nl.workIds.includes('9891'));
 assert.equal(localizeEditorialList(list,'en'),list);assert.deepEqual(list.workIds,original);
 const replacement={...book('774'),workId:'981234'};
 assert.ok(bookReadingRoutes(replacement,'nl').some(r=>r.href.endsWith(list.slug)));
 assert.ok(!bookReadingRoutes(replacement,'en').some(r=>r.href.endsWith(list.slug)));
 const untranslated=book('9891');
 assert.ok(!bookReadingRoutes(untranslated,'nl').some(r=>r.href.endsWith(list.slug)));
 assert.ok(bookReadingRoutes(untranslated,'en').some(r=>r.href.endsWith(list.slug)));
});
test('book reading routes use source identity, localized headings and at most three distinct canonical paths',()=>{
  const candidate={...book('1'),workId:'987654',title:'Translated title',author:'Different edition credit'};
  for(const locale of ['nl','en'] as const){
    const routes=bookReadingRoutes(candidate,locale);
    assert.ok(routes.length>0 && routes.length<=3);
    assert.equal(new Set(routes.map(r=>r.href)).size,routes.length);
    assert.ok(routes.every(r=>/^\/toplijsten\/[a-z0-9-]+$/.test(r.href)));
    assert.ok(routes.some(r=>r.href==='/toplijsten/na-project-hail-mary'));
    assert.deepEqual(bookReadingRoutes({...candidate,editionAvailable:false},locale),[]);
    assert.deepEqual(bookReadingRoutes({...candidate,detailLocales:locale==='nl'?['en']:['nl']},locale),[]);
    assert.deepEqual(bookReadingRoutes({...candidate,openLibraryWorkId:'OL999999999W',title:'Project Hail Mary',author:'Andy Weir'},locale),[]);
    assert.deepEqual(bookReadingRoutes({...candidate,openLibraryWorkId:undefined},locale),[]);
  }
  const route=bookReadingRoutes(candidate,'nl').find(r=>r.href==='/toplijsten/na-project-hail-mary')!;
  assert.equal(route.title,getLandingGuide(route.href,'nl')!.h1);
});
test('Suzanne links reject ambiguous identities and other authors, never invent test IDs',()=>{
  const item={...book('6','Madonna','Suzanne Vermeer'),workId:'924100301'};
  assert.equal(findSuzanneGuideBook([item],'Madonna')?.workId,'924100301');
  assert.equal(findSuzanneGuideBook([item,{...item,workId:'2'}],'Madonna'),null);
  assert.equal(findSuzanneGuideBook([{...item,author:'Other author'}],'Madonna'),null);
  assert.equal(suzanneBookGuide(item,'en'),null);
  assert.equal(suzanneBookGuide({...item,author:'Other author'},'nl'),null);
  assert.match(suzanneBookGuide(item,'nl')!.description,/kort verhaal/);
});
test('localized social assets are bounded 1200x630 PNGs and do not replace English assets',()=>{
  for(const name of ['suzanne-vermeer','fantasy-om-mee-te-beginnen','na-project-hail-mary']){
    const bytes=readFileSync(new URL('../../public/images/editorial/'+name+'-nl.png',import.meta.url));
    assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes.readUInt32BE(16),1200);assert.equal(bytes.readUInt32BE(20),630);assert.ok(bytes.length<300_000);
  }
});
