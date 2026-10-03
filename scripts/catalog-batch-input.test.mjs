import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createLocalDatabase} from './catalog-selection-local.mjs';
import {loadBatch} from './catalog-batch-postgres.mjs';
import {executeBatch,readBatchState,recoveryPlan,recoverLocalBatch} from './catalog-batch-db.mjs';
import {planBatch} from './catalog-batch-core.mjs';
const manifest=new URL('../catalog/expansion-500/manifest-v2-reviewed.json',import.meta.url);
const hash='aa13b44b71f03acb2889fd86cf62e81f567c545b9f5c132d62de52f2cc528eaf';
test('frozen public batch: 500 distinct exact normal ISBN-edition-parent chains, no credentials/network required',async()=>{
 const {input}=await loadBatch(manifest,hash);
 assert.equal(input.records.length,500);assert.equal(new Set(input.records.map(r=>r.open_library_id)).size,500);
 assert.equal(new Set(input.records.map(r=>r.edition.isbn_13)).size,500);
 const actual=createHash('sha256').update(await fs.readFile(manifest)).digest('hex');assert.equal(actual,hash);
 assert.ok(input.records.every(r=>r.categories.length===0&&r.collections.length===0));
 await assert.rejects(()=>loadBatch(manifest,'0'.repeat(64)),/DRIFT/);
});
test('actual frozen 500-book input executes/repeats/recovers locally without touching V1 or later activity',{timeout:120000},async()=>{
 const {input:loaded}=await loadBatch(manifest,hash);
 const input={...loaded,synthetic:true}; // ONLY the local run is marked synthetic; real source records unchanged.
 const db=await createLocalDatabase(undefined,[]);
 try{
  await db.exec(`alter table public.authors add column open_library_id text unique;
   alter table public.editions add column publisher text;
   create unique index test_edition_identity on public.editions(open_library_edition_id);
   create table public.test_activity(work_id bigint references public.works(id) on delete cascade,status text);
   insert into public.works(id,title) values(1,'Historical uncategorized book');
   insert into public.test_activity values(1,'read');
   insert into public.catalog_selections values('lumiscore-selectie-1000','LumiScore Selectie','LumiScore Selection');
   insert into public.catalog_selection_members values('lumiscore-selectie-1000',1,'LS1000-existing');`);
  const trace=[];
  const dryAdapter={transaction:callback=>db.transaction(async tx=>{
   await tx.exec('set transaction read only');
   const query=async(sql,params)=>{assert.match(sql.trim(),/^select\s/i);trace.push(sql);return tx.query(sql,params);};
   return callback({query,exec:query});
  })};
  const dry=await executeBatch(dryAdapter,input,{local:true});assert.equal(dry.writes,0);assert.equal(trace.length,6);
  assert.equal(dry.counts.new_works,500);assert.equal(dry.counts.new_editions,500);
  const expected=planBatch(input,await readBatchState(db,input.slug),{local:true});
  const applied=await executeBatch(db,input,{local:true,apply:true,confirmation:'APPLY '+input.slug,expected});assert.equal(applied.counts.new_works,500);
  const state=await readBatchState(db,input.slug);assert.equal(state.works.length,501);assert.equal(state.editions.length,500);
  const repeated=planBatch(input,state,{local:true});assert.equal(repeated.counts.unchanged,500);
  assert.equal((await executeBatch(db,input,{local:true,apply:true,confirmation:'APPLY '+input.slug,expected:repeated})).writes,0);
  const id=state.ledger[0].work_id;await db.query("insert into public.test_activity values($1,'reading')",[id]);
  const recovery=await recoveryPlan(db,input,{local:true});assert.equal(recovery.actions.filter(a=>a.retain_bibliography).length,1);
  await recoverLocalBatch(db,input,recovery);
  assert.equal((await db.query('select count(*)::int as n from public.works')).rows[0].n,2);
  assert.equal((await db.query('select count(*)::int as n from public.test_activity')).rows[0].n,2);
  assert.equal((await db.query("select count(*)::int as n from public.catalog_selection_members where selection_slug='lumiscore-selectie-1000'")).rows[0].n,1);
 }finally{await db.close();}
});
