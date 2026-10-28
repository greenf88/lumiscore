import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const file=n=>readFile(new URL('../test-support/product-metrics/'+n,import.meta.url),'utf8');
export const manifest=JSON.parse(await file('acceptance-fixture-v1.json'));
export const installation=(await file('acceptance-fixture-install.sql')).replace('__FIXTURE_JSON__',JSON.stringify(manifest));
const cleanup=(await file('acceptance-fixture-cleanup.sql')).replace('__FIXTURE_JSON__',JSON.stringify(manifest));

test('minimal acceptance fixture is idempotent, preserves existing records and rejects changed identities atomically',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema discovery_test_private;create table discovery_test_private.marker(identity text);insert into discovery_test_private.marker values('lumiscore-pr8-synthetic-v1');
 create table public.authors(id bigint primary key,name text not null,open_library_id text unique);
 create table public.works(id bigint primary key,title text not null,author_id bigint references authors(id),source_type text,work_type text,native_identity_key text,open_library_id text unique,cover_id bigint,first_publish_year int);
 create table public.editions(id bigint primary key,work_id bigint references works(id),title text,language text,isbn_10 text,isbn_13 text,open_library_edition_id text unique,publisher text,publish_date text,cover_id bigint);
 create table public.work_trait_evidence(work_id bigint references works(id),trait text,weight numeric,confidence numeric,source text,source_key text,raw_labels text[],mapping_version text,verified_at timestamptz,updated_at timestamptz,primary key(work_id,trait,source,source_key));
 create table public.collection_books(work_id bigint,collection_id bigint);create table public.collections(id bigint);
 create table public.work_catalog_categories(work_id bigint,category_id text);
 create schema taste_private;create table taste_private.eligible_inventory_v1(work_id bigint references works(id),language text,edition_id bigint references editions(id),policy_version text,source_snapshot jsonb,review_id text,approved_at timestamptz,primary key(language,work_id));
 create function taste_private.inventory_snapshot_v1(w bigint) returns jsonb language sql stable as $$select jsonb_build_object('work',to_jsonb(t),'editions',(select jsonb_agg(to_jsonb(e) order by e.id) from editions e where e.work_id=w),'traits',(select jsonb_agg(to_jsonb(v) order by trait,source,source_key) from work_trait_evidence v where v.work_id=w)) from works t where t.id=w$$;
 create function taste_private.inventory_current_v1(w bigint,l text) returns boolean language sql stable as $$select exists(select 1 from taste_private.eligible_inventory_v1 i join editions e on e.id=i.edition_id and e.work_id=i.work_id where i.work_id=w and i.language=l and i.policy_version='taste_eligibility_v1' and length(trim(e.title))>0 and e.language=case l when 'nl' then 'nld' when 'en' then 'eng' end and i.source_snapshot=taste_private.inventory_snapshot_v1(w))$$;
 insert into authors values(1,'Preserved existing author',null);insert into works(id,title,author_id) values(1,'Preserved existing book',1);`);
 await db.exec(`create schema catalog_private;create table catalog_private.editorial_records(work_id bigint);
 create table ratings(work_id bigint);create table user_book_status(work_id bigint);create table taste_rating_offers(work_id bigint);
 create table work_cover_resolutions(work_id bigint);create table catalog_selection_members(work_id bigint);create table catalog_work_title_aliases(work_id bigint);`);
 await db.exec(installation);await db.exec(installation);
 assert.equal((await db.query('select count(*)::int n from works')).rows[0].n,10);
 assert.equal((await db.query('select count(*)::int n from taste_private.eligible_inventory_v1')).rows[0].n,9);
 assert.equal((await db.query('select title from works where id=1')).rows[0].title,'Preserved existing book');
 await db.exec("update editions set language='ger' where id=951510005");
 await assert.rejects(()=>db.exec(installation),/EDITION_CHANGED/);await db.exec('rollback');
 assert.equal((await db.query('select language from editions where id=951510005')).rows[0].language,'ger');
 assert.equal((await db.query('select count(*)::int n from works')).rows[0].n,10);
 await assert.rejects(()=>db.exec(cleanup),/EDITION_CHANGED/);await db.exec('rollback');
 await db.exec("update editions set language='nld' where id=951510005;insert into ratings values(951510001)");
 await assert.rejects(()=>db.exec(cleanup),/REFERENCED_FIXTURE/);await db.exec('rollback');
 await db.exec('delete from ratings where work_id=951510001');await db.exec(cleanup);await db.exec(cleanup);
 assert.equal((await db.query('select count(*)::int n from works')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from authors')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from taste_private.eligible_inventory_v1')).rows[0].n,0);
 await db.exec("delete from discovery_test_private.marker");
 await assert.rejects(()=>db.exec(installation),/TEST_TARGET_REQUIRED/);await db.exec('rollback');
 }finally{await db.close();}
});
