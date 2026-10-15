import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readingProfileTotals} from '../lib/collections/reading-profile.ts';
import {loadReadingProfileForOwner} from '../lib/supabase/reading-profile.ts';
import {fixture,asUser,a,b} from '../test-support/taste-results/fixture.mjs';

test('unique-Work totals apply rated-implies-read without adding overlapping groups',()=>{
 assert.deepEqual(readingProfileTotals([{work_id:1,rating:8},{work_id:'1',rating:8},{work_id:2,rating:4}],
  [{work_id:1,status:'want_to_read'},{work_id:3,status:'read'},{work_id:4,status:'want_to_read'},{work_id:5,status:'reading'},{work_id:6,status:'dnf'}]),
 {read:3,rated:2,wantToRead:1,reading:1});
 assert.deepEqual(readingProfileTotals([],[]),{read:0,rated:0,wantToRead:0,reading:0});
});

// In-memory PostgreSQL executes the existing schema/RLS, through the same
// pagination/filter calls as Supabase. Not hosted Auth/mail or browser proof.
test('actual PostgreSQL: all owner pages, dense evidence, two users and anon isolation',async()=>{
 const db=await fixture();const calls=[];
 try{
  await db.exec(await readFile(new URL('../supabase/migrations/20260913150000_taste_test_responses.sql',import.meta.url),'utf8'));
  await db.exec(`create table public.work_trait_evidence(work_id bigint,trait text,weight numeric,confidence numeric,source text,source_key text,raw_labels jsonb,mapping_version text,verified_at timestamptz,primary key(work_id,trait,source,source_key));
   grant select on public.work_trait_evidence to anon,authenticated;
   insert into public.ratings(user_id,work_id,rating) select '${a}',i,8 from generate_series(2,1205)i;
   insert into public.user_book_status(user_id,work_id,status) select '${a}',i,'reading' from generate_series(1206,1210)i;
   insert into public.user_book_status(user_id,work_id,status) select '${a}',i,'want_to_read' from generate_series(1211,1218)i;
   insert into public.user_book_status(user_id,work_id,status) select '${a}',i,'read' from generate_series(1219,1222)i;
   insert into public.work_trait_evidence select i,t,1,1,'manual','profile-test','[]','taste_traits_v1','2026-10-15' from generate_series(1,200)i cross join unnest(array['thriller_mystery','dark','fast_paced','contemporary','literary','nonfiction'])t;`);
  const client={from(table){assert.ok(['ratings','user_book_status','work_trait_evidence','taste_test_responses'].includes(table));let columns,clauses=[],args=[],order=[],range=[0,999];
   const q={select(c){columns=c;return q},eq(k,v){assert.ok(['user_id','mapping_version','quiz_version'].includes(k));args.push(v);clauses.push(`${k}=$${args.length}`);return q},in(k,values){assert.ok(['work_id','question_key'].includes(k));args.push(values);clauses.push(`${k}=any($${args.length}::${k==='work_id'?'bigint':'text'}[])`);return q},order(k){assert.ok(['work_id','trait','source','source_key','question_key'].includes(k));order.push(k);return q},range(lo,hi){range=[lo,hi];return q},async then(ok){calls.push({table,columns,range,filters:[...clauses]});try{assert.match(columns,/^[a-z_,]+$/);assert.ok(range);const result=await db.query(`select ${columns} from public.${table} where ${clauses.join(' and ')} order by ${order.join(',')} limit ${range[1]-range[0]+1} offset ${range[0]}`,args);return ok({data:result.rows,error:null});}catch(error){return ok({data:null,error});}}};return q;}};
  await asUser(db,a);const own=await loadReadingProfileForOwner(client,a);
  assert.deepEqual(own.totals,{read:1209,rated:1205,wantToRead:8,reading:5});
  assert.equal(own.profile.ratingCount,1205);assert.equal(own.profile.classifiedCount,200);
  assert.ok(calls.some(c=>c.table==='ratings'&&c.range[0]===1000));
  assert.ok(calls.some(c=>c.table==='work_trait_evidence'&&c.range[0]===1000));
  assert.ok(calls.filter(c=>c.table==='ratings'||c.table==='user_book_status').every(c=>c.filters.some(f=>f.startsWith('user_id='))));
  await asUser(db,b);assert.deepEqual((await loadReadingProfileForOwner(client,b)).totals,{read:1,rated:1,wantToRead:0,reading:0});
  // Even a wrong owner argument cannot defeat the existing database RLS.
  assert.deepEqual((await loadReadingProfileForOwner(client,a)).totals,{read:0,rated:0,wantToRead:0,reading:0});
  await db.exec('reset role;set role anon');await assert.rejects(()=>loadReadingProfileForOwner(client,a),e=>e.code==='42501');
 }finally{await db.close();}
});
test('account route uses verified identity, private cache headers/noindex and no public sitemap',async()=>{
 const route=await readFile(new URL('../app/account/page.tsx',import.meta.url),'utf8');
 const proxy=await readFile(new URL('../proxy.ts',import.meta.url),'utf8');
 const sitemap=await readFile(new URL('../lib/seo/sitemap.ts',import.meta.url),'utf8');
 assert.match(route,/getVerifiedServerUser\(\)/);assert.match(route,/if\(!user\)redirect/);
 assert.match(route,/loadReadingProfileForOwner\(client,user\.id,locale\)/);assert.match(route,/email=\{user\.email\?\?null\}/);
 assert.match(route,/force-dynamic/);assert.match(route,/noIndex:true/);
 assert.match(proxy,/\['\/account', '\/login'/);assert.doesNotMatch(sitemap,/'\/account'/);
 assert.doesNotMatch(route,/searchParams|params:|unstable_cache|service_role/);
});
