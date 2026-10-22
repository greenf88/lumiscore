import test from 'node:test';
import assert from 'node:assert/strict';
import {actor,localMetrics,grant,headers,browser,event,clock,text} from '../test-support/product-metrics/local-v3.mjs';

test('explicit ACLs, idempotent install and guarded rollback preserve source and retained metrics',async()=>{
 const db=await localMetrics();try{
  const m=(await db.query(await text('verify-install.sql'))).rows[0].verification;
  assert.equal(m.tables.length,7);assert.equal(m.functions.length,13);assert.equal(m.triggers.length,3);
  assert.ok(m.tables.every(t=>t.rls&&t.force_rls&&!t.anon_select&&!t.authenticated_select&&!t.anon_write&&!t.authenticated_write));
  assert.ok(m.functions.every(f=>f.settings.includes('search_path=""')));
  assert.ok(m.functions.filter(f=>['cleanup','current_time','operational','request_grant','request_context','observe_transition'].includes(f.name)).every(f=>!f.anon_execute&&!f.authenticated_execute));
  await db.query('insert into public.ratings(user_id,work_id,rating) values($1,1,8)',[actor]);
  await headers(db,await grant(db));assert.deepEqual(await browser(db,event()),['counted']);
  const rollback=await text('rollback.sql');await assert.rejects(()=>db.exec(rollback),/ABSENT_BASELINE_REVIEW_REQUIRED/);await db.exec('rollback');
  const armed=rollback.replace("set local lock_timeout='2s';","set local lock_timeout='2s';set local lumiscore.metrics.absent_baseline='confirmed';");
  await db.exec(armed);assert.equal((await db.query(await text('verify-install.sql'))).rows[0].verification.triggers.length,3);
  await db.exec(armed.replace(/rollback;\s*$/i,'commit;'));assert.equal((await db.query(await text('verify-install.sql'))).rows[0].verification.triggers.length,0);
  assert.equal((await db.query('select count(*)::int n from public.ratings')).rows[0].n,1);assert.equal((await db.query('select count(*)::int n from product_metrics_test.daily_counters')).rows[0].n,1);
  await db.exec(await text('install.sql'));await db.exec("create or replace function product_metrics_test.request_context() returns jsonb language sql set search_path='' as 'select null::jsonb'");
  await assert.rejects(()=>db.exec(armed),/FUNCTION_CHANGED/);await db.exec('rollback');
 }finally{await db.close();}
});

