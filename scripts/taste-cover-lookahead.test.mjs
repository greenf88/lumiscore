// In-process disposable PostgreSQL only. No environment, network or live users.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fixture, asUser, state, a, b } from '../test-support/taste-results/fixture.mjs';
const proposal = await readFile(new URL('./operations/taste-cover-lookahead.sql', import.meta.url), 'utf8');
const flexible = await readFile(new URL('../supabase/migrations/20261004164419_flexible_taste_rounds.sql', import.meta.url), 'utf8');
const advance = async (db, action, s, language = 'en') => (await db.query('select public.taste_rating_advance_v2($1,$2,$3,$4,$5,10) as state', [action, s?.round?.id ?? null, s?.currentWorkId ?? null, action === 'rate' ? 8 : null, language])).rows[0].state;
const peek = async (db, s) => (await db.query('select public.taste_rating_cover_lookahead($1,$2) as hint', [s.round.id, s.currentWorkId])).rows[0].hint;
test('advisory ranking/filter matches existing next-selection SQL; no chooser/writes changed', () => {
  const normalize = s => s.replace(/r\.user_id/g, 'uid').replace(/\s/g, '');
  const old = flexible.slice(flexible.lastIndexOf('select w.id into next_work')).match(/where not exists[\s\S]*?limit 1/)?.[0];
  const hint = proposal.match(/    where not exists[\s\S]*?limit 1/)?.[0];
  assert.ok(old && hint); assert.equal(normalize(hint.trim()), normalize(old));
  assert.doesNotMatch(proposal, /create or replace|insert into|update public|delete from/i);
});
test('read-only lookahead matches two saves/skip, cannot advance/write or read another owner; NL/EN', async () => {
  const db = await fixture();
  try {
    await db.exec(flexible); await db.exec(proposal);
    for (const fn of ['public.taste_rating_cover_lookahead(uuid,bigint)', 'taste_private.cover_lookahead(uuid,bigint)']) {
      assert.equal((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') as allowed', ['anon', fn])).rows[0].allowed, false);
      assert.equal((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') as allowed', ['authenticated', fn])).rows[0].allowed, true);
    }
    for (const language of ['en', 'nl']) {
      await asUser(db, language === 'en' ? a : b);
      let s = await advance(db, 'start', null, language);
      for (const action of ['rate', 'rate', 'skip']) {
        const before = await state(db), start = performance.now();
        await db.exec('begin read only'); const h = await peek(db, s); await db.exec('commit');
        assert.ok(h?.workId); assert.equal(h.locale, language); assert.notEqual(h.workId, s.currentWorkId);
        assert.deepEqual(await state(db), before);
        const count = (await db.query('select count(*)::int as n from public.ratings')).rows[0].n;
        const old = s; s = await advance(db, action, s, language);
        assert.equal(s.currentWorkId, h.workId); assert.equal(await peek(db, old), null, 'old currentWork cannot be used after save/skip');
        assert.equal((await db.query('select count(*)::int as n from public.ratings')).rows[0].n, count + (action === 'rate' ? 1 : 0));
        console.log(JSON.stringify({ syntheticWorks: 10134, language, action, lookaheadAndSaveMs: Math.round(performance.now() - start) }));
      }
      const own = s; await asUser(db, language === 'en' ? b : a); assert.equal(await peek(db, own), null); await asUser(db, language === 'en' ? a : b);
      await db.exec('reset role'); assert.equal((await db.query("select rating from public.ratings where user_id=$1 and work_id=1", [a])).rows[0].rating, 6);
    }
    await db.exec('set role anon'); await assert.rejects(() => peek(db, { round: { id: 'aaaaaaaa-0000-4000-8000-000000000001' }, currentWorkId: '1' }), /permission denied/);
  } finally { await db.close(); }
});
test('existing v3 test inventory, read exclusion and explicit old-skip policy are respected without altering storage', async () => {
  const db = await fixture();
  try {
    await db.exec(flexible); await db.exec(proposal); await asUser(db, a);
    const s = await advance(db, 'start', null);
    await db.exec('reset role');
    // Disposable capability stub: not the parked storage implementation.
    await db.exec(`alter table public.taste_rating_rounds add column revisit_prior_skips boolean not null default false;
      create table taste_private.eligible_inventory_v1(work_id bigint, language text);
      insert into taste_private.eligible_inventory_v1 values(2,'en'),(3,'en'),(4,'en'),(6,'en');
      create function taste_private.inventory_current_v1(bigint,text) returns boolean language sql stable as $$select $1<>4$$;
      create function taste_private.advance_round_v3(text,uuid,bigint,integer,text,integer) returns jsonb language sql as $$select null::jsonb$$;
      create or replace function taste_private.advance_round_v2(p_action text,p_round_id uuid,p_work_id bigint,p_score integer,p_language text,p_goal integer) returns jsonb language sql as $$select taste_private.advance_round_v3($1,$2,$3,$4,$5,$6)$$;`);
    await db.query("insert into public.user_book_status(user_id,work_id,status) values($1,2,'read') on conflict(user_id,work_id) do update set status='read'", [a]);
    await asUser(db, a); await db.exec('begin read only');
    assert.equal((await peek(db,s)).workId,'3'); await db.exec('commit');
    await db.exec('reset role');
    await db.query('update public.taste_rating_rounds set round_number=2 where id=$1',[s.round.id]);
    const old = (await db.query('insert into public.taste_rating_rounds(user_id,round_number,language,completed_at) values($1,1,\'en\',now()) returning id',[a])).rows[0].id;
    await db.query("insert into public.taste_rating_offers(user_id,round_id,work_id,decision) values($1,$2,3,'skipped')",[a,old]);
    await asUser(db,a); assert.equal((await peek(db,s)).workId,'6','old skips cannot return without explicit permission');
    await db.exec('reset role'); await db.query('update public.taste_rating_rounds set revisit_prior_skips=true where id=$1',[s.round.id]);
    await asUser(db,a); assert.equal((await peek(db,s)).workId,'3');
    assert.equal((await state(db)).round.ratedCount,0); assert.equal((await state(db)).currentWorkId,s.currentWorkId);
  } finally { await db.close(); }
});
