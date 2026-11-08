import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{PGlite}from'@electric-sql/pglite';
import{normalizeEditionLanguage}from'../lib/books/edition-ranking.ts';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('exact install files: fresh install, read roles, rejected writes, CAS corrections and committed uninstall',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table works(id bigint primary key,author_id bigint,open_library_id text);create table editions(id bigint primary key,work_id bigint references works(id),title text,language text,isbn_13 text,open_library_edition_id text);
 insert into works values(1,7,'OL1W'),(2,8,'OL2W');insert into editions values(3,1,'A verified book','eng',null,'OL2M');grant select on works,editions to service_role;
 create table ratings(work_id bigint,rating integer);insert into ratings values(2,8);`);
 for(const f of ['20261108121440_public_description_snapshots.sql','20261108121441_public_page_revision_ledger.sql','20261108123719_snapshot_normalized_language_guard.sql'])await db.exec(await read('supabase/migrations/'+f));
 for(const raw of ['nl','nld','dut','nl_BE','/languages/dut/','en','en_US','english','/languages/eng','fr','mul','nl/en','']){
  const normalized=normalizeEditionLanguage(raw),expected=['eng','nld'].includes(normalized)?normalized:null;
  assert.equal((await db.query('select public.catalog_snapshot_language($1) v',[raw])).rows[0].v,expected,raw);
 }
 const insert=`insert into catalog_description_snapshots values(1,3,'en',repeat('a',64),7,'A verified book','eng',null,'OL1W','The verified synopsis has enough content to identify a meaningful description for this book and its central conflict.','OL2M','2026-11-01','2026-11-01','resolved','identity_and_language_verified')`;
 await db.exec('set role service_role');await db.exec(insert);await db.exec('reset role');
 // Existing database spellings and normalized app codes represent one language.
 await db.exec("update editions set language='en-US' where id=3");
 await db.exec("update catalog_description_snapshots set checked_at='2026-11-02' where work_id=1");
 await assert.rejects(db.exec(`update catalog_description_snapshots set text=text||' Bad late answer.'`),/same fetch revision/);
 await assert.rejects(db.exec(`update catalog_description_snapshots set bound_author_id=8`),/binding changed/);
 await db.exec(`update catalog_description_snapshots set checked_at='2026-11-02',provider_status='temporary_failure'`);
 assert.match((await db.query('select text from catalog_description_snapshots')).rows[0].text,/verified synopsis/);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);assert.equal((await db.query('select count(*)::int n from catalog_description_snapshots')).rows[0].n,1);await assert.rejects(db.exec(insert),/permission denied/);await assert.rejects(db.exec(`select withdraw_catalog_description_snapshot(1,3,'en',repeat('a',64),'2026-11-01')`),/permission denied/);await db.exec('reset role');}
 await assert.rejects(db.exec(`select withdraw_catalog_description_snapshot(1,3,'en',repeat('b',64),'2026-11-01')`),/CAS mismatch/);
 await db.exec(`select withdraw_catalog_description_snapshot(1,3,'en',repeat('a',64),'2026-11-01')`);
 assert.equal((await db.query('select count(*)::int n from catalog_description_snapshots')).rows[0].n,0);
 const record=(expected,hash,date,receipt='c'.repeat(64))=>db.query("select record_catalog_public_revision(1,'nl',$1,$2,$3,$4) changed",[expected,hash,date,receipt]);
 const a='a'.repeat(64),b='b'.repeat(64);assert.equal((await record(null,a,'2026-11-01')).rows[0].changed,true);
 assert.equal((await record(a,a,'2026-11-02')).rows[0].changed,false);
 assert.equal((await db.query('select content_changed_at::text t from catalog_public_page_revisions')).rows[0].t,'2026-11-01 00:00:00+00');
 await assert.rejects(record(null,b,'2026-11-02'),/changed since manifest/);await assert.rejects(record(a,b,'2026-10-01'),/chronology/);await assert.rejects(record(a,b,'2026-11-02','not-a-receipt'),/Invalid verified/);
 const rights=(await db.query("select has_function_privilege('anon','public.record_catalog_public_revision(bigint,text,text,text,timestamptz,text)','execute') a,has_function_privilege('service_role','public.record_catalog_public_revision(bigint,text,text,text,timestamptz,text)','execute') s")).rows[0];assert.deepEqual(rights,{a:false,s:true});
 // Down migration must refuse valuable rows or unknown dependants.
 const restore=await read('docs/public-metadata-20261108/restore-empty.sql');await assert.rejects(db.exec(restore),/nonempty/);await db.exec('rollback');
 await db.exec('delete from catalog_public_page_revisions');await db.exec('create view unexpected_dependency as select * from catalog_public_page_revisions');await assert.rejects(db.exec(restore),/depend/);await db.exec('rollback');await db.exec('drop view unexpected_dependency');
 await db.exec(restore);assert.deepEqual((await db.query('select * from ratings')).rows,[{work_id:2,rating:8}]);assert.equal((await db.query('select count(*)::int n from works')).rows[0].n,2);
 }finally{await db.close();}
});