test('UTC expiry boundaries, bounded independent cleanup, failures and scheduler conflict safety',async()=>{
 const db=await localMetrics();try{
  await clock(db,'2026-10-22T12:00:00Z');await db.query('insert into public.ratings(user_id,work_id,rating) values($1,1,8)',[actor]);
  for(const delta of [-1,0,1,2,3])await db.query("insert into product_metrics_test.receipts values($1,'2026-10-22T11:00:00Z','2026-10-22T12:00:00Z'::timestamptz+$2*interval '1 millisecond')",[crypto.randomUUID(),delta]);
  const clean=async(at=null,n=1)=>(await db.query('select product_metrics_test.cleanup($1,$2) r',[at,n])).rows[0].r;
  assert.equal((await clean()).status,'ok');assert.equal((await db.query('select count(*)::int n from product_metrics_test.receipts')).rows[0].n,4);
  assert.equal((await db.query('select backlog from product_metrics_test.maintenance_state')).rows[0].backlog,true);
  await clean();assert.equal((await db.query('select count(*)::int n from product_metrics_test.receipts')).rows[0].n,3);
  // UTC day bucket expires at START of day+90d, not an inclusive91st date.
  await db.exec("insert into product_metrics_test.daily_counters values('2026-07-24','page_opened','{}',1,'2026-10-22T00:00:00Z')");
  await clean('2026-10-21T23:59:59.999Z');assert.equal((await db.query('select count(*)::int n from product_metrics_test.daily_counters')).rows[0].n,1);
  await clean('2026-10-22T02:00:00+02:00');assert.equal((await db.query('select count(*)::int n from product_metrics_test.daily_counters')).rows[0].n,0);
  await clean();assert.equal((await db.query('select count(*)::int n from product_metrics_test.receipts')).rows[0].n,3);
  await db.exec('alter table product_metrics_test.receipts rename column expires_at to broken');assert.equal((await clean()).status,'failed');
  assert.equal((await db.query('select last_error_code from product_metrics_test.maintenance_state')).rows[0].last_error_code,'42703');
  await db.exec('alter table product_metrics_test.receipts rename column broken to expires_at');
  for(let n=0;n<4;n++)await clean('2026-10-22T14:00:00.003+02:00');
  assert.equal((await db.query('select count(*)::int n from product_metrics_test.receipts')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from public.ratings')).rows[0].n,1);
  await db.exec('set role anon');await assert.rejects(()=>clean(),/permission denied/);await db.exec('reset role');
  // Local pg_cron fixture verifies installation/command, not an actual hosted scheduler daemon.
  await db.exec(`create schema cron;create table cron.job(jobid bigint generated always as identity,jobname text,schedule text,command text,username text,database text,active bool);
   create table cron.job_run_details(runid bigint,jobid bigint,end_time timestamptz);
   create function cron.schedule(text,text,text) returns bigint language sql as $$insert into cron.job(jobname,schedule,command,username,database,active) values($1,$2,$3,current_user,current_database(),true) returning jobid$$;`);
  const scheduler=(await text('scheduler-test.sql')).replace(/create extension if not exists pg_cron;/i,'-- Local cron fixture.');
  await db.exec(scheduler);await db.exec(scheduler);assert.equal((await db.query('select count(*)::int n from cron.job')).rows[0].n,1);
  const job=(await db.query('select * from cron.job')).rows[0];assert.equal(job.schedule,'*/5 * * * *');await db.exec(job.command);assert.equal((await db.query('select last_error_code from product_metrics_test.maintenance_state')).rows[0].last_error_code,null);
  await db.exec("update cron.job set command='select 1'");await assert.rejects(()=>db.exec(scheduler),/UNEXPECTED_EXISTING_METRICS_JOB/);await db.exec('rollback');
 }finally{await db.close();}
});

test('shared project capacity across clients/logical instances, local burst limits, dedup and expiry',async()=>{
 const db=await localMetrics();try{
  await clock(db,'2026-10-22T12:00:00Z');const tokens=[];for(let i=0;i<26;i++)tokens.push(await grant(db));
  const first=event();const route=async(token,seed=false)=>db.transaction(async tx=>{await headers(tx,token,undefined,{},true);const input=Array.from({length:28},(_,i)=>seed&&i===0?first:event());const out=[];for(let i=0;i<28;i+=10)out.push(...await browser(tx,input.slice(i,i+10)));return out;});
  // Two logical application instances share SQL budgets; PGlite serializes DB transactions.
  const a=await Promise.all(tokens.slice(0,10).map((t,i)=>route(t,i===0))),b=await Promise.all(tokens.slice(10,20).map(t=>route(t)));
  assert.equal([...a,...b].flat().filter(x=>x==='counted').length,560);
  await headers(db,tokens[20]);for(let i=0;i<4;i++)assert.ok((await browser(db,Array.from({length:10},()=>event()))).every(x=>x==='counted'));
  assert.deepEqual(await browser(db,event()),['project_rate_limited']);assert.deepEqual(await browser(db,first),['duplicate']);
  assert.equal((await db.query('select count(*)::int n from product_metrics_test.receipts')).rows[0].n,600);
  await clock(db,'2026-10-22T12:01:00Z');await headers(db,tokens[21]);for(let i=0;i<6;i++)await browser(db,Array.from({length:10},()=>event()));
  assert.deepEqual(await browser(db,event()),['grant_rate_limited']);await headers(db,tokens[22]);assert.deepEqual(await browser(db,event()),['counted']);
  await clock(db,'2026-10-22T12:30:00Z');assert.deepEqual(await browser(db,event()),['consent_denied']);
  assert.equal((await db.query('select count(*)::int n from product_metrics_test.receipts')).rows[0].n,661);
  const health=(await db.query('select reason,sum(n)::int n from product_metrics_test.operational_counts group by reason')).rows;
  assert.ok(health.some(x=>x.reason==='project_rate_limited'&&x.n===1));assert.ok(health.some(x=>x.reason==='grant_rate_limited'&&x.n===1));
  await clock(db,'2026-10-22T12:31:00Z');for(let i=0;i<60;i++)assert.ok(await grant(db));assert.equal(await grant(db),undefined);
 }finally{await db.close();}
});
