// Entirely synthetic, in-process PostgreSQL. Never reads environment credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { permissionsMigration, verifyFunctionPermissions } from './discovery-permissions.mjs';
const migration = '20261003183631_discovery_taste_rounds.sql';
const sql = async file => readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8');
const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';
async function fixture({ correctPermissions = true } = {}) {
  const db = new PGlite(); await db.waitReady;
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    insert into auth.users values('${a}'),('${b}');
    create table public.authors(id bigint primary key,name text not null);
    create table public.works(id bigint primary key,title text not null,author_id bigint references public.authors(id),first_publish_year integer,cover_id bigint);
    create table public.editions(id bigint generated always as identity primary key,work_id bigint references public.works(id),title text,language text);
    grant select on public.authors,public.works,public.editions to anon,authenticated;
    insert into public.authors select i,'Synthetic Author '||i from generate_series(1,32) i;
    insert into public.works select i,'Synthetic Book '||lpad(i::text,5,'0'),(i%32)+1,2000+(i%20),null from generate_series(1,10134) i;
    insert into public.editions(work_id,title,language) select id,title,'en' from public.works;
    insert into public.editions(work_id,title,language) select id,title,'nl' from public.works where id%2=0;`);
  await db.exec(await sql('20260908052221_secure_ratings_foundation.sql'));
  await db.exec(await sql('20260910062625_add_batch_rating_summaries.sql'));
  await db.exec(await sql('20260916071439_collections_v1.sql'));
  await db.exec(await sql('20260930185834_catalog_selection_v1.sql'));
  await db.exec(`insert into public.catalog_categories values('fiction_fantasy','Fantasy','Fantasy'),('empty_category','Leeg','Empty');
    insert into public.work_catalog_categories select id,'fiction_fantasy' from public.works where id<=5000;
    insert into public.ratings(user_id,work_id,rating) values('${a}',1,6),('${b}',10134,10);`);
  // Reproduce the explicit Supabase default ACL, not merely PUBLIC inheritance.
  await db.exec('alter default privileges in schema public grant execute on functions to anon, authenticated, service_role');
  await db.exec(await sql(migration));
  if (correctPermissions) await db.exec(await sql(permissionsMigration));
  return db;
}
async function asUser(db, id = a) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('set role authenticated');
}
const state = async db => (await db.query('select public.taste_rating_state() as state')).rows[0].state;
const act = async (db, action, r = null, work = null, score = null, language = 'en') => (await db.query(
  'select public.taste_rating_advance($1,$2,$3,$4,$5) as state', [action,r,work,score,language])).rows[0].state;

test('forward rights correction catches explicit anon default grants and preserves data/function contracts', async () => {
  const db = await fixture({ correctPermissions: false });
  try {
    assert.equal((await db.query("select has_function_privilege('anon','public.taste_rating_state()','EXECUTE') as allowed")).rows[0].allowed, true);
    await assert.rejects(() => verifyFunctionPermissions(db), /Effective anon EXECUTE/);
    const before = (await db.query('select * from public.ratings order by user_id,work_id')).rows;
    const defaults = (await db.query('select defaclrole,defaclnamespace,defaclobjtype,defaclacl from pg_default_acl order by oid')).rows;
    await db.exec(await sql(permissionsMigration));
    await verifyFunctionPermissions(db);
    // Repeating the exact GRANT/REVOKE is harmless; migration history is not edited.
    await db.exec(await sql(permissionsMigration));
    await verifyFunctionPermissions(db);
    assert.deepEqual((await db.query('select * from public.ratings order by user_id,work_id')).rows, before);
    assert.deepEqual((await db.query('select defaclrole,defaclnamespace,defaclobjtype,defaclacl from pg_default_acl order by oid')).rows, defaults);
    // Catch inherited effective access too: named ACL removal alone is insufficient.
    await db.exec('grant authenticated to anon');
    await assert.rejects(() => verifyFunctionPermissions(db), /Effective anon EXECUTE/);
    await db.exec('revoke authenticated from anon');
    await db.exec('create role unexpected_test_role; grant execute on function public.taste_rating_state() to unexpected_test_role');
    await assert.rejects(() => verifyFunctionPermissions(db), /Unplanned EXECUTE/);
    await db.exec('revoke execute on function public.taste_rating_state() from unexpected_test_role');
    await verifyFunctionPermissions(db);
    await db.exec('set role anon');
    await assert.rejects(() => state(db), error => error.code === '42501' && /function taste_rating_state/.test(error.message));
    for (const table of ['taste_rating_rounds','taste_rating_offers'])
      await assert.rejects(() => db.query(`select * from public.${table}`), error => error.code === '42501');
    await asUser(db);
    assert.equal((await state(db)).round, null);
  } finally { await db.close(); }
});

test('server discovery paginates canonical author/category intersection and highest score beyond first 100 Works', async () => {
  const db = await fixture();
  try {
    await db.exec('set role anon');
    const query = async page => (await db.query("select public.catalog_discovery_page(p_author_id=>1,p_categories=>array['fiction_fantasy'],p_languages=>array['nl'],p_page=>$1) as data", [page])).rows[0].data;
    const start = performance.now(), first = await query(1), second = await query(2);
    assert.equal(first.total,156); assert.equal(first.workIds.length,32); assert.equal(first.pageCount,5);
    assert.ok(second.workIds.every(id => !first.workIds.includes(id)));
    assert.ok([...first.workIds,...second.workIds].every(id => id%32===0));
    assert.equal(first.facets.empty_category,0);
    const twoFilteredQueriesMs = Math.round(performance.now()-start);
    const highest = (await db.query("select public.catalog_discovery_page(p_sort=>'highest') as data")).rows[0].data;
    assert.deepEqual(highest.workIds,[10134,1]);
    const none = (await db.query("select public.catalog_discovery_page(p_author_id=>999,p_categories=>array['fiction_fantasy']) as data")).rows[0].data;
    assert.equal(none.total,0); assert.deepEqual(none.workIds,[]);
    console.log(JSON.stringify({ syntheticWorks:10134, twoFilteredQueriesMs, pagePayloadBytes:Buffer.byteLength(JSON.stringify(first)), idsPerPage:first.workIds.length }));
  } finally { await db.close(); }
});

test('three persisted rounds of twenty explicit ratings: skip, resume, retry, read trigger, preservation and owner isolation', async () => {
  const db = await fixture();
  try {
    await asUser(db);
    let current = await act(db,'start');
    assert.notEqual(current.currentWorkId,'1');
    assert.deepEqual(await act(db,'start'),current,'double start resumes the same round');
    assert.deepEqual(await state(db),current,'refresh restores the exact offered Work');
    const skipped = current.currentWorkId;
    current = await act(db,'skip',current.round.id,skipped);
    assert.equal(current.round.ratedCount,0);
    assert.equal((await db.query('select count(*)::int as n from public.ratings where work_id=$1',[skipped])).rows[0].n,0);
    await assert.rejects(() => act(db,'choose',current.round.id,1),/different unrated book/);
    const seen = new Set([skipped]);
    for (let round = 1; round <= 3; round++) {
      assert.equal(current.round.number,round);
      for (let i = 0; i < 20; i++) {
        const id = current.currentWorkId, rid = current.round.id;
        assert.ok(id && !seen.has(id)); seen.add(id);
        const next = await act(db,'rate',rid,id,(i%10)+1);
        assert.equal(next.round.ratedCount,i+1);
        assert.deepEqual(await act(db,'rate',rid,id,(i%10)+1),next,'retries do not add or overwrite a rating');
        assert.deepEqual(await state(db),next,'refresh persists every transition');
        assert.equal((await db.query('select status from public.user_book_status where work_id=$1',[id])).rows[0].status,'read');
        current = next;
      }
      assert.equal(current.round.complete,true); assert.equal(current.currentWorkId,null);
      if (round < 3) current = await act(db,'start');
    }
    assert.equal(seen.size,61);
    assert.equal((await db.query('select count(*)::int as n from public.ratings')).rows[0].n,61);
    assert.equal((await db.query('select rating from public.ratings where work_id=1')).rows[0].rating,6);
    await assert.rejects(() => db.query('update public.taste_rating_rounds set completed_at=null'),/permission denied/);
    const otherRound = current.round.id;
    await asUser(db,b);
    assert.equal((await state(db)).round,null);
    assert.equal((await db.query('select count(*)::int as n from public.taste_rating_offers')).rows[0].n,0);
    await assert.rejects(() => act(db,'resume',otherRound),/Round not current/);
    await db.exec('reset role; set role anon');
    await assert.rejects(() => state(db),/permission denied/);
    await assert.rejects(() => act(db,'start'),/permission denied/);
    await db.exec('reset role');
    assert.equal((await db.query('select count(*)::int as n from public.ratings')).rows[0].n,62);
    const flags=(await db.query("select relrowsecurity,relforcerowsecurity from pg_class where relname in ('taste_rating_rounds','taste_rating_offers')")).rows;
    assert.ok(flags.length===2 && flags.every(x=>x.relrowsecurity && x.relforcerowsecurity));
  } finally { await db.close(); }
});

test('concurrent normal rating is preserved atomically; exhaustion never repeats offered books', async () => {
  const db = await fixture();
  try {
    await asUser(db);
    let current = await act(db,'start',null,null,null,'nl');
    const offered = current.currentWorkId;
    await db.query('insert into public.ratings(work_id,rating) values($1,9)',[offered]);
    await assert.rejects(() => act(db,'rate',current.round.id,offered,4),/Existing rating preserved/);
    assert.equal((await state(db)).round.ratedCount,0);
    assert.equal((await db.query('select rating from public.ratings where work_id=$1',[offered])).rows[0].rating,9);
    await db.exec('reset role');
    await db.exec('delete from public.editions'); // Disposable fixture only: forces pool exhaustion.
    await asUser(db);
    current = await act(db,'skip',current.round.id,offered);
    assert.equal(current.exhausted,true); assert.equal(current.currentWorkId,null); assert.equal(current.round.ratedCount,0);
    assert.deepEqual(await act(db,'resume',current.round.id),current);
  } finally { await db.close(); }
});

test('reviewed empty-schema recovery is narrow and preserves existing ratings/statuses', async () => {
  const db = await fixture();
  try {
    const doc = await readFile(new URL('../docs/discovery-taste-review.md', import.meta.url), 'utf8');
    const recovery = doc.match(/-- BEGIN REVIEW-ONLY RECOVERY\n([\s\S]*?)-- END REVIEW-ONLY RECOVERY/)[1];
    await db.exec(recovery);
    assert.equal((await db.query('select count(*)::int as n from public.ratings')).rows[0].n,2);
    assert.equal((await db.query('select count(*)::int as n from public.user_book_status')).rows[0].n,2);
    assert.equal((await db.query("select to_regprocedure('public.catalog_editorial_page(text,text[],text,text[],text,integer,integer,bigint[])') is not null as kept")).rows[0].kept,true);
  } finally { await db.close(); }
});
