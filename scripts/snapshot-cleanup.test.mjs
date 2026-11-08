import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import fs from 'node:fs/promises';
const read=f=>fs.readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8');
test('90-day physical retention is bounded, idempotent and excludes withdrawal identities and controlled summaries',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table works(id bigint primary key,author_id bigint,open_library_id text);create table editions(id bigint primary key,work_id bigint references works(id),title text,language text,isbn_13 text,open_library_edition_id text);
 insert into works values(1,7,'OL1W');insert into editions select x,1,'Book','eng',null,'OL'||x||'M' from generate_series(1,6) x;
 create table catalog_work_descriptions(text text);insert into catalog_work_descriptions values('Reviewed summary retained');`);
 for(const f of ['20261108121440_public_description_snapshots.sql','20261108121441_public_page_revision_ledger.sql','20261108123719_snapshot_normalized_language_guard.sql','20261108203223_description_snapshot_withdrawal.sql','20261108220729_description_snapshot_retention_utc.sql'])await db.exec(await read(f));
 await db.exec(`insert into catalog_description_snapshots(work_id,edition_id,locale,binding_hash,bound_author_id,bound_title,bound_language,bound_open_library_work_id,text,source_key,fetched_at,checked_at,provider_status,validation)
 select 1,x,'en',repeat('a',64),7,'Book','eng','OL1W','This is sufficiently long source text for an isolated retention fixture, not a real public book description.','OL'||x||'M',now()-make_interval(days=>case x when 1 then 100 when 2 then 91 when 3 then 90 when 4 then 89 when 5 then 200 else 1 end),now(),'resolved','identity_and_language_verified' from generate_series(1,6) x;`);
 await db.exec(`select withdraw_catalog_description_snapshot(1,5,'en',repeat('a',64),(select fetched_at from catalog_description_snapshots where edition_id=5))`);
 const cleanup=()=>db.query('select cleanup_catalog_description_snapshots(1) result');
 assert.equal((await cleanup()).rows[0].result.deleted,1);assert.equal((await cleanup()).rows[0].result.deleted,1);
 // Same statement timestamp proves the strict boundary; no wall-clock race.
 await db.exec(`do $$ declare r jsonb;begin
 update catalog_description_snapshots set fetched_at=statement_timestamp()-interval '90 days',checked_at=statement_timestamp() where edition_id=3;
 r:=cleanup_catalog_description_snapshots(1);
 if (r->>'deleted')::int<>0 then raise exception 'Exact 90-day boundary was deleted';end if;
 update catalog_description_snapshots set fetched_at=now(),checked_at=now() where edition_id=3;
 end $$;`);
 assert.equal((await cleanup()).rows[0].result.deleted,0);
 assert.deepEqual((await db.query('select edition_id from catalog_description_snapshots order by edition_id')).rows.map(r=>r.edition_id),[3,4,5,6]);
 assert.equal((await db.query('select text,provider_status from catalog_description_snapshots where edition_id=5')).rows[0].text,null);
 assert.equal((await db.query('select text from catalog_work_descriptions')).rows[0].text,'Reviewed summary retained');
 await assert.rejects(db.query('select cleanup_catalog_description_snapshots(501)'),/1..500/);
 await db.exec(`do $tz$ declare zone text;r jsonb;begin foreach zone in array array['UTC','Europe/Amsterdam','America/New_York','Pacific/Auckland'] loop perform set_config('TimeZone',zone,true);r:=cleanup_catalog_description_snapshots(1);if abs(extract(epoch from(statement_timestamp()-(r->>'cutoff')::timestamptz))-7776000)>0.000001 then raise exception 'Retention changed with timezone';end if;end loop;end $tz$;`);
 await db.exec('set role anon');await assert.rejects(cleanup(),/permission denied/);await db.exec('reset role');
 }finally{await db.close();}
});
