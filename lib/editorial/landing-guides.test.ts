import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { availableGuideGroups, bookReadingRoutes, findSuzanneGuideBook, getLandingGuide, LANDING_GUIDES, suzanneBookGuide } from './landing-guides.ts';
import { editorialTopLists, getEditorialWorkSourceId } from '../catalog/top-lists.ts';
import type { Book } from '../../app/data/books.ts';

const book=(id:string,title='Verified Dutch title',author='Verified author'):Book=>({id,source:'supabase',workId:id,openLibraryWorkId:getEditorialWorkSourceId(id),title,author,score:null,ratingsCount:null,match:null,cover:'orbit',editionAvailable:true});
test('target guides retain candidates/order while links use real language-selected identities',()=>{
  for(const guide of LANDING_GUIDES.slice(1)){
    const path=guide.path.slice(3), list=editorialTopLists.find(l=>'/toplijsten/'+l.slug===path)!;
    assert.equal(list.workIds.length,10);assert.equal(getLandingGuide(path,'en'),null);
    assert.doesNotMatch(guide.h1,/\btien\b|\b10\b/);
    const first=guide.cards![0].work_id, chosen={...book(first),workId:'999999',title:'Actual Dutch edition title'};
    const groups=availableGuideGroups(guide,[{...chosen,editionAvailable:false},chosen]);
    assert.deepEqual(groups.flatMap(g=>g.entries),[{candidateId:first,workId:'999999',title:'Actual Dutch edition title'}]);
    assert.equal(availableGuideGroups(guide,[]).length,0);
    assert.ok(bookReadingRoutes(chosen,'nl').some(r=>r.href===path));
    assert.ok(bookReadingRoutes(chosen,'en').some(r=>r.href===path && r.title===list.title.en));
  }
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
