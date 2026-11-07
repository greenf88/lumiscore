import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('snapshot SQL guards identity, older responses, rights and committed restoration without touching parents',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table works(id bigint primary key);create table editions(id bigint primary key,work_id bigint references works(id),language text,open_library_edition_id text);
 insert into works values(1),(2);insert into editions values(3,1,'eng','OL2M'),(4,2,'nld','OL3M');`);
 const sql=await readFile(new URL('../docs/proposals/description-snapshots.sql.proposal',import.meta.url),'utf8');await db.exec(sql);
 const insert=`insert into catalog_description_snapshots values(1,3,'en',repeat('a',64),'The verified synopsis has enough content to identify a meaningful description for this book and its central conflict.','OL2M','2026-11-01','2026-11-01','resolved','identity_and_language_verified')`;
 await db.exec(insert);assert.equal((await db.query('select count(*)::int n from catalog_description_snapshots')).rows[0].n,1);
 await assert.rejects(db.exec(`update catalog_description_snapshots set fetched_at='2026-10-01'`),/Older/);
 await assert.rejects(db.exec(`update catalog_description_snapshots set edition_id=4`),/binding changed/);
 await db.exec(`update catalog_description_snapshots set provider_status='temporary_failure',checked_at='2026-11-02'`);
 assert.match((await db.query('select text from catalog_description_snapshots')).rows[0].text,/verified synopsis/);
 await db.exec('set role anon');assert.equal((await db.query('select count(*)::int n from catalog_description_snapshots')).rows[0].n,1);
 await assert.rejects(db.exec('delete from catalog_description_snapshots'),/permission denied/);await db.exec('reset role');
 const restore=await readFile(new URL('../docs/proposals/description-snapshots-restore.sql.proposal',import.meta.url),'utf8');
 await assert.rejects(db.exec(restore),/not empty/);await db.exec('rollback');
 await db.exec(`delete from catalog_description_snapshots where work_id=1 and edition_id=3 and binding_hash=repeat('a',64)`);
 await db.exec(restore);assert.equal((await db.query('select count(*)::int n from works')).rows[0].n,2);assert.equal((await db.query('select count(*)::int n from editions')).rows[0].n,2);
 }finally{await db.close();}
});
