// LOCAL disposable PostgreSQL only; no environment, network or hosted writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const uid = '00000000-0000-4000-8000-000000000111';
const other = '00000000-0000-4000-8000-000000000222';
const migration = name => readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
const proposal = () => readFile(new URL('../docs/proposals/taste-storage-v3-20261018.sql', import.meta.url), 'utf8');
const rows = async (db, sql, params = []) => (await db.query(sql, params)).rows;
async function fixture(size = 40, apply = true) {
  const db = new PGlite(); await db.waitReady;
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    insert into auth.users values('${uid}'),('${other}');
    create table public.authors(id bigint primary key,name text);
    create table public.works(id bigint primary key,title text,author_id bigint,first_publish_year integer,cover_id bigint);
    create table public.editions(id bigint generated always as identity primary key,work_id bigint,title text,language text);
    create table public.work_catalog_categories(work_id bigint,category_id text);
    create table public.work_trait_evidence(work_id bigint,trait text,source text,source_key text);
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
  if (apply) { await db.exec(await proposal()); await approveFixtures(db); }
  await login(db); return db;
}
async function login(db, id = uid, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('set role ' + role);
}
async function approveFixtures(db) {
  // Synthetic inventory ONLY: not a source review, importer, or production seed.
  await db.exec(`reset role; insert into taste_private.eligible_inventory_v1
    select e.work_id,'nl',e.id,'taste_eligibility_v1',taste_private.inventory_snapshot_v1(e.work_id),'SYNTHETIC-FIXTURE',now()
    from public.editions e;`);
}
const act = async (db, action, state = null, work = null, score = null, language = 'nl', goal = 10, version = 3) =>
  (await rows(db, `select public.taste_rating_advance_v${version}($1,$2,$3,$4,$5,$6) state`,
    [action, state?.round.id ?? null, work, score, language, goal]))[0].state;
