import test from 'node:test';
import assert from 'node:assert/strict';
import {localMetrics} from '../test-support/product-metrics/local-v3.mjs';
import {contributionCleanup} from '../test-support/product-metrics/contribution-cleanup.mjs';
const manifest=rows=>({project:'hlvujbrmfdlrfxdjwsmb',run:'pr51-acceptance-20261101-v2',rows});
test('cleanup subtracts only own contribution from a shared cell; preserves other rows, business and scheduler; replay is safe',async()=>{
 const db=await localMetrics();try{
  await db.exec("insert into product_metrics_test.daily_counters values('2026-11-01','page_opened','{\"locale\":\"nl\",\"traffic\":\"synthetic\"}',5,'2027-01-30');create schema cron;create table cron.job(n int);insert into cron.job values(1)");
  const before=(await db.query('select to_jsonb(t) v from product_metrics_test.daily_counters t')).rows[0].v;
  await db.exec('update product_metrics_test.daily_counters set n=n+2');
  const after=(await db.query('select to_jsonb(t) v from product_metrics_test.daily_counters t')).rows[0].v;
  const row={table:'daily_counters',key:{day:after.day,event:after.event,dimensions:after.dimensions},before,after,delta:2};
  const sql=contributionCleanup(manifest([row]));await db.exec(sql);await db.exec(sql);
  assert.deepEqual((await db.query('select to_jsonb(t) v from product_metrics_test.daily_counters t')).rows[0].v,before);
  assert.equal((await db.query('select n from cron.job')).rows[0].n,1);
  await db.exec('update product_metrics_test.daily_counters set n=8');
  await assert.rejects(()=>db.exec(sql),/LATER_OR_SHARED_CHANGE_STOP/);await db.exec('rollback');
  assert.equal((await db.query('select n::int n from product_metrics_test.daily_counters')).rows[0].n,8);
 }finally{await db.close();}
});
test('cleanup refuses unproven deltas, production, duplicate keys and changed shared identities',()=>{
 const before={day:'2026-11-01',event:'page_opened',dimensions:{locale:'nl'},n:5,expires_at:'2027-01-30'},after={...before,n:7};
 const row={table:'daily_counters',key:{day:after.day,event:after.event,dimensions:after.dimensions},before,after,delta:2};
 assert.throws(()=>contributionCleanup({...manifest([row]),project:'qvplwejffhjvxaypmjut'}),/test contribution/);
 assert.throws(()=>contributionCleanup(manifest([{...row,delta:7}])),/own contribution/);
 assert.throws(()=>contributionCleanup(manifest([row,row])),/Duplicate/);
 assert.throws(()=>contributionCleanup(manifest([{...row,before:{...before,expires_at:'2027-02-01'}}])),/identity/);
 assert.throws(()=>contributionCleanup(manifest([{...row,before:{...before,dimensions:{locale:'en'}}}])),/identity/);
 assert.throws(()=>contributionCleanup(manifest([{...row,table:'ratings'}])),/supported/);
});
