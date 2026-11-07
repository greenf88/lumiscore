// Local proposal verification only. No connection string or hosted route.
import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs/promises';import{PGlite}from'@electric-sql/pglite';
test('review-only revision ledger preserves dates and guards CAS, chronology, rights and restore',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role;create table public.works(id bigint primary key);insert into public.works values(1),(2);create table public.ratings(work_id bigint,rating int);insert into public.ratings values(2,8);');
 await db.exec(await fs.readFile(new URL('../docs/proposals/book-lastmod-ledger.sql.proposal',import.meta.url),'utf8'));
 const a='a'.repeat(64),b='b'.repeat(64),call=(expected,hash,date)=>db.query('select public.record_catalog_public_revision(1,\'nl\',$1,$2,$3) changed',[expected,hash,date]);
 assert.equal((await call(null,a,'2026-11-01T10:00:00Z')).rows[0].changed,true);
 assert.equal((await call(a,a,'2026-11-02T10:00:00Z')).rows[0].changed,false);
 assert.equal((await db.query('select content_changed_at::text from public.catalog_public_page_revisions')).rows[0].content_changed_at,'2026-11-01 10:00:00+00');
 await assert.rejects(call(b,b,'2026-11-03T10:00:00Z'),/changed since manifest/);
 await assert.rejects(call(a,b,'2026-10-30T10:00:00Z'),/chronology/);
 await assert.rejects(db.query('select public.record_catalog_public_revision(99,\'nl\',null,$1,\'2026-11-01\')',[a]),/foreign key/);
 const rights=await db.query("select has_table_privilege('anon','public.catalog_public_page_revisions','SELECT') r,has_table_privilege('authenticated','public.catalog_public_page_revisions','UPDATE') w,has_function_privilege('anon','public.record_catalog_public_revision(bigint,text,text,text,timestamptz)','EXECUTE') e,has_function_privilege('service_role','public.record_catalog_public_revision(bigint,text,text,text,timestamptz)','EXECUTE') s");assert.deepEqual(rights.rows[0],{r:true,w:false,e:false,s:true});
 assert.deepEqual((await db.query('select * from public.ratings')).rows,[{work_id:2,rating:8}]);
 const restore=await fs.readFile(new URL('../docs/proposals/book-lastmod-restore.sql.proposal',import.meta.url),'utf8');await assert.rejects(db.exec(restore),/nonempty/);await db.exec('rollback');
 assert.equal((await db.query('select count(*)::int n from public.catalog_public_page_revisions')).rows[0].n,1);
 await db.exec('delete from public.catalog_public_page_revisions');await db.exec(restore);
 assert.equal((await db.query('select count(*)::int n from public.works')).rows[0].n,2);
 }finally{await db.close();}
});
