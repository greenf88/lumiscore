import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,asUser,a,b} from '../test-support/taste-results/fixture.mjs';
import {loadReaderTasteProfile} from '../lib/supabase/reader-taste-profile.ts';

test('failed owner read is a failure, never an empty or guest-only profile',async()=>{
 const rejected={from(){const q={select(){return q;},eq(){return q;},in(){return q;},order(){return q;},range(){return q;},then(resolve){return Promise.resolve(resolve({data:null,error:new Error('SYNTHETIC_READ_FAILED')}));}};return q;}};
 await assert.rejects(()=>loadReaderTasteProfile(rejected,a,'nl'),/SYNTHETIC_READ_FAILED/);
});

test('actual local PostgreSQL/RLS: complete owner data and dense evidence pages, updates/deletes and isolation',async()=>{
 const db=await fixture(),calls=[];
 try{
  await db.exec(await readFile(new URL('../supabase/migrations/20260913150000_taste_test_responses.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20260913182320_work_trait_evidence.sql',import.meta.url),'utf8'));
  await db.exec(`insert into public.ratings(user_id,work_id,rating) select '${a}',i,8 from generate_series(2,1205)i;
   insert into public.user_book_status(user_id,work_id,status) select '${a}',i,'reading' from generate_series(1206,2410)i;
   insert into public.work_trait_evidence(work_id,trait,weight,confidence,source,source_key,raw_labels,mapping_version,verified_at) select i,t,1,1,'manual','shared-profile','{}','taste_traits_v1','2026-10-15' from generate_series(1,200)i cross join unnest(array['thriller_mystery','dark','fast_paced','contemporary','literary','nonfiction'])t;
   insert into public.work_trait_evidence(work_id,trait,weight,confidence,source,source_key,raw_labels,mapping_version,verified_at) select i,'classic',1,1,'publication_year','shared-profile','{}','taste_traits_v1','2026-10-15' from generate_series(201,400)i;
   insert into public.taste_test_responses(user_id,quiz_version,question_key,choice) values('${a}','taste_test_v1','fantasy-or-science-fiction','left');`);
  const client={from(table){assert.ok(['ratings','user_book_status','taste_test_responses','work_trait_evidence'].includes(table));let columns='',clauses=[],args=[],order=[],range=null;
   const q={select(c){assert.match(c,/^[a-z_,]+$/);columns=c;return q;},eq(k,v){assert.ok(['user_id','mapping_version','quiz_version'].includes(k));args.push(v);clauses.push(`${k}=$${args.length}`);return q;},in(k,v){assert.ok(['work_id','question_key'].includes(k));args.push(v);clauses.push(`${k}=any($${args.length}::${k==='work_id'?'bigint':'text'}[])`);return q;},order(k){assert.ok(['work_id','trait','source','source_key','question_key'].includes(k));order.push(k);return q;},range(lo,hi){range=[lo,hi];return q;},async then(resolve){calls.push({table,range,ownerFiltered:clauses.some(c=>c.startsWith('user_id='))});try{const r=await db.query(`select ${columns} from public.${table} where ${clauses.join(' and ')} order by ${order.join(',')}${range?` limit ${range[1]-range[0]+1} offset ${range[0]}`:''}`,args);return resolve({data:r.rows,error:null});}catch(error){return resolve({data:null,error});}}};return q;}};
  await asUser(db,a);const reader=await loadReaderTasteProfile(client,a,'nl');
  assert.equal(reader.ratings.length,1205);assert.equal(reader.statuses.length,2410);
  assert.deepEqual(reader.profile.coverage,{ratedWorks:1205,contentWorks:200,eraOnlyWorks:200,unknownWorks:805,contentRatio:200/1205});
  assert.equal(reader.profile.selectedCount,1);assert.equal(reader.profile.confidence,'LOW');assert.equal(reader.profile.archetype,null);
  for(const table of ['ratings','user_book_status','work_trait_evidence'])assert.ok(calls.some(c=>c.table===table&&c.range?.[0]===1000),table+' second page');
  assert.ok(calls.filter(c=>c.table!=='work_trait_evidence').every(c=>c.ownerFiltered));
  const repeated=await loadReaderTasteProfile(client,a,'nl');assert.deepEqual(repeated.profile,reader.profile);
  await db.query('update public.ratings set rating=1 where user_id=$1 and work_id=1',[a]);
  assert.notDeepEqual((await loadReaderTasteProfile(client,a,'nl')).profile.vector,reader.profile.vector);
  await db.query('delete from public.ratings where user_id=$1 and work_id=1',[a]);
  assert.equal((await loadReaderTasteProfile(client,a,'nl')).profile.ratingCount,1204);
  await asUser(db,b);const other=await loadReaderTasteProfile(client,b,'en');assert.equal(other.profile.ratingCount,1);assert.equal(other.profile.selectedCount,0);
  const wrongOwner=await loadReaderTasteProfile(client,a,'en');assert.equal(wrongOwner.profile.ratingCount,0);assert.equal(wrongOwner.profile.selectedCount,0);
  await db.exec('reset role;set role anon');await assert.rejects(()=>loadReaderTasteProfile(client,a,'en'),e=>e.code==='42501');
 }finally{await db.close();}
});

test('all live consumers delegate to the same owner loader; private API contract and no public cache retained',async()=>{
 for(const path of ['lib/supabase/taste-test.ts','lib/supabase/rating-result.ts']){
  const source=await readFile(new URL('../'+path,import.meta.url),'utf8');assert.match(source,/loadReaderTasteProfile\(client,user\.id,locale\)/);assert.doesNotMatch(source,/buildTasteProfile\(|buildRatingResultProfile\(/);
 }
 const reader=await readFile(new URL('../lib/supabase/reader-taste-profile.ts',import.meta.url),'utf8');assert.match(reader,/cache\(async/);assert.doesNotMatch(reader,/unstable_cache|let.*Cache/);
 const api=await readFile(new URL('../app/api/taste-test/route.ts',import.meta.url),'utf8');assert.match(api,/headers: PRIVATE_RESPONSE_HEADERS/);assert.match(api,/isSameOriginRequest/);
 const dutch=await readFile(new URL('../lib/supabase/dutch-homepage-discovery.ts',import.meta.url),'utf8');assert.match(dutch,/const profile = reader.profile!/);assert.doesNotMatch(dutch,/buildTasteProfile/);
});
