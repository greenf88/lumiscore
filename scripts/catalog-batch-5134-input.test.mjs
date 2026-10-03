import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadBatch} from './catalog-batch-postgres.mjs';
import {digest} from './catalog-batch-core.mjs';
import {createLocalDatabase} from './catalog-selection-local.mjs';
import {executeBatch,readBatchState,recoveryPlan,recoverLocalBatch} from './catalog-batch-db.mjs';
import {compositeReviewReason} from './catalog-batch-5134-research.mjs';
const manifestFile=new URL('../catalog/expansion-5134/manifest-v1.json',import.meta.url);
const manifestHash='d2114bee3612c831d8b51bf8278d278a2d81850391a66e983e5d375dff7efc7b';

test('actual 5134 manifest binds distinct ISBN/Edition/Work proof and bounded unused reserves',async()=>{
 const {input}=await loadBatch(manifestFile,manifestHash);
 const reserves=JSON.parse(await fs.readFile(new URL('../catalog/expansion-5134/reserve-v1.json',import.meta.url),'utf8'));
 assert.equal(input.records.length,5134);assert.ok(reserves.length>0&&reserves.length<=100);
 for(const key of [r=>r.open_library_id,r=>r.edition.open_library_edition_id,r=>r.edition.isbn_13]){
  const chosen=new Set(input.records.map(key));assert.equal(chosen.size,5134);assert.ok(reserves.every(r=>!chosen.has(key(r))));
 }
 assert.ok(input.records.every(r=>r.categories.length===0&&r.collections.length===0));
 assert.ok([...input.records,...reserves].every(r=>compositeReviewReason(r)===null));
 await assert.rejects(()=>loadBatch(manifestFile,'0'.repeat(64)),/MANIFEST_BYTES_DRIFT/);
});

test('actual 5134 input: production author reuse model, read-only trace, atomic retry, identities, repeat and safe recovery',{timeout:300000},async()=>{
 const {input:loaded}=await loadBatch(manifestFile,manifestHash),manifest=JSON.parse(await fs.readFile(manifestFile,'utf8'));
 const input={...loaded,synthetic:true},db=await createLocalDatabase(undefined,[]),started=performance.now();
 try{
  await db.exec(`alter table public.authors add column open_library_id text unique;alter table public.editions add column publisher text;
   create unique index test_edition_identity on public.editions(open_library_edition_id);
   create table public.test_later_activity(work_id bigint references public.works(id) on delete cascade,status text);
   create table public.test_existing_collections(id int primary key,work_id bigint references public.works(id) on delete cascade);
   insert into public.works(id,title) values(1,'Existing protected bibliography');
   insert into public.test_later_activity values(1,'read');insert into public.test_existing_collections values(1,1);
   insert into public.catalog_selections values('lumiscore-selectie-1000','LumiScore Selectie','LumiScore Selection');
   insert into public.catalog_selection_members values('lumiscore-selectie-1000',1,'old-v1');`);
  const sources=new Map(input.records.map(r=>[r.author.open_library_id,r.author]));
  const reused=manifest.reused_author_source_ids.map(key=>sources.get(key));
  await db.query('insert into public.authors(name,open_library_id) select name,open_library_id from jsonb_to_recordset($1::jsonb) as a(name text,open_library_id text)',[JSON.stringify(reused)]);
  const oldHash=digest({works:(await db.query('select * from public.works')).rows,authors:(await db.query('select * from public.authors order by id')).rows,activity:(await db.query('select * from public.test_later_activity')).rows,collections:(await db.query('select * from public.test_existing_collections')).rows});
  const trace=[],readOnly={transaction:callback=>db.transaction(async tx=>{
   await tx.exec('set transaction read only');
   const query=(sql,params)=>{assert.match(sql.trim(),/^select\s/i);trace.push(sql);return tx.query(sql,params);};return callback({query,exec:query});
  })};
  const dry=await executeBatch(readOnly,input,{local:true});assert.equal(dry.writes,0);assert.equal(trace.length,7);assert.deepEqual(dry.counts,manifest.expected_counts);
  const expected={schema:dry.schema,batch_hash:dry.batch_hash,actions:dry.actions,counts:dry.counts};
  await assert.rejects(()=>executeBatch(db,input,{local:true,apply:true,expected,confirmation:'APPLY '+input.slug,afterInsert:n=>{if(n===4000)throw Error('LOCAL_ACTUAL_BATCH_INTERRUPTION');}}),/INTERRUPTION/);
  assert.equal((await db.query('select count(*)::int n from public.works')).rows[0].n,1);assert.equal((await db.query('select count(*)::int n from public.editions')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from catalog_private.editorial_records')).rows[0].n,0);
  const applyStarted=performance.now();const applied=await executeBatch(db,input,{local:true,apply:true,expected,confirmation:'APPLY '+input.slug});const applyMs=Math.round(performance.now()-applyStarted);assert.equal(applied.writes,20537+dry.counts.new_authors);
  const state=await readBatchState(db,input.slug);assert.equal(state.works.length,5135);assert.equal(state.editions.length,5134);assert.equal(state.members.length,5134);assert.equal(state.ledger.length,5134);
  for(const r of input.records){const w=state.works.find(w=>w.open_library_id===r.open_library_id),e=state.editions.find(e=>e.open_library_edition_id===r.edition.open_library_edition_id);assert.equal(e.work_id,w.id);assert.equal(e.isbn_13,r.edition.isbn_13);assert.equal(state.authors.find(a=>a.id===w.author_id).open_library_id,r.author.open_library_id);}
  const preserved=digest({works:state.works.filter(w=>w.id===1),authors:state.authors.filter(a=>reused.some(r=>r.open_library_id===a.open_library_id)),activity:(await db.query('select * from public.test_later_activity')).rows,collections:(await db.query('select * from public.test_existing_collections')).rows});assert.equal(preserved,oldHash);
  const repeated=await executeBatch(readOnly,input,{local:true});assert.equal(repeated.counts.unchanged,5134);assert.equal(repeated.counts.new_works,0);assert.equal(repeated.counts.new_authors,0);assert.equal(repeated.counts.new_selections,0);assert.equal(repeated.writes,0);
  const chosen=state.ledger[0].work_id;await db.query("insert into public.test_later_activity values($1,'reading')",[chosen]);
  const recovery=await recoveryPlan(db,input,{local:true});assert.equal(recovery.actions.filter(a=>a.retain_bibliography).length,1);await recoverLocalBatch(db,input,recovery);
  assert.equal((await db.query('select count(*)::int n from public.works')).rows[0].n,2);assert.equal((await db.query('select count(*)::int n from public.editions')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from public.test_later_activity')).rows[0].n,2);assert.equal((await db.query('select count(*)::int n from public.test_existing_collections')).rows[0].n,1);
  assert.equal((await db.query("select count(*)::int n from public.catalog_selection_members where selection_slug='lumiscore-selectie-1000'")).rows[0].n,1);
  console.log(JSON.stringify({actual_source_local_5134_apply_ms:applyMs,actual_source_local_5134_apply_recovery_ms:Math.round(performance.now()-started),network:false,production_writes:0,production_sla:false}));
 }finally{await db.close();}
});
