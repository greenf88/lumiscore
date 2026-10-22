import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {fixture} from '../test-support/product-metrics/local-fixture.mjs';
const actor='b0000000-0000-4000-8000-000000000001';
const context={locale:'nl',surface:'taste_test',source:'facebook',medium:'organic_social',campaign:'dystopie_202610',traffic:'synthetic'};
test('actual SQL: canonical transitions, no-op retries, failed writes, receipt dedup, private counters and fail-open metrics',async()=>{
 const db=new PGlite();try{
  await db.exec(fixture);const install=await readFile(new URL('../test-support/product-metrics/install.sql',import.meta.url),'utf8');
  await db.exec(install);await db.exec(install); // Same installation is idempotent.
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false),set_config('request.headers',$3,false)",[actor,JSON.stringify({sub:actor,session_id:'b0000000-0000-4000-8000-000000000002'}),JSON.stringify({'x-lumiscore-product-context':JSON.stringify(context)})]);
  const event=(id,event='page_opened',properties=context)=>({event_id:id,event,properties});
  const browser=async e=>(await db.query('select public.record_product_events_test_v1($1) as result',[e])).rows[0].result;
  await db.exec('set role anon');
  const first=event('b0000000-0000-4000-8000-000000000003');
  assert.deepEqual(await browser([first,first]),['counted','duplicate']);
  await assert.rejects(()=>db.query('select * from product_metrics_test.daily_counters'),/permission denied/);
  await assert.rejects(()=>browser([event('b0000000-0000-4000-8000-000000000004','rating_saved',{...context,work_id:1,operation:'new'})]),/browser event required/);
  await assert.rejects(()=>browser([event('b0000000-0000-4000-8000-000000000004','page_opened',{...context,email:'denied'})]),/denied property/);
  await assert.rejects(()=>db.query('select public.record_product_sign_in_test_v1($1)',[context]),/permission denied/);
  await db.exec('reset role;set role authenticated');
  const signin=async()=>(await db.query('select public.record_product_sign_in_test_v1($1) as result',[{...context,surface:'login'}])).rows[0].result;
  assert.equal(await signin(),'counted');assert.equal(await signin(),'duplicate');
  await db.query('insert into public.ratings(user_id,work_id,rating) values($1,1,8)',[actor]);
  await db.query('insert into public.ratings(user_id,work_id,rating) values($1,1,8) on conflict(user_id,work_id) do update set rating=excluded.rating',[actor]);
  await db.query('update public.ratings set rating=9 where user_id=$1 and work_id=1',[actor]);
  await assert.rejects(()=>db.query('insert into public.ratings(user_id,work_id,rating) values($1,2,99)',[actor]),/check constraint/);
  const round='b0000000-0000-4000-8000-000000000005';
  await db.query('insert into public.taste_rating_rounds(id,user_id,goal) values($1,$2,10)',[round,actor]);
  await db.query('update public.taste_rating_rounds set completed_at=now() where id=$1',[round]);
  await db.query('update public.taste_rating_rounds set completed_at=now() where id=$1',[round]);
  await db.query('update public.taste_rating_rounds set completed_at=null where id=$1',[round]);
  await db.query('update public.taste_rating_rounds set completed_at=now() where id=$1',[round]);
  await db.query("insert into public.user_book_status values($1,2,'want_to_read')",[actor]);
  await db.query("update public.user_book_status set status='want_to_read' where user_id=$1",[actor]);
  await db.exec('reset role');
  const counts=(await db.query('select event,dimensions,n::int as n from product_metrics_test.daily_counters')).rows;
  const total=e=>counts.filter(x=>x.event===e).reduce((n,x)=>n+x.n,0);
  assert.equal(total('page_opened'),1);assert.equal(total('sign_in_succeeded'),1);assert.equal(total('taste_round_started'),1);assert.equal(total('taste_round_completed'),1);assert.equal(total('rating_saved'),2);assert.equal(total('want_to_read_saved'),1);
  assert.deepEqual(counts.filter(x=>x.event==='rating_saved').map(x=>x.dimensions.operation).sort(),['new','updated']);
  assert.ok(counts.every(x=>x.dimensions.traffic==='synthetic'&&!('user_id' in x.dimensions)&&!('score' in x.dimensions)));
  // A broken counter write is swallowed by the AFTER trigger, not by the app mutation.
  await db.exec('alter table product_metrics_test.daily_counters add constraint simulate_outage check(false) not valid;set role authenticated');
  await db.query('insert into public.ratings(user_id,work_id,rating) values($1,3,7)',[actor]);
  assert.equal((await db.query('select rating from public.ratings where user_id=$1 and work_id=3',[actor])).rows[0].rating,7);
  await db.exec('reset role;alter table product_metrics_test.daily_counters drop constraint simulate_outage');
  // Missing context / privacy signals collect nothing while preserving the real rating.
  await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'dnt':'1','x-lumiscore-product-context':JSON.stringify(context)})]);
  await db.exec('set role authenticated');await db.query('insert into public.ratings(user_id,work_id,rating) values($1,4,6)',[actor]);
  await db.exec('reset role');assert.equal((await db.query("select sum(n)::int n from product_metrics_test.daily_counters where event='rating_saved'")).rows[0].n,2);
  await db.exec('update product_metrics_test.budgets set n=120;set role anon');
  assert.deepEqual(await browser([event('b0000000-0000-4000-8000-000000000009')]),['rate_limited']);
 }finally{await db.close();}
});
