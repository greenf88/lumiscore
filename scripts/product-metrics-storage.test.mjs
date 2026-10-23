import test from 'node:test';
import assert from 'node:assert/strict';
import {actor,context,localMetrics,grant,headers,browser,event} from '../test-support/product-metrics/local-v3.mjs';

test('v3 real SQL gates browser and canonical triggers, revokes delayed requests, deduplicates, isolates rating failures',async()=>{
 const db=await localMetrics();try{
  await headers(db,null);await db.exec('set role authenticated');
  await db.query('insert into public.ratings(user_id,work_id,rating) values($1,1,8)',[actor]);
  await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from product_metrics_test.daily_counters')).rows[0].n,0);
  assert.deepEqual(await browser(db,event()),['consent_denied']);
  const token=await grant(db);assert.ok(token);await headers(db,token);
  await db.exec('set role anon');const first=event();assert.deepEqual(await browser(db,[first,first]),['counted','duplicate']);
  await assert.rejects(()=>db.query('select * from product_metrics_test.daily_counters'),/permission denied/);
  await assert.rejects(()=>browser(db,event(undefined,'rating_saved',{...context,work_id:2,operation:'new'})),/browser event required/);
  assert.deepEqual(await browser(db,event(undefined,'page_opened',{...context,email:'not-allowed'})),['invalid_payload']);
  await assert.rejects(()=>db.query('select public.record_product_sign_in_test_v1($1)',[context]),/permission denied/);
  await db.exec('reset role;set role authenticated');
  const signin=async()=>(await db.query('select public.record_product_sign_in_test_v1($1) r',[{...context,surface:'login'}])).rows[0].r;
  assert.equal(await signin(),'counted');assert.equal(await signin(),'duplicate');
  await db.query('insert into public.ratings(user_id,work_id,rating) values($1,2,8)',[actor]);
  await db.query('insert into public.ratings(user_id,work_id,rating) values($1,2,8) on conflict(user_id,work_id) do update set rating=excluded.rating',[actor]);
  await db.query('update public.ratings set rating=9 where user_id=$1 and work_id=2',[actor]);
  await assert.rejects(()=>db.query('insert into public.ratings(user_id,work_id,rating) values($1,3,99)',[actor]),/check constraint/);
  const round=crypto.randomUUID();await db.query('insert into public.taste_rating_rounds(id,user_id,goal) values($1,$2,10)',[round,actor]);
  await db.query('update public.taste_rating_rounds set completed_at=now() where id=$1',[round]);
  await db.query('update public.taste_rating_rounds set completed_at=null where id=$1',[round]);
  await db.query('update public.taste_rating_rounds set completed_at=now() where id=$1',[round]);
  await db.exec('reset role');
  const counts=(await db.query('select event,dimensions,n::int n from product_metrics_test.daily_counters')).rows;
  const total=e=>counts.filter(x=>x.event===e).reduce((n,x)=>n+x.n,0);
  assert.equal(total('rating_saved'),2);assert.equal(total('taste_round_started'),1);assert.equal(total('taste_round_completed'),1);assert.equal(total('sign_in_succeeded'),1);
  assert.deepEqual(counts.filter(x=>x.event==='rating_saved').map(x=>x.dimensions.operation).sort(),['new','updated']);
  assert.ok(counts.every(x=>!('user_id' in x.dimensions)&&!('score' in x.dimensions)&&!('token' in x.dimensions)));
  await db.exec('alter table product_metrics_test.daily_counters add constraint simulate_outage check(false) not valid;set role authenticated');
  await db.query('insert into public.ratings(user_id,work_id,rating) values($1,4,7)',[actor]);
  assert.equal((await db.query('select rating from public.ratings where work_id=4')).rows[0].rating,7);
  await db.exec('reset role;alter table product_metrics_test.daily_counters drop constraint simulate_outage');
  assert.equal((await db.query("select sum(n)::int n from product_metrics_test.operational_counts where reason='storage_error'")).rows[0].n,1);
  assert.equal((await db.query("select public.product_analysis_consent_test_v3('revoke',$1) r",[token])).rows[0].r.revoked,true);
  assert.deepEqual(await browser(db,event()),['consent_denied']); // Captured old in-flight authorization is rechecked.
  await db.exec('set role authenticated');await db.query('insert into public.ratings(user_id,work_id,rating) values($1,5,6)',[actor]);await db.exec('reset role');
  assert.equal((await db.query("select sum(n)::int n from product_metrics_test.daily_counters where event='rating_saved'")).rows[0].n,2);
  await headers(db,await grant(db),context,{dnt:'1'});assert.deepEqual(await browser(db,event()),['consent_denied']);
 }finally{await db.close();}
});
