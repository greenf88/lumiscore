import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalDatabase} from './catalog-selection-local.mjs';
import {validateBatch,planBatch,LARGE_BATCH_SCHEMA,digest} from './catalog-batch-core.mjs';
import {minimalEdition,minimalWork} from './catalog-batch-dump.mjs';
import {executeBatch,readBatchState,recoveryPlan,recoverLocalBatch} from './catalog-batch-db.mjs';
const isbn=n=>{const body='9785678'+String(n).padStart(5,'0');return body+((10-[...body].reduce((s,c,i)=>s+Number(c)*(i%2?3:1),0)%10)%10);};
function input(){return {schema:LARGE_BATCH_SCHEMA,slug:'lumiscore-plus1860-synthetic-test',required_new_works:1860,synthetic:true,records:Array.from({length:1860},(_,i)=>({candidate_id:'LSPLUS1860-'+String(i+1).padStart(4,'0'),title:'Local enlarged test novel '+i,author:{name:'Local enlarged Author '+(i%200),open_library_id:'OL'+(8000000+i%200)+'A'},open_library_id:'OL'+(8000000+i)+'W',year:2000,edition:{open_library_edition_id:'OL'+(8000000+i)+'M',title:'Local enlarged test novel '+i,isbn_13:isbn(i),isbn_10:null,language:'eng',publisher:null},categories:[],collections:[],proof:{route:'ISBN_EDITION_WORK',isbn_13:isbn(i),edition_key:'/books/OL'+(8000000+i)+'M',work_keys:['/works/OL'+(8000000+i)+'W'],author_keys:['/authors/OL'+(8000000+i%200)+'A'],physical_format:'Paperback',pages:200,source_url:'https://openlibrary.org/api/books?synthetic=1',search_url:'https://openlibrary.org/search.json?synthetic=1',verified_at:'2026-10-03T00:00:00Z'}}))};}
test('1860 contract is explicit, bounded and cannot weaken historical 500 or allow synthetic production',()=>{
 const batch=input();validateBatch(batch,{local:true});assert.throws(()=>validateBatch(batch),/SYNTHETIC/);
 for(const modify of [b=>b.required_new_works=1859,b=>b.records.pop(),b=>b.schema='lumiscore-additive-batch-1',b=>b.slug='lumiscore-plus500-synthetic-test',b=>b.records[0].candidate_id='LSPLUS500-0001']){const b=structuredClone(batch);modify(b);assert.throws(()=>validateBatch(b,{local:true}));}
 const state={authors:[],works:[],editions:[],aliases:[],ledger:[],members:[],selection:[{slug:batch.slug}]};assert.throws(()=>planBatch(batch,state,{local:true}),/SELECTION_COLLISION/);
});
test('bulk proof binds exact minimal Edition facts, single parent, authors, language, pages and publisher',()=>{
 const b=input(),r=b.records[0],source=minimalEdition({key:r.proof.edition_key,title:r.edition.title,works:r.proof.work_keys.map(key=>({key})),authors:r.proof.author_keys.map(key=>({key})),isbn_13:[r.edition.isbn_13],languages:[{key:'/languages/eng'}],physical_format:'Paperback',number_of_pages:200});
 r.proof.source_url='https://archive.org/download/ol_dump_2026-09-30/ol_dump_editions_2026-09-30.txt.gz';r.proof.dump={sha1:'a'.repeat(40),sha256:'b'.repeat(64),record_sha256:digest(source),revision:1,record:source};validateBatch(b,{local:true});
 for(const mutate of [x=>x.proof.dump.record.title='Other book',x=>x.proof.dump.record.works.push({key:'/works/OL1W'}),x=>x.proof.dump.record_sha256='c'.repeat(64),x=>x.proof.dump.sha1='',x=>x.edition.publisher='Invented publisher',x=>x.proof.pages=201]){const copy=structuredClone(b);mutate(copy.records[0]);assert.throws(()=>validateBatch(copy,{local:true}));}
});
test('missing Edition author requires an exact hashed single-author Work proof; contradictions cannot be overridden',()=>{
 const b=input(),r=b.records[0],source=minimalEdition({key:r.proof.edition_key,title:r.edition.title,works:r.proof.work_keys.map(key=>({key})),isbn_13:[r.edition.isbn_13],languages:[{key:'/languages/eng'}],physical_format:'Paperback',number_of_pages:200});
 const work=minimalWork({key:r.proof.work_keys[0],title:r.title,authors:r.proof.author_keys.map(key=>({author:{key},type:{key:'/type/author_role'}}))});
 r.proof.source_url='https://archive.org/download/ol_dump_2026-09-30/ol_dump_editions_2026-09-30.txt.gz';r.proof.dump={sha1:'a'.repeat(40),sha256:'b'.repeat(64),record_sha256:digest(source),revision:1,record:source};
 assert.throws(()=>validateBatch(b,{local:true}),/PROOF_DRIFT/);
 r.proof.author_source='WORK_DUMP';r.proof.work_dump={url:'https://archive.org/download/ol_dump_2026-09-30/ol_dump_works_2026-09-30.txt.gz',sha1:'c'.repeat(40),sha256:'d'.repeat(64),revision:1,record:work,record_sha256:digest(work)};validateBatch(b,{local:true});
 for(const mutate of [x=>x.proof.work_dump.record.title='Another book',x=>x.proof.work_dump.record.key='/works/OL1W',x=>x.proof.work_dump.record_sha256='e'.repeat(64),x=>x.proof.work_dump.sha256='',x=>x.proof.work_dump.record.authors.push({author:{key:'/authors/OL1A'}}),x=>{x.proof.dump.record.authors=[{key:'/authors/OL1A'}];x.proof.dump.record_sha256=digest(x.proof.dump.record);},x=>delete x.proof.work_dump]){const copy=structuredClone(b);mutate(copy.records[0]);assert.throws(()=>validateBatch(copy,{local:true}),/PROOF_DRIFT/);}
});
test('1860 atomic rollback/retry, full inserts, zero-write repeat, targeted recovery preserves later activity',{timeout:180000},async()=>{
 const batch=input(),db=await createLocalDatabase(undefined,[]),started=performance.now();
 try{
  await db.exec(`alter table public.authors add column open_library_id text unique;alter table public.editions add column publisher text;
   create table public.test_user_activity(work_id bigint references public.works(id) on delete cascade,status text);
   insert into public.works(id,title) values(1,'Existing protected work');insert into public.test_user_activity values(1,'read');
   insert into public.catalog_selections values('lumiscore-selectie-1000','LumiScore Selectie','LumiScore Selection');
   insert into public.catalog_selection_members values('lumiscore-selectie-1000',1,'old');`);
  const dry=await executeBatch(db,batch,{local:true});assert.equal(dry.writes,0);assert.equal(dry.counts.new_works,1860);assert.equal(dry.counts.new_editions,1860);assert.equal(dry.counts.new_authors,200);assert.equal(dry.counts.new_selections,1);
  const expected={schema:dry.schema,batch_hash:dry.batch_hash,actions:dry.actions,counts:dry.counts};
  await assert.rejects(()=>executeBatch(db,batch,{local:true,apply:true,confirmation:'APPLY '+batch.slug,expected,afterInsert:n=>{if(n===1000)throw Error('LOCAL_INTERRUPTION');}}),/INTERRUPTION/);
  for(const table of ['authors','editions','catalog_selection_members'])assert.equal((await db.query('select count(*)::int n from public.'+table)).rows[0].n,table==='catalog_selection_members'?1:0);
  assert.equal((await db.query('select count(*)::int n from public.works')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from catalog_private.editorial_records')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from public.catalog_selections')).rows[0].n,1);
  const applied=await executeBatch(db,batch,{local:true,apply:true,confirmation:'APPLY '+batch.slug,expected});assert.equal(applied.writes,1+200+4*1860);
  const repeated=await executeBatch(db,batch,{local:true});assert.equal(repeated.counts.unchanged,1860);assert.equal(repeated.counts.new_selections,0);assert.equal(repeated.writes,0);
  await db.query('update public.catalog_selections set label_en=$1 where slug=$2',['Unexpected selection label',batch.slug]);await assert.rejects(()=>executeBatch(db,batch,{local:true}),/SELECTION_DRIFT/);await db.query('update public.catalog_selections set label_en=$1 where slug=$2',['Catalog expansion +1860',batch.slug]);
  const state=await readBatchState(db,batch.slug),chosen=state.ledger[0].work_id;await db.query("insert into public.test_user_activity values($1,'reading')",[chosen]);
  const recovery=await recoveryPlan(db,batch,{local:true});assert.equal(recovery.actions.filter(a=>a.retain_bibliography).length,1);await recoverLocalBatch(db,batch,recovery);
  assert.equal((await db.query('select count(*)::int n from public.works')).rows[0].n,2);assert.equal((await db.query('select count(*)::int n from public.test_user_activity')).rows[0].n,2);assert.equal((await db.query('select count(*)::int n from public.catalog_selection_members')).rows[0].n,1);
  console.log(JSON.stringify({local_1860_atomic_apply_recovery_ms:Math.round(performance.now()-started),synthetic:true,production_sla:false}));
 }finally{await db.close();}
});