const snapshot = async db => ({
  ratings: await rows(db, 'select * from public.ratings order by user_id,work_id'),
  statuses: await rows(db, 'select * from public.user_book_status order by user_id,work_id'),
  offers: await rows(db, 'select * from public.taste_rating_offers order by user_id,round_id,work_id'),
  rounds: await rows(db, 'select id,user_id,round_number,language,goal,created_at,completed_at from public.taste_rating_rounds order by user_id,round_number'),
});
test('proposal preserves every existing rating, status, offer, timestamp and active-round count', async () => {
  const db = await fixture(40, false);
  try {
    let s = await act(db, 'start', null, null, null, 'nl', 10, 2);
    s = await act(db, 'skip', s, s.currentWorkId, null, 'nl', 10, 2);
    s = await act(db, 'rate', s, s.currentWorkId, 9, 'nl', 10, 2);
    const before = await snapshot(db);
    await db.exec('reset role'); await db.exec(await proposal()); await approveFixtures(db); await login(db);
    assert.deepEqual(await snapshot(db), before);
    const resumed = await act(db, 'resume', s, null, null, 'en');
    assert.deepEqual(resumed, { ...s, storageVersion: 3, canRevisit: false, revisitEarlierSkips: false });
    assert.deepEqual(await act(db, 'start', null, null, null, 'en', 30), resumed);
  } finally { await db.close(); }
});
test('three rounds, explicit earlier-skip revisit, legacy bridge and no historical decision mutation', async () => {
  const db = await fixture();
  try {
    let s; let firstSkip;
    for (let round = 1; round <= 3; round++) {
      s = await act(db, 'start', s);
      for (let n = 0; n < 15 && s.currentWorkId; n++) {
        if (round === 1 && n === 0) firstSkip = s.currentWorkId;
        s = await act(db, n < 5 ? 'skip' : 'rate', s, s.currentWorkId, n < 5 ? null : 8);
      }
    }
    assert.equal(s.round.ratedCount, 5); assert.equal(s.exhausted, true); assert.equal(s.round.complete, false);
    assert.equal(s.canRevisit, true);
    const historical = await rows(db, 'select * from public.taste_rating_offers where work_id=$1', [firstSkip]);
    await assert.rejects(() => act(db, 'choose', s, firstSkip), e => e.code === '22023');
    s = await act(db, 'revisit', s); assert.ok(s.currentWorkId);
    assert.equal(s.canRevisit, false);
    // Same-round skipped offers stay excluded; only past-round skips return.
    const currentSkips = await rows(db, "select work_id from public.taste_rating_offers where round_id=$1 and decision='skipped'", [s.round.id]);
    assert.equal(currentSkips.some(x => Number(x.work_id) === s.currentWorkId), false);
    // v2 clients delegate into the round-scoped implementation after the key change.
    for (let n = 0; n < 5; n++) s = await act(db, 'rate', s, s.currentWorkId, 9, 'nl', 10, 2);
    assert.equal(s.round.complete, true); assert.equal(s.round.ratedCount, 10);
    assert.equal((await rows(db, 'select count(*)::int n from public.ratings'))[0].n, 30);
    assert.equal((await rows(db, 'select count(*)::int n from public.user_book_status'))[0].n, 30);
    const after = await rows(db, 'select * from public.taste_rating_offers where work_id=$1 and round_id=$2', [firstSkip, historical[0].round_id]);
    assert.deepEqual(after, historical);
    assert.equal((await rows(db, 'select count(*)::int n from (select round_id,work_id,count(*) from public.taste_rating_offers group by 1,2 having count(*)>1) x'))[0].n, 0);
  } finally { await db.close(); }
});
test('identical queued saves write once; conflicting replay, stale round and existing rating cannot overwrite', async () => {
  const db = await fixture();
  try {
    const s = await act(db, 'start'); const work = s.currentWorkId;
    const [a, b] = await Promise.all([act(db, 'rate', s, work, 9), act(db, 'rate', s, work, 9)]);
    assert.deepEqual(a, b); assert.equal(a.round.ratedCount, 1); assert.notEqual(a.currentWorkId, work);
    await assert.rejects(() => act(db, 'rate', s, work, 8), e => e.code === '22023');
    await assert.rejects(() => act(db, 'resume', { round: { id: other } }), e => e.code === '22023');
    const current = a.currentWorkId;
    await db.query('insert into public.ratings(user_id,work_id,rating) values($1,$2,7)', [uid, current]);
    const before = await snapshot(db);
    await assert.rejects(() => act(db, 'rate', a, current, 10), e => e.code === '23505');
    assert.deepEqual(await snapshot(db), before);
  } finally { await db.close(); }
});
test('skip has no rating/status write; failure preserves current book; Read cannot be chosen', async () => {
  const db = await fixture();
  try {
    let s = await act(db, 'start'); const before = await snapshot(db);
    for (const score of [0, 11, null]) await assert.rejects(() => act(db, 'rate', s, s.currentWorkId, score), e => e.code === '22023');
    assert.deepEqual(await snapshot(db), before);
    const skipped = s.currentWorkId; s = await act(db, 'skip', s, skipped);
    assert.equal(s.round.ratedCount, 0);
    assert.equal((await rows(db, 'select * from public.ratings')).length, 0);
    assert.equal((await rows(db, 'select * from public.user_book_status')).length, 0);
    await assert.rejects(() => act(db, 'choose', s, skipped), e => e.code === '22023');
    await assert.rejects(() => act(db, 'revisit', s), e => e.code === '22023');
    await db.query("insert into public.user_book_status(user_id,work_id,status) values($1,40,'read')", [uid]);
    await assert.rejects(() => act(db, 'choose', s, 40), e => e.code === '22023');
    assert.deepEqual(await act(db, 'resume', s, null, null, 'en'), s);
  } finally { await db.close(); }
});
test('unapproved, changed metadata and wrong-language editions fail closed without progress mutation', async () => {
  const db = await fixture();
  try {
    let s = await act(db, 'start'); const current = s.currentWorkId;
    await db.exec('reset role'); await db.query("update public.editions set language='eng' where work_id=$1", [current]); await login(db);
    const before = await snapshot(db);
    await assert.rejects(() => act(db, 'rate', s, current, 9), e => e.code === '22023');
    assert.deepEqual(await snapshot(db), before);
    await db.exec('reset role'); await db.exec('delete from taste_private.eligible_inventory_v1'); await login(db);
    await assert.rejects(() => act(db, 'choose', s, 40), e => e.code === '22023');
    s = await act(db, 'skip', s, current); assert.equal(s.exhausted, true); assert.equal(s.round.complete, false);
    await assert.rejects(() => act(db, 'start', null, null, null, 'de'), e => e.code === '22023');
    await assert.rejects(() => act(db, 'start', null, null, null, 'nl', 12), e => e.code === '22023');
  } finally { await db.close(); }
});
test('only owner actions, no anonymous RPC, no public inventory access or arbitrary inventory approval', async () => {
  const db = await fixture();
  try {
    const s = await act(db, 'start');
    await assert.rejects(() => rows(db, 'select * from taste_private.eligible_inventory_v1'), e => e.code === '42501');
    await assert.rejects(() => rows(db, 'select taste_private.inventory_snapshot_v1(1)'), e => e.code === '42501');
    await assert.rejects(() => db.exec('delete from taste_private.eligible_inventory_v1'), e => e.code === '42501');
    await login(db, other);
    assert.equal((await rows(db, 'select * from public.taste_rating_rounds')).length, 0);
    await assert.rejects(() => act(db, 'rate', s, s.currentWorkId, 9), e => e.code === '22023');
    await login(db, '', 'anon');
    await assert.rejects(() => act(db, 'start'), e => e.code === '42501');
  } finally { await db.close(); }
});
test('completed-round start needs explicit current context; goals 10/15/30 and empty inventory never falsely complete', async () => {
  const db = await fixture(40);
  try {
    let s = await act(db, 'start');
    for (let n = 0; n < 10; n++) s = await act(db, 'rate', s, s.currentWorkId, 9);
    await assert.rejects(() => act(db, 'start'), e => e.code === '22023');
    s = await act(db, 'start', s, null, null, 'nl', 15); assert.equal(s.round.goal, 15);
    s = await act(db, 'extend', s, null, null, 'nl', 30); assert.equal(s.round.goal, 30);
    await db.exec('reset role'); await db.exec('delete from taste_private.eligible_inventory_v1'); await login(db);
    s = await act(db, 'skip', s, s.currentWorkId);
    assert.equal(s.exhausted, true); assert.equal(s.round.complete, false); assert.equal(s.round.ratedCount, 0);
  } finally { await db.close(); }
});
test('explicit choose after opt-in affects this round only; current-round skips cannot return through search', async () => {
  const db = await fixture(12);
  try {
    let s = await act(db, 'start'); const skipped = [];
    for (let n = 0; n < 12; n++) {
      if (n < 2) skipped.push(s.currentWorkId);
      s = await act(db, n < 2 ? 'skip' : 'rate', s, s.currentWorkId, n < 2 ? null : 8);
    }
    const historical = await rows(db, 'select * from public.taste_rating_offers order by work_id');
    const firstRound = s.round.id;
    s = await act(db, 'start', s); assert.equal(s.exhausted, true);
    s = await act(db, 'revisit', s);
    const replacement = skipped.find(id => id !== s.currentWorkId), abandoned = s.currentWorkId;
    s = await act(db, 'choose', s, replacement); assert.equal(s.currentWorkId, replacement);
    await assert.rejects(() => act(db, 'choose', s, abandoned), e => e.code === '22023');
    s = await act(db, 'rate', s, replacement, 9); assert.equal(s.round.ratedCount, 1); assert.equal(s.exhausted, true);
    assert.equal(s.round.complete, false);
    assert.deepEqual(await rows(db, 'select * from public.taste_rating_offers where round_id=$1 order by work_id', [firstRound]), historical);
    const legacy = (await rows(db, "select public.taste_rating_advance('resume',$1,null,null,'en') s", [s.round.id]))[0].s;
    assert.deepEqual(legacy, s);
  } finally { await db.close(); }
});
test('snapshot checks all evidence groups; proposal transaction failure restores the old schema and data', async () => {
  const db = await fixture(2);
  try {
    await db.exec('reset role');
    for (const change of ["update public.authors set name='Changed'", "update public.works set title='Changed' where id=1",
      "insert into public.work_catalog_categories values(1,'new-category')", "insert into public.work_trait_evidence values(1,'fantasy','manual','new-source')"]) {
      await db.exec('begin'); await db.exec(change);
      assert.equal((await rows(db, "select taste_private.inventory_current_v1(1,'nl') ok"))[0].ok, false);
      await db.exec('rollback');
      assert.equal((await rows(db, "select taste_private.inventory_current_v1(1,'nl') ok"))[0].ok, true);
    }
  } finally { await db.close(); }
  const old = await fixture(2, false);
  try {
    await act(old, 'start', null, null, null, 'nl', 10, 2); const before = await snapshot(old);
    await old.exec('reset role');
    const failingProposal = (await proposal()).replace(/commit;\s*$/, 'select 1/0; commit;');
    await assert.rejects(() => old.exec(failingProposal), e => e.code === '22012');
    await old.exec('rollback'); await login(old);
    assert.deepEqual(await snapshot(old), before);
    await old.exec('reset role');
    assert.equal((await rows(old, "select pg_get_constraintdef(oid) definition from pg_constraint where conname='taste_rating_offers_pkey'"))[0].definition, 'PRIMARY KEY (user_id, work_id)');
    assert.equal((await rows(old, "select to_regclass('taste_private.eligible_inventory_v1') absent"))[0].absent, null);
  } finally { await old.close(); }
});
