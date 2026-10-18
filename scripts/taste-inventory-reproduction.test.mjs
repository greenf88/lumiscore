// Disposable in-process PostgreSQL only. Existing deployed migrations are read,
// never edited/applied to a hosted project. No environment or credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const uid = '00000000-0000-4000-8000-000000000111';
const migration = name => readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
async function fixture(size) {
  const db = new PGlite(); await db.waitReady;
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    insert into auth.users values('${uid}');
    create table public.authors(id bigint primary key,name text);
    create table public.works(id bigint primary key,title text,author_id bigint,first_publish_year integer,cover_id bigint);
    create table public.editions(id bigint generated always as identity primary key,work_id bigint,title text,language text);
    create table public.work_catalog_categories(work_id bigint,category_id text);
    grant select on public.authors,public.works,public.editions,public.work_catalog_categories to authenticated;
    insert into public.authors values(1,'Fixture');
    insert into public.works select n,'Fixture '||n,1,2000,null from generate_series(1,${size}) n;
    insert into public.editions(work_id,title,language) select id,title,'nld' from public.works;`);
  await db.exec(await migration('20260908052221_secure_ratings_foundation.sql'));
  const collections = await migration('20260916071439_collections_v1.sql');
  await db.exec(collections.slice(0, collections.indexOf('insert into public.collections (slug')));
  const initial = await migration('20261003183631_discovery_taste_rounds.sql');
  await db.exec(initial.slice(initial.indexOf('create table public.taste_rating_rounds')));
  await db.exec(await migration('20261004164419_flexible_taste_rounds.sql'));
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await db.exec('set role authenticated');
  return db;
}
const act = async (db, action, state = null, work = null, score = null, language = 'nl') =>
  (await db.query('select public.taste_rating_advance_v2($1,$2,$3,$4,$5,10) as state', [action, state?.round.id ?? null, work, score, language])).rows[0].state;
test('actual SQL: three consecutive NL rounds persist, no duplicates, resume keeps saved edition language', async () => {
  const db = await fixture(90);
  try {
    const seen = new Set();
    let state;
    for (let round = 1; round <= 3; round++) {
      state = await act(db, 'start'); assert.equal(state.round.number, round);
      for (let i = 0; i < 12; i++) {
        const id = state.currentWorkId; assert.ok(id); assert.equal(seen.has(id), false); seen.add(id);
        const before = state.round.ratedCount;
        state = await act(db, i < 2 ? 'skip' : 'rate', state, id, i < 2 ? null : 9);
        assert.equal(state.round.ratedCount, before + (i < 2 ? 0 : 1));
        const resumed = await act(db, 'resume', state, null, null, 'en');
        assert.deepEqual(resumed, state); assert.equal(resumed.round.language, 'nl');
      }
      assert.equal(state.round.complete, true);
    }
    assert.equal((await db.query('select count(*)::int n from public.ratings')).rows[0].n, 30);
    assert.equal((await db.query('select count(*)::int n from public.user_book_status')).rows[0].n, 30);
    console.log(JSON.stringify({ reproduction: 'three-NL-rounds', ratings: 30, skipped: 6, uniqueOffers: seen.size, preservedLanguage: 'nl' }));
  } finally { await db.close(); }
});
test('actual SQL diagnoses permanent earlier-skip exclusion and honest third-round exhaustion', async () => {
  const db = await fixture(40);
  try {
    let state, earlierSkip;
    for (let round = 1; round <= 3; round++) {
      state = await act(db, 'start'); assert.equal(state.round.number, round);
      for (let n = 0; n < 15 && state.currentWorkId; n++) {
        const id = state.currentWorkId;
        if (round === 1 && n === 0) earlierSkip = id;
        state = await act(db, n < 5 ? 'skip' : 'rate', state, id, n < 5 ? null : 8);
      }
    }
    assert.equal(state.exhausted, true); assert.equal(state.round.complete, false); assert.equal(state.round.ratedCount, 5);
    const before = (await db.query('select * from public.ratings order by work_id')).rows;
    await assert.rejects(() => act(db, 'choose', state, earlierSkip), e => e.code === '22023');
    assert.deepEqual((await db.query('select * from public.ratings order by work_id')).rows, before);
    assert.equal(before.length, 25); assert.equal((await db.query('select count(*)::int n from public.user_book_status')).rows[0].n, 25);
    assert.equal((await db.query("select count(*)::int n from public.taste_rating_offers where decision='skipped'")).rows[0].n, 15);
    console.log(JSON.stringify({ reproduction: 'deployed-SQL-limit', offered: 40, ratings: 25, priorSkips: 10, currentSkips: 5, finalRoundRated: 5, goal: 10, earlierSkipRejected: true }));
  } finally { await db.close(); }
});
