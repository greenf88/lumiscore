import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const read=n=>readFile(new URL('../test-support/product-metrics/'+n,import.meta.url),'utf8');
test('fresh ten-book acceptance fixture commits, replays and removes only its own rows; no users or real book facts invented',async()=>{
 const f=JSON.parse(await read('acceptance-fixture-v2.json'));
 assert.equal(f.books.length,10);assert.equal(f.project,'hlvujbrmfdlrfxdjwsmb');
 const render=s=>s.replaceAll('pr51-acceptance-20261028-v1',f.fixtureId).replaceAll('<>9','<>10').replaceAll('EXPECTED_NINE_FIXTURES','EXPECTED_TEN_FIXTURES').replace('__FIXTURE_JSON__',JSON.stringify(f));
 const db=new PGlite();try{
  await db.exec(`create schema discovery_test_private;create table discovery_test_private.marker(identity text);insert into discovery_test_private.marker values('lumiscore-pr8-synthetic-v1');
   create table authors(id bigint primary key,name text,open_library_id text);create table works(id bigint primary key,title text,author_id bigint references authors(id),source_type text,work_type text,native_identity_key text,open_library_id text,cover_id bigint,first_publish_year int);
   create table editions(id bigint primary key,work_id bigint references works(id),title text,language text,isbn_10 text,isbn_13 text,open_library_edition_id text,publisher text,publish_date text,cover_id bigint);
   create table work_trait_evidence(work_id bigint references works(id),trait text,weight numeric,confidence numeric,source text,source_key text,raw_labels text[],mapping_version text,verified_at timestamptz,updated_at timestamptz,primary key(work_id,trait,source,source_key));
   create table collection_books(work_id bigint,collection_id bigint);create table collections(id bigint);create table work_catalog_categories(work_id bigint,category_id text);
   create schema taste_private;create table taste_private.eligible_inventory_v1(work_id bigint references works(id),language text,edition_id bigint references editions(id),policy_version text,source_snapshot jsonb,review_id text,approved_at timestamptz,primary key(language,work_id));
   create function taste_private.inventory_snapshot_v1(w bigint)returns jsonb language sql stable as $$select jsonb_build_object('work',to_jsonb(t),'editions',(select jsonb_agg(to_jsonb(e)order by id)from editions e where e.work_id=w))from works t where t.id=w$$;
   create function taste_private.inventory_current_v1(w bigint,l text)returns boolean language sql stable as $$select exists(select 1 from taste_private.eligible_inventory_v1 i where work_id=w and language=l and i.source_snapshot=taste_private.inventory_snapshot_v1(w))$$;
   create schema catalog_private;create table catalog_private.editorial_records(work_id bigint);create table ratings(work_id bigint);create table user_book_status(work_id bigint);create table taste_rating_offers(work_id bigint);create table work_cover_resolutions(work_id bigint);create table catalog_selection_members(work_id bigint);create table catalog_work_title_aliases(work_id bigint);
   insert into authors values(1,'Retained existing author',null);insert into works(id,title,author_id)values(1,'Retained existing book',1);`);
  const install=render(await read('acceptance-fixture-install.sql')),cleanup=render(await read('acceptance-fixture-cleanup.sql'));
  await db.exec(install);await db.exec(install);assert.equal((await db.query('select count(*)::int n from works')).rows[0].n,11);
  assert.equal((await db.query('select count(*)::int n from editions where isbn_13 is not null')).rows[0].n,0);
  await db.exec('insert into ratings values(951511001)');await assert.rejects(()=>db.exec(cleanup),/REFERENCED_FIXTURE/);await db.exec('rollback');
  await db.exec('delete from ratings');await db.exec(cleanup);await db.exec(cleanup);
  assert.equal((await db.query('select count(*)::int n from works')).rows[0].n,1);assert.equal((await db.query('select title from works')).rows[0].title,'Retained existing book');
 }finally{await db.close();}
});
