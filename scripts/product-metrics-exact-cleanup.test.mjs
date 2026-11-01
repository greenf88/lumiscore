import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {exactCleanup} from '../test-support/product-metrics/exact-cleanup.mjs';
test('exact cleanup rejects changed rows before deletion, retains unrelated data and cron',async()=>{
 const db=new PGlite();try{
 const uid='b0000000-0000-4000-8000-000000000001';
 await db.exec(`create schema discovery_test_private;create table discovery_test_private.marker(identity text);insert into discovery_test_private.marker values('lumiscore-pr8-synthetic-v1');
 create schema auth;create table auth.users(id uuid primary key,email text,created_at timestamptz);create table auth.sessions(user_id uuid);create table auth.refresh_tokens(user_id text);create table auth.scim_users(user_id uuid);create table taste_test_responses(user_id uuid);
 create table taste_rating_offers(user_id uuid,work_id bigint);create table taste_rating_rounds(user_id uuid,id uuid);create table ratings(user_id uuid,work_id bigint,rating int);create table user_book_status(user_id uuid,work_id bigint,status text);create table user_reading_preferences(user_id uuid);
 insert into auth.users values('${uid}','own@example.test','2026-10-28Z');
 insert into ratings values('${uid}',1,8),('b0000000-0000-4000-8000-000000000099',2,7);
 create schema product_metrics_test;create table product_metrics_test.daily_counters(n int);create table product_metrics_test.receipts(n int);create table product_metrics_test.consent_grants(revoked_at timestamptz,expires_at timestamptz);create table product_metrics_test.budgets(n int);create table product_metrics_test.grant_budgets(n int);create table product_metrics_test.operational_counts(n int);
 insert into product_metrics_test.daily_counters values(1);create schema cron;create table cron.job(jobid int);insert into cron.job values(1);`);
 const p={project:'hlvujbrmfdlrfxdjwsmb',marker:1,own_account:(await db.query('select to_jsonb(t) v from auth.users t')).rows[0].v,sessions:0,refresh_tokens:0,active_grants:0,bad_contexts:0,
  provenance:'All selected metric rows are from the recorded PR51 isolated synthetic runs after the proven empty metric baseline; no other analysis writer used this test target.',business:{},metrics:{}};
 for(const [key,t] of Object.entries({offers:'taste_rating_offers',rounds:'taste_rating_rounds',ratings:'ratings',statuses:'user_book_status',preferences:'user_reading_preferences'}))p.business[key]=(await db.query(`select to_jsonb(t) v from ${t} t where user_id=$1`,[uid])).rows.map(x=>x.v);
 for(const t of ['daily_counters','receipts','consent_grants','budgets','grant_budgets','operational_counts'])p.metrics[t]=(await db.query(`select md5(to_jsonb(t)::text) h from product_metrics_test.${t} t order by h`)).rows.map(x=>x.h);
 await db.exec('update product_metrics_test.daily_counters set n=2');
 await assert.rejects(()=>db.exec(exactCleanup(p)),/METRIC_ROW_CHANGED/);await db.exec('rollback');
 assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from ratings')).rows[0].n,2);
 await db.exec('update product_metrics_test.daily_counters set n=1');await db.exec(exactCleanup(p));
 assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from ratings')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from product_metrics_test.daily_counters')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from cron.job')).rows[0].n,1);
 await assert.rejects(()=>db.exec(exactCleanup(p)),/EXACT_DISPOSABLE_ACCOUNT_REQUIRED/);await db.exec('rollback');
 assert.throws(()=>exactCleanup({...p,project:'qvplwejffhjvxaypmjut'}),/Exact reviewed test/);
 }finally{await db.close();}
});
