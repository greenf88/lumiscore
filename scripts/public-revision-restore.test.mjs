import test from 'node:test';import assert from 'node:assert/strict';import {PGlite}from'@electric-sql/pglite';import fs from'node:fs/promises';
const read=f=>fs.readFile(new URL('../'+f,import.meta.url),'utf8');
test('publisher committed schema restore preserves PR92 ledger and rejects later schema/evidence',async()=>{
 const db=new PGlite();try{
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create table works(id bigint primary key);insert into works values(1);create schema cron;create table cron.job(command text)");
 const original=await read('supabase/migrations/20261108210128_reviewed_public_revision_publisher.sql');
 await db.exec(await read('supabase/migrations/20261108121441_public_page_revision_ledger.sql'));await db.exec(original);
 await db.exec("select record_catalog_public_revision(1,'en',null,repeat('a',64),'2026-11-01',repeat('b',64))");
 let restore=await read('docs/publisher-20261108/restore-schema.sql');
 const shape=await db.query("select md5(jsonb_build_object(\n'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='public.catalog_public_revision_events'::regclass and a.attnum>0 and not a.attisdropped),\n'constraints',(select jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid)) order by conname) from pg_constraint where conrelid='public.catalog_public_revision_events'::regclass),\n'indexes',(select jsonb_agg(pg_get_indexdef(indexrelid) order by indexrelid::regclass::text) from pg_index where indrelid='public.catalog_public_revision_events'::regclass),\n'security',(select jsonb_build_array(relrowsecurity,relforcerowsecurity,relacl::text,pg_get_userbyid(relowner)) from pg_class where oid='public.catalog_public_revision_events'::regclass))::text) schema_md5;");
 restore=restore.replace('369c7440e29624df96700050679b71bc',shape.rows[0].schema_md5);
 const fns=await db.query("select proname,md5(pg_get_functiondef(p.oid)) hash from pg_proc p where proname in('enqueue_catalog_public_revision','publish_catalog_public_revisions')");
 for(const f of fns.rows)restore=restore.replace(f.proname==='enqueue_catalog_public_revision'?'a5e9d19da5361bc54a91d18e9298ed3c':'ff4771a57a55912034912bbec337175e',f.hash);
 await db.exec(restore);assert.equal((await db.query("select to_regclass('public.catalog_public_revision_events') t")).rows[0].t,null);
 assert.equal((await db.query('select count(*)::int n from catalog_public_page_revisions')).rows[0].n,1);
 await db.exec(original);
 await db.exec('alter table catalog_public_revision_events add column later_added text');
 await assert.rejects(db.exec(restore),/schema\/rights changed/);await db.exec('rollback');
 await db.exec('alter table catalog_public_revision_events drop column later_added');
 await db.exec("select enqueue_catalog_public_revision(1,'nl',null,repeat('c',64),'2026-11-02',repeat('d',64))");
 await assert.rejects(db.exec(restore),/evidence nonempty/);await db.exec('rollback');
 assert.equal((await db.query('select count(*)::int n from catalog_public_revision_events')).rows[0].n,1);
 }finally{await db.close();}
});

