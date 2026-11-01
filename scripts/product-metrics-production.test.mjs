import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from '../test-support/product-metrics/local-fixture.mjs';
import {productionInstaller,productionScheduler,productionRollback,productionNames} from '../test-support/product-metrics/production-package.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const read=n=>readFile(new URL('../test-support/product-metrics/'+n,import.meta.url),'utf8');
export async function productionLocal(){const db=new PGlite();await db.exec(fixture);await db.exec('drop schema discovery_test_private cascade');await db.exec("set lumiscore.metrics.release_target='qvplwejffhjvxaypmjut'");await db.exec(await productionInstaller());return db;}
export const functionQuery=`select n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')' signature,md5(p.prosrc) body_md5,p.prosrc,p.proconfig settings,p.prosecdef definer,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='product_metrics' or(n.nspname='public' and p.proname in('record_product_event_v1','record_product_events_v1','record_product_sign_in_v1','product_analysis_consent_v3')) order by 1`;
test('production proposal is the reviewed test logic with only isolated namespace and traffic changes',async()=>{
 const db=await productionLocal(),testDb=new PGlite();try{
  await testDb.exec(fixture);await testDb.exec(await read('install.sql'));
  const prod=(await db.query(functionQuery)).rows;
  const original=(await testDb.query(functionQuery.replaceAll("'product_metrics'","'product_metrics_test'").replaceAll("'record_product_event_v1'","'record_product_event_test_v1'").replaceAll("'record_product_events_v1'","'record_product_events_test_v1'").replaceAll("'record_product_sign_in_v1'","'record_product_sign_in_test_v1'").replaceAll("'product_analysis_consent_v3'","'product_analysis_consent_test_v3'"))).rows;
  assert.equal(prod.length,13);assert.equal(original.length,13);
  for(const f of original)assert.equal(prod.find(p=>p.signature===productionNames(f.signature))?.prosrc,productionNames(f.prosrc));
  const installer=await productionInstaller();
  await assert.rejects(()=>db.exec(installer),/EXISTING_METRICS_STOP/);await db.exec('rollback');
  assert.equal((await db.query("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='product_metrics' and relkind='r' and relrowsecurity and relforcerowsecurity")).rows[0].n,7);
  for(const f of prod){assert.ok(f.settings.includes('search_path=""'));assert.equal((await db.query('select has_function_privilege(\'service_role\',$1,\'EXECUTE\') allowed',[f.signature])).rows[0].allowed,false);}
  for(const role of ['anon','authenticated']){await db.exec(`set role ${role};`);await assert.rejects(()=>db.query('select * from product_metrics.daily_counters'),/permission denied/);await db.exec('reset role');}
 }finally{await db.close();await testDb.close();}
});
test('production consent, real write observer, traffic separation, dedup and disable retain business data',async()=>{
 const db=await productionLocal();try{
  const user='b0000000-0000-4000-8000-000000000001';
  const c={locale:'nl',surface:'book_detail',source:'facebook',medium:'organic_social',campaign:'dystopie_202610',traffic:'production'};
  const setHeaders=token=>db.query("select set_config('request.headers',$1,false),set_config('request.jwt.claim.sub',$2,false)",[JSON.stringify({'x-lumiscore-product-context':JSON.stringify(c),...(token?{'x-lumiscore-analysis-grant':token}:{})}),user]);
  await setHeaders(null);await db.query('insert into ratings(user_id,work_id,rating) values($1,1,8)',[user]);
  assert.equal((await db.query('select count(*)::int n from product_metrics.daily_counters')).rows[0].n,0);
  const token=(await db.query("select public.product_analysis_consent_v3('accept') g")).rows[0].g.token;await setHeaders(token);
  await db.query('update ratings set rating=9 where user_id=$1',[user]);
  assert.equal((await db.query("select sum(n)::int n from product_metrics.daily_counters where event='rating_saved' and dimensions->>'operation'='updated' and dimensions->>'traffic'='production'")).rows[0].n,1);
  const e={event_id:crypto.randomUUID(),event:'book_detail_opened',properties:{...c,work_id:1}};
  assert.deepEqual((await db.query('select public.record_product_events_v1($1) r',[[e,e]])).rows[0].r,['counted','duplicate']);
  assert.deepEqual((await db.query('select public.record_product_events_v1($1) r',[[{...e,event_id:crypto.randomUUID(),properties:{...e.properties,traffic:'synthetic'}}]])).rows[0].r,['invalid_payload']);
  await db.query("select public.product_analysis_consent_v3('revoke',$1)",[token]);await db.query('update ratings set rating=7 where user_id=$1',[user]);
  assert.equal((await db.query('select sum(n)::int n from product_metrics.daily_counters')).rows[0].n,2);
  const functions=(await db.query(functionQuery)).rows;
  await db.exec("set lumiscore.metrics.absent_baseline='confirmed'");
  await db.exec(productionRollback(functions).replace(/rollback;\s*$/i,'commit;'));
  assert.equal((await db.query('select count(*)::int n from ratings')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from product_metrics.daily_counters')).rows[0].n,2);
  assert.equal((await db.query("select count(*)::int n from pg_trigger where not tgisinternal and tgname like 'product_metric%'")).rows[0].n,0);
 }finally{await db.close();}
});
test('production cron is unique, guarded and retains five-minute schedule',async()=>{
 const db=await productionLocal();try{
  await db.exec(`create schema cron;create table cron.job(jobid bigint generated always as identity,jobname text,schedule text,command text,username text,database text,active bool);
   create function cron.schedule(text,text,text) returns bigint language sql as $$insert into cron.job(jobname,schedule,command,username,database,active) values($1,$2,$3,current_user,current_database(),true) returning jobid$$;`);
  const sql=(await productionScheduler()).replace('create extension if not exists pg_cron;','-- local fixture only');
  await db.exec(sql);await db.exec(sql);
  const jobs=(await db.query('select * from cron.job')).rows;assert.equal(jobs.length,1);assert.equal(jobs[0].schedule,'*/5 * * * *');
  assert.equal(jobs[0].command,"SET statement_timeout='3s'; SELECT product_metrics.cleanup();");
  await db.exec("update cron.job set schedule='* * * * *'");await assert.rejects(()=>db.exec(sql),/UNEXPECTED_EXISTING_METRICS_JOB/);await db.exec('rollback');
 }finally{await db.close();}
});
test('committed production SQL bytes, generated proposal and manifest are identical',async()=>{
 const path=new URL('../supabase/operations/pr51-product-metrics/',import.meta.url);
 const manifest=JSON.parse(await readFile(new URL('package-manifest.json',path),'utf8'));
 for(const [name,hash] of Object.entries(manifest.hashes))assert.equal(createHash('sha256').update(await readFile(new URL(name,path))).digest('hex'),hash,name);
 assert.equal(await readFile(new URL('install.sql',path),'utf8'),await productionInstaller());
 assert.equal(await readFile(new URL('scheduler.sql',path),'utf8'),await productionScheduler());
 const db=await productionLocal();try{
  assert.equal(await readFile(new URL('rollback.sql',path),'utf8'),productionRollback((await db.query(functionQuery)).rows));
 }finally{await db.close();}
});
