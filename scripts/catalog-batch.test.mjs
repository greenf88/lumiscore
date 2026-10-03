import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalDatabase} from './catalog-selection-local.mjs';
import {validateBatch,digest,planBatch,BATCH_SCHEMA} from './catalog-batch-core.mjs';
import {executeBatch,readBatchState,recoveryPlan,recoverLocalBatch} from './catalog-batch-db.mjs';
export async function localBatchDatabase(){
 const db=await createLocalDatabase(undefined,[]);
 await db.exec('alter table public.authors add column open_library_id text unique; alter table public.editions add column publisher text; create unique index test_edition_identity on public.editions(open_library_edition_id)');
 return db;
}
const isbn=n=>{const body='9781234'+String(n).padStart(5,'0');return body+((10-[...body].reduce((s,c,i)=>s+Number(c)*(i%2?3:1),0)%10)%10);};
export function syntheticBatch(){
 return {schema:BATCH_SCHEMA,slug:'lumiscore-plus500-synthetic-test',required_new_works:500,synthetic:true,records:Array.from({length:500},(_,i)=>({candidate_id:'LSPLUS500-'+String(i+1).padStart(4,'0'),title:'Synthetic verified novel '+i,author:{name:'Synthetic Author '+(i%100),open_library_id:'OL'+(9000000+i%100)+'A'},open_library_id:'OL'+(9000000+i)+'W',year:2020,edition:{open_library_edition_id:'OL'+(9000000+i)+'M',title:'Synthetic verified novel '+i,isbn_13:isbn(i),isbn_10:null,language:i%2?'dut':'eng',publisher:'Synthetic publisher'},categories:[],collections:[],proof:{route:'ISBN_EDITION_WORK',isbn_13:isbn(i),edition_key:'/books/OL'+(9000000+i)+'M',work_keys:['/works/OL'+(9000000+i)+'W'],author_keys:['/authors/OL'+(9000000+i%100)+'A'],physical_format:'Paperback',pages:200,source_url:'https://openlibrary.org/api/books?synthetic=1',search_url:'https://openlibrary.org/search.json?synthetic=1',verified_at:'2026-10-03T00:00:00Z'}}))};
}
test('batch identity proof is strict; synthetic input cannot reach production',()=>{
 const input=syntheticBatch();assert.throws(()=>validateBatch(input),/SYNTHETIC/);validateBatch(input,{local:true});
 for(const mutate of [r=>r.proof.work_keys.push('/works/OL123W'),r=>r.edition.isbn_13='9781234567890',r=>r.proof.physical_format='Audio CD',r=>r.categories.push('fiction_fantasy'),r=>r.author.open_library_id='OL123A']){
  const copy=structuredClone(input);mutate(copy.records[0]);assert.throws(()=>validateBatch(copy,{local:true}));
 }
 const copy=structuredClone(input);copy.records[1]=copy.records[0];assert.throws(()=>validateBatch(copy,{local:true}),/DUPLICATE/);
 const translation=structuredClone(input);translation.records[0].edition.title='Existing translated title';
 const state={authors:[{id:1,...translation.records[0].author}],works:[{id:1,title:'Existing translated title',author_id:1,open_library_id:'OL11W'}],editions:[],aliases:[],ledger:[],members:[]};
 assert.equal(planBatch(translation,state,{local:true}).actions[0].kind,'conflict','Chosen Edition title must also match editionless existing Works');
});
test('500 additive inserts: rollback/retry/idempotence/drift and recovery retain old and later user data', {timeout:120000},async()=>{
 const db=await localBatchDatabase(),input=syntheticBatch();
 try{
  await db.exec(`insert into public.authors(id,name,open_library_id) values(1,'Synthetic Author 0','OL9000000A');
   insert into public.works(id,title,author_id) values(1,'Historical book',1);
   create table public.test_later_ratings(work_id bigint references public.works(id) on delete cascade,rating int);
   create table public.test_collections(id int primary key,work_id bigint references public.works(id) on delete cascade);
   insert into public.test_later_ratings values(1,5);insert into public.test_collections values(1,1);
   insert into public.catalog_selections values('lumiscore-selectie-1000','LumiScore Selectie','LumiScore Selection');
   insert into public.catalog_selection_members values('lumiscore-selectie-1000',1,'LS1000-old');
   select setval(pg_get_serial_sequence('public.authors','id'),1);`);
  const old=(await db.query('select * from public.works where id=1')).rows;
  const dry=await executeBatch(db,input,{local:true});assert.equal(dry.applied,false);assert.equal(dry.writes,0);assert.equal(dry.counts.new_works,500);assert.equal(dry.counts.new_authors,99);
  const expected=planBatch(input,await readBatchState(db,input.slug),{local:true});
  await assert.rejects(()=>executeBatch(db,input,{apply:true,local:true,confirmation:'APPLY '+input.slug,expected,afterInsert:n=>{if(n===23)throw Error('SYNTHETIC_INTERRUPTION');}}),/INTERRUPTION/);
  assert.equal((await db.query('select count(*)::int as n from public.works')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int as n from public.authors')).rows[0].n,1);
  await assert.rejects(()=>executeBatch(db,input,{apply:true,local:true,expected}),/CONFIRMATION/);
  await db.query('insert into public.editions(work_id,title,isbn_13) values(1,$1,$2)',['Other book',input.records[0].edition.isbn_13]);
  await assert.rejects(()=>executeBatch(db,input,{apply:true,local:true,confirmation:'APPLY '+input.slug,expected}),/CONFLICT/);
  await db.query('delete from public.editions where work_id=1');
  await executeBatch(db,input,{apply:true,local:true,confirmation:'APPLY '+input.slug,expected});
  assert.equal((await db.query('select count(*)::int as n from public.works')).rows[0].n,501);
  assert.equal((await db.query('select count(*)::int as n from public.editions')).rows[0].n,500);
  const repeated=planBatch(input,await readBatchState(db,input.slug),{local:true});
  assert.equal(repeated.counts.unchanged,500);
  assert.equal((await executeBatch(db,input,{apply:true,local:true,confirmation:'APPLY '+input.slug,expected:repeated})).writes,0);
  assert.deepEqual((await db.query('select * from public.works where id=1')).rows,old);
  const chosen=(await db.query('select work_id from public.catalog_selection_members where selection_slug=$1 order by candidate_id limit 1',[input.slug])).rows[0].work_id;
  await db.query('insert into public.test_later_ratings values($1,4)',[chosen]);
  const beforeRecovery=await recoveryPlan(db,input,{local:true});
  assert.equal(beforeRecovery.actions.filter(a=>a.retain_bibliography).length,1);
  await recoverLocalBatch(db,input,beforeRecovery);
  assert.equal((await db.query('select count(*)::int as n from public.works')).rows[0].n,2);
  assert.equal((await db.query('select count(*)::int as n from public.editions')).rows[0].n,1);
  assert.deepEqual((await db.query('select * from public.test_later_ratings order by work_id')).rows,[{work_id:1,rating:5},{work_id:chosen,rating:4}]);
  assert.equal((await db.query('select count(*)::int as n from public.test_collections')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int as n from public.catalog_selection_members')).rows[0].n,1);
  assert.equal((await db.query('select public.catalog_editorial_page() as data')).rows[0].data.total,2);
  assert.equal((await db.query("select public.catalog_editorial_page('Synthetic verified') as data")).rows[0].data.total,1);
  assert.throws(()=>digest(undefined));
 }finally{await db.close();}
});
