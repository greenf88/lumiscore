import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from '../test-support/product-metrics/local-fixture.mjs';
import {productionInstaller} from '../test-support/product-metrics/production-package.mjs';
import {leesroutesPatch} from '../test-support/product-metrics/leesroutes-package.mjs';
const definitionQuery=`select n.nspname,p.proname,p.prosrc,p.proconfig,p.prosecdef,p.proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='product_metrics' or(n.nspname='public' and p.proname like '%product%') order by 1,2`;

test('synthetic test-target package has independent guards, same narrow behavior and exact rollback',async()=>{
 const db=new PGlite();try{
  await db.exec(fixture);await db.exec(await readFile(new URL('../test-support/product-metrics/install.sql',import.meta.url),'utf8'));
  const query=definitionQuery.replace("n.nspname='product_metrics'","n.nspname='product_metrics_test'");
  const before=(await db.query(query)).rows;
  const patch=await leesroutesPatch(false,'test'),rollback=await leesroutesPatch(true,'test');
  const base=new URL('../supabase/operations/leesroutes-referral-20261113/',import.meta.url);
  assert.equal(await readFile(new URL('patch-test.sql',base),'utf8'),patch);assert.equal(await readFile(new URL('rollback-test.sql',base),'utf8'),rollback);
  await db.exec("set lumiscore.metrics.release_target='qvplwejffhjvxaypmjut'");await assert.rejects(()=>db.exec(patch),/WRONG_METRICS_TARGET/);await db.exec('rollback');
  await db.exec("set lumiscore.metrics.release_target='hlvujbrmfdlrfxdjwsmb'");await db.exec(patch);
  const c={locale:'nl',surface:'taste_test',source:'leesroutes',medium:'referral',campaign:'none',traffic:'synthetic'};
  const token=(await db.query("select public.product_analysis_consent_test_v3('accept') g")).rows[0].g.token;
  await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-lumiscore-analysis-grant':token})]);
  const emit=properties=>db.query('select public.record_product_event_test_v1($1,$2,$3) result',[crypto.randomUUID(),'referral_arrival',properties]);
  assert.equal((await emit(c)).rows[0].result,'counted');assert.equal((await emit({...c,traffic:'production'})).rows[0].result,'invalid_payload');
  await db.exec(rollback);assert.deepEqual((await db.query(query)).rows,before);
  assert.equal((await db.query('select count(*)::int n from product_metrics_test.daily_counters')).rows[0].n,1);
 }finally{await db.close();}
});

test('referral patch preserves consent, private storage, real-transition conversions and exact rollback',async()=>{
 const db=new PGlite();try{
  await db.exec(fixture);await db.exec('drop schema discovery_test_private cascade');await db.exec("set lumiscore.metrics.release_target='qvplwejffhjvxaypmjut'");await db.exec(await productionInstaller());
  const before=(await db.query(definitionQuery)).rows;
  const patch=await leesroutesPatch(),rollback=await leesroutesPatch(true);
  const base=new URL('../supabase/operations/leesroutes-referral-20261113/',import.meta.url);
  assert.equal(await readFile(new URL('patch.sql',base),'utf8'),patch);assert.equal(await readFile(new URL('rollback.sql',base),'utf8'),rollback);
  await db.exec("set lumiscore.metrics.release_target='wrong'");await assert.rejects(()=>db.exec(patch),/WRONG_METRICS_TARGET/);await db.exec('rollback');await db.exec("set lumiscore.metrics.release_target='qvplwejffhjvxaypmjut'");
  await db.exec(patch);const after=(await db.query(definitionQuery)).rows;
  assert.deepEqual(after.map(f=>({...f,prosrc:undefined})),before.map(f=>({...f,prosrc:undefined})));
  assert.equal(after.filter((f,i)=>f.prosrc!==before[i].prosrc).length,3);
  await assert.rejects(()=>db.exec(patch),/UNEXPECTED_METRICS_BASELINE/);await db.exec('rollback');
  const user='b0000000-0000-4000-8000-000000000001',c={locale:'nl',surface:'taste_test',source:'leesroutes',medium:'referral',campaign:'none',traffic:'production'};
  const headers=(token,extra={})=>db.query("select set_config('request.headers',$1,false),set_config('request.jwt.claim.sub',$2,false)",[JSON.stringify({'x-lumiscore-product-context':JSON.stringify(c),...(token?{'x-lumiscore-analysis-grant':token}:{}),...extra}),user]);
  const emit=properties=>db.query('select public.record_product_event_v1($1,$2,$3) result',[crypto.randomUUID(),'referral_arrival',properties]);
  await headers(null);assert.equal((await emit(c)).rows[0].result,'consent_denied');
  const token=(await db.query("select public.product_analysis_consent_v3('accept') g")).rows[0].g.token;await headers(token);
  assert.equal((await emit(c)).rows[0].result,'counted');
  for(const p of [{...c,url:'https://private.invalid/'},{...c,source:'google',medium:'organic_search'},{...c,traffic:'synthetic'},{...c,source:'leesroutes.nl'},{...c,email:'PRIVATE'}])assert.equal((await emit(p)).rows[0].result,'invalid_payload');
  for(const privacy of [{dnt:'1'},{'sec-gpc':'1'}]){await headers(token,privacy);assert.equal((await emit(c)).rows[0].result,'consent_denied');}
  await headers(token);await db.exec('set role authenticated');
  await assert.rejects(()=>db.query('select * from product_metrics.daily_counters'),/permission denied/);
  await assert.rejects(()=>db.query('select public.record_product_event_v1($1,$2,$3)',[crypto.randomUUID(),'want_to_read_saved',{...c,work_id:10250}]),/browser event required/);
  await db.query('insert into user_book_status(user_id,work_id,status) values($1,10250,$2)',[user,'want_to_read']);
  const round=crypto.randomUUID();await db.query('insert into taste_rating_rounds(id,user_id,goal) values($1,$2,10)',[round,user]);await db.query('update taste_rating_rounds set completed_at=now() where id=$1',[round]);
  await db.exec('reset role');
  const rows=(await db.query('select event,n,dimensions from product_metrics.daily_counters order by event')).rows;
  assert.deepEqual(rows.map(r=>r.event),['referral_arrival','taste_round_completed','taste_round_started','want_to_read_saved']);assert.ok(rows.every(r=>r.n===1&&r.dimensions.source==='leesroutes'));
  assert.doesNotMatch(JSON.stringify(rows),/PRIVATE|https:|user_id|session_id|token/);
  await db.query("select public.product_analysis_consent_v3('revoke',$1)",[token]);assert.equal((await emit(c)).rows[0].result,'consent_denied');
  await db.exec(rollback);assert.deepEqual((await db.query(definitionQuery)).rows,before);
  assert.equal((await db.query('select count(*)::int n from product_metrics.daily_counters')).rows[0].n,4);
  assert.equal((await db.query('select count(*)::int n from user_book_status')).rows[0].n,1);
 }finally{await db.close();}
});
