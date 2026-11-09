import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('committed withdrawal removes body, preserves source identity and blocks all automatic replacement paths',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table works(id bigint primary key,author_id bigint,open_library_id text);
 create table editions(id bigint primary key,work_id bigint references works(id),title text,language text,isbn_13 text,open_library_edition_id text);
 insert into works values(1,7,'OL1W');insert into editions values(3,1,'A verified book','eng',null,'OL2M');
 grant select on works,editions to service_role;
 create table ratings(work_id bigint,rating integer);insert into ratings values(1,8);
 create table catalog_work_descriptions(work_id bigint,text text);insert into catalog_work_descriptions values(1,'Controlled text untouched');`);
 for(const f of ['20261108121440_public_description_snapshots.sql','20261108121441_public_page_revision_ledger.sql','20261108123719_snapshot_normalized_language_guard.sql','20261108203223_description_snapshot_withdrawal.sql','20261108215212_reviewed_snapshot_reinstatement_guarded.sql'])await db.exec(await read('supabase/migrations/'+f));
 const insert=`insert into catalog_description_snapshots(work_id,edition_id,locale,binding_hash,bound_author_id,bound_title,bound_language,bound_isbn13,bound_open_library_work_id,text,source_key,fetched_at,checked_at,provider_status,validation)
 values(1,3,'en',repeat('a',64),7,'A verified book','eng',null,'OL1W','The verified synopsis has enough content to identify a meaningful description for this book and its central conflict.','OL2M','2026-11-01','2026-11-01','resolved','identity_and_language_verified')`;
 await db.exec(insert);const before=(await db.query('select * from catalog_description_snapshots')).rows[0];
 const withdraw=(hash='a'.repeat(64),date='2026-11-01')=>db.query("select withdraw_catalog_description_snapshot(1,3,'en',$1,$2) changed",[hash,date]);
 await assert.rejects(withdraw('b'.repeat(64)),/CAS mismatch/);
 await assert.rejects(withdraw('a'.repeat(64),'2026-11-02'),/CAS mismatch/);
 await db.exec('set role anon');await assert.rejects(withdraw(),/permission denied/);await db.exec('reset role');
 await db.exec('set role service_role');assert.equal((await withdraw()).rows[0].changed,true);await db.exec('reset role');
 const after=(await db.query('select * from catalog_description_snapshots')).rows[0];
 assert.equal(after.text,null);assert.equal(after.provider_status,'withdrawn');assert.equal(after.source_key,before.source_key);assert.equal(after.fetched_at.toISOString(),before.fetched_at.toISOString());
 assert.match(after.withdrawn_text_sha256,/^[a-f0-9]{64}$/);assert.match(after.withdrawal_receipt_sha256,/^[a-f0-9]{64}$/);
 assert.equal((await withdraw()).rows[0].changed,false);assert.deepEqual((await db.query('select * from catalog_description_snapshots')).rows[0],after);
 await db.exec('set role service_role');
 await assert.rejects(db.exec(`update catalog_description_snapshots set provider_status='resolved',text='A new unreviewed provider payload must not revive a withdrawn source.'`),/automatically reimported/);
 await assert.rejects(db.exec(`update catalog_description_snapshots set provider_status='temporary_failure'`),/automatically reimported/);
 await assert.rejects(db.exec(insert+` on conflict(work_id,edition_id,locale) do update set fetched_at=now(),checked_at=now(),text=excluded.text,provider_status='resolved'`),/automatically reimported/);
 await db.exec('reset role');
 assert.deepEqual((await db.query('select * from ratings')).rows,[{work_id:1,rating:8}]);
 assert.deepEqual((await db.query('select * from catalog_work_descriptions')).rows,[{work_id:1,text:'Controlled text untouched'}]);
 // Only a separately reviewed, receipt-bound new source response can be reinstated.
 const corrected={...after,text:'A separately reviewed corrected synopsis now describes the actual second book rather than the first novel in its series.',provider_status:'resolved',withdrawn_at:null,withdrawn_text_sha256:null,withdrawal_receipt_sha256:null,fetched_at:'2026-11-03',checked_at:(await db.query('select clock_timestamp()::text t')).rows[0].t};
 let digest=(await db.query("select encode(sha256(convert_to(to_jsonb(s)::text,'UTF8')),'hex') h from catalog_description_snapshots s where edition_id=3")).rows[0].h;
 const restore=(hash,row)=>db.query("select reinstate_catalog_description_snapshot(1,3,'en',$1,$2::jsonb) changed",[hash,JSON.stringify(row)]);
 await assert.rejects(restore('bad',corrected),/CAS mismatch/);
 await assert.rejects(restore(digest,{...corrected,text:before.text}),/withdrawn body/);
 await assert.rejects(restore(digest,{...corrected,bound_author_id:99}),/binding changed/);
 assert.equal((await db.query('select provider_status from catalog_description_snapshots where edition_id=3')).rows[0].provider_status,'withdrawn','failed correction retains tombstone');
 await db.exec("update catalog_description_snapshots set checked_at=clock_timestamp() where edition_id=3");
 await assert.rejects(restore(digest,corrected),/CAS mismatch/);
 digest=(await db.query("select encode(sha256(convert_to(to_jsonb(s)::text,'UTF8')),'hex') h from catalog_description_snapshots s where edition_id=3")).rows[0].h;
 await assert.rejects(restore(digest,corrected),/new reviewed response/);
 corrected.checked_at=(await db.query('select clock_timestamp()::text t')).rows[0].t;
 assert.equal((await restore(digest,corrected)).rows[0].changed,true);assert.equal((await restore(digest,corrected)).rows[0].changed,false);
 // A normal valid provider refresh still works on a different exact edition.
 await db.exec(`insert into editions values(4,1,'A verified book','eng',null,'OL3M')`);
 await db.exec(insert.replace("(1,3,'en'","(1,4,'en'").replaceAll("'OL2M'","'OL3M'"));
 await db.exec(`update catalog_description_snapshots set text=text||' A verified new fetch.',fetched_at='2026-11-02',checked_at='2026-11-02' where edition_id=4`);
 assert.equal((await db.query(`select provider_status from catalog_description_snapshots where edition_id=4`)).rows[0].provider_status,'resolved');
 const restoredColumns='work_id,edition_id,locale,binding_hash,text,source_key,fetched_at,checked_at,provider_status';
 const saved=(await db.query('select '+restoredColumns+' from catalog_description_snapshots order by edition_id')).rows;
 await db.exec(await read('docs/source-repair-20261108/restore-schema.sql'));
 assert.equal((await db.query("select count(*)::int n from information_schema.columns where table_name='catalog_description_snapshots' and column_name='withdrawn_at'")).rows[0].n,0);
 assert.deepEqual((await db.query('select '+restoredColumns+' from catalog_description_snapshots order by edition_id')).rows,saved);
 await db.exec(await read('supabase/migrations/20261108203223_description_snapshot_withdrawal.sql'));
 await db.exec(await read('supabase/migrations/20261108215212_reviewed_snapshot_reinstatement_guarded.sql'));
 assert.deepEqual((await db.query('select '+restoredColumns+' from catalog_description_snapshots order by edition_id')).rows,saved);
 await db.exec('create view own_later_dependency as select withdrawn_at from catalog_description_snapshots');
 await assert.rejects(db.exec(await read('docs/source-repair-20261108/restore-schema.sql')),/depend/);await db.exec('rollback');
 await db.exec('drop view own_later_dependency');

 }finally{await db.close();}
});
