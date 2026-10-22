import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {fixture} from '../test-support/product-metrics/local-fixture.mjs';
test('test install metadata and guarded rollback preserve data; default rollback and changed body stop safely',async()=>{
 const db=new PGlite();const text=name=>readFile(new URL(`../test-support/product-metrics/${name}`,import.meta.url),'utf8');
 try{
  await db.exec(fixture);await db.exec(await text('install.sql'));
  const metadata=(await db.query(await text('verify-install.sql'))).rows[0].verification;
  assert.equal(metadata.test_marker,1);assert.equal(metadata.tables.length,3);assert.equal(metadata.functions.length,7);assert.equal(metadata.triggers.length,3);
  assert.ok(metadata.tables.every(t=>t.rls&&t.force_rls&&!t.anon_select&&!t.authenticated_select&&!t.anon_write&&!t.authenticated_write));
  assert.ok(metadata.functions.every(f=>f.settings.includes('search_path=""')));
  const actor='b0000000-0000-4000-8000-000000000101';
  await db.query('insert into public.ratings(user_id,work_id,rating) values($1,1,8)',[actor]);
  await db.exec("insert into product_metrics_test.daily_counters values(current_date,'page_opened','{}',1)");
  const rollback=await text('rollback.sql');
  await assert.rejects(()=>db.exec(rollback),/ABSENT_BASELINE_REVIEW_REQUIRED/);await db.exec('rollback');
  const armed=rollback.replace("set local lock_timeout='2s';","set local lock_timeout='2s';set local lumiscore.metrics.absent_baseline='confirmed';");
  await db.exec(armed); // Default ROLLBACK restores all three triggers.
  assert.equal((await db.query(await text('verify-install.sql'))).rows[0].verification.triggers.length,3);
  await db.exec(armed.replace(/rollback;\s*$/i,'commit;'));
  assert.equal((await db.query(await text('verify-install.sql'))).rows[0].verification.triggers.length,0);
  assert.equal((await db.query('select count(*)::int n from public.ratings')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from product_metrics_test.daily_counters')).rows[0].n,1);
  await db.exec(await text('install.sql'));
  assert.equal((await db.query('select count(*)::int n from product_metrics_test.daily_counters')).rows[0].n,1);
  await db.exec("create or replace function product_metrics_test.request_context() returns jsonb language sql set search_path='' as 'select null::jsonb'");
  await assert.rejects(()=>db.exec(armed),/FUNCTION_CHANGED/);await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int n from public.ratings')).rows[0].n,1);
 }finally{await db.close();}
});
