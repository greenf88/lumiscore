// Offline preparation only. Never copies users, ratings, traits, series links or progress.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../catalog/nl100-hosted-20261031/',import.meta.url),base=new URL('../catalog/nl100-completion-20261031/',import.meta.url);
const read=(n,r=root)=>JSON.parse(fs.readFileSync(new URL(n,r)));
const state=read('test-fixture-availability.json'),test=read('test-before.json'),production=read('production-readback.json'),mapping=read('test-identity-map.json');
const globalIsbns=read('test-global-isbn-check.json');if(globalIsbns.length!==80||globalIsbns.some(c=>c.matches.length))throw Error('Unexpected test ISBN already exists; re-review before fixture/import preparation');
if(state.project!=='hlvujbrmfdlrfxdjwsmb'||state.reserved_works.length||state.reserved_editions.length||state.reserved_authors.length)throw Error('Wrong project or occupied proposed ID range');
const plans=read('batches.json',base).batches.map(b=>read(b.directory+'production-plan.json',base));
const workMap=new Map(),authorMap=new Map(),fixtures={authors:[],works:[],editions:[]},holds=[];
// Reuse authors through already verified Work + exact-edition identity, not names alone.
for(const m of mapping.rows.filter(m=>m.state==='existing_test_identity_verified')){
 const id=m.testCandidates[0].author.id,known=authorMap.get(m.productionAuthorId);
 if(known&&known!==id)throw Error('Conflicting author identities through mapped Works');authorMap.set(m.productionAuthorId,id);
}
const extra=read('additional-author-identity.json');
if(extra.productionAuthorId!==89||extra.production.author_source_id!=='OL1394359A'||extra.production.open_library_id!==extra.test.open_library_id||!extra.production.editions.some(e=>extra.test.editions.some(t=>e.isbn_13===t.isbn_13&&e.open_library_edition_id===t.open_library_edition_id)))throw Error('Unproved supplementary author identity');
authorMap.set(extra.productionAuthorId,extra.testAuthorId);
for(const [i,m] of mapping.rows.entries()){
 const w=production.works.find(w=>w.id===m.productionWorkId),a=production.authors.find(a=>a.id===w.author_id);
 const same=state.authors.filter(t=>a.open_library_id&&t.open_library_id===a.open_library_id);
 let authorId=authorMap.get(a.id);
 if(!authorId){if(same.length===1)authorId=same[0].id;else if(same.length>1)holds.push({productionAuthorId:a.id,reason:'Multiple test author source identities'});else {
  const names=state.authors.filter(t=>t.name===a.name);if(names.length)holds.push({productionAuthorId:a.id,reason:'Name-only author match requires explicit identity review; not silently merged'});
  else{authorId=969300001+fixtures.authors.length;fixtures.authors.push({id:authorId,name:a.name,open_library_id:a.open_library_id});}}
  if(authorId)authorMap.set(a.id,authorId);
 }
 if(m.state==='existing_test_identity_verified')workMap.set(w.id,m.testCandidates[0].testWorkId);
 else if(m.state==='public_test_fixture_missing'&&authorId){const id=969100001+i;workMap.set(w.id,id);fixtures.works.push({productionWorkId:w.id,record:{id,title:w.title,author_id:authorId,first_publish_year:w.first_publish_year,open_library_id:w.open_library_id,source_type:w.source_type,native_identity_key:w.native_identity_key}});}
 else holds.push({productionWorkId:w.id,reason:'Unresolved test Work/author identity'});
}
const mapped=[];let nextEditionId=969200001;
for(const plan of plans)for(const action of plan.actions){const a=structuredClone(action),sourceWorkId=a.after.work_id,testWorkId=workMap.get(sourceWorkId);if(!testWorkId)continue;
 a.productionWorkId=sourceWorkId;a.after.work_id=testWorkId;
 if(Object.hasOwn(a.after,'bound_author_id')){const authorId=authorMap.get(a.after.bound_author_id);if(!authorId)throw Error('Unmapped test author binding');a.after.bound_author_id=authorId;}
 if(a.relation==='editions'){
  if(a.before){const original=a.before,existing=test.editions.filter(e=>e.work_id===testWorkId&&(e.isbn_13===original.isbn_13||original.isbn_10&&e.isbn_10===original.isbn_10));if(existing.length>1){holds.push({workId:sourceWorkId,reason:'Ambiguous exact test edition'});continue;}
   let id;if(existing.length===1){id=existing[0].id;a.before=existing[0];}else{id=nextEditionId++;const record={...original,id,work_id:testWorkId};delete record.created_at;fixtures.editions.push({productionEditionId:original.id,productionWorkId:sourceWorkId,record});a.before={...record,created_at:'READ_BACK_AFTER_SEED_COMMIT'};}
   a.key={id};a.after.id=id;delete a.after.created_at;
  }
 }else if(a.relation==='catalog_work_descriptions'){a.key.work_id=testWorkId;a.before=test.descriptions.find(x=>x.work_id===testWorkId&&x.language===a.key.language)??null;}
 else if(a.relation==='catalog_edition_metadata'&&typeof a.key.edition_id==='number'){
  const ed=fixtures.editions.find(e=>e.productionEditionId===a.key.edition_id)??{record:test.editions.find(e=>e.work_id===testWorkId&&e.isbn_13===a.after.bound_isbn13)};
  if(!ed.record){holds.push({workId:sourceWorkId,reason:'Missing mapped metadata edition'});continue;}a.key.edition_id=ed.record.id;a.after.edition_id=ed.record.id;a.before=test.metadata.find(x=>x.edition_id===ed.record.id)??null;
 }
 mapped.push(a);
}
const manifest={project:'hlvujbrmfdlrfxdjwsmb',state:'OFFLINE_PREPARATION_NOT_EXECUTABLE_SQL',confirmationRestored:false,writeAttempts:0,sourceChecksAt:{identity:test.at,availableIds:state.at},policy:['Recheck free IDs, exact source identity and all expected before rows immediately before any future test installation.','No seed/import until the normal confirmation route is demonstrably restored. No browser/alternate-credential workaround.','Stage public seed separately with a first non-empty receipt, read generated timestamps, then render the240-action TEST-specific import with those exact before values. Production SQL must never be run on test.','Stop for unexpected rows, dependencies, ISBN collisions or source identity mismatch. No automatic numbering reset.','Committed hosted undo is a separate future check, not proved by local COMMIT/undo or transactional ROLLBACK.'],fixtures,mappedActions:mapped,workMap:Object.fromEntries(workMap),holds,summary:{existingTestWorks:mapping.rows.filter(m=>m.state==='existing_test_identity_verified').length,newPublicTestWorks:fixtures.works.length,newPublicTestAuthors:fixtures.authors.length,baselineEditionsForLanguageCorrection:fixtures.editions.length,mappedCatalogueActions:mapped.length,productionWrites:0,testWrites:0},excludedRelations:['auth.users','ratings','user_book_status','user_preferences','collections','collection_works','taste_test_inventory','work_traits'],warning:'English comparison fixtures and any test-only review collection must be reviewed separately if required; this manifest does not silently seed them.'};
const text=JSON.stringify(manifest,null,2)+'\n';fs.writeFileSync(new URL('test-execution-manifest.json',root),text);fs.writeFileSync(new URL('test-execution-manifest.sha256',root),createHash('sha256').update(text).digest('hex')+'  test-execution-manifest.json\n');console.log(JSON.stringify({summary:manifest.summary,holds}));
