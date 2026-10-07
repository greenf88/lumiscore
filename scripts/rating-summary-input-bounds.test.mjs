// Local in-memory PostgreSQL only; no credentials, network or hosted writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const sql = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const original = '20260910062625_add_batch_rating_summaries.sql';
const prepared = '20261006164920_rating_summary_input_bounds.sql';
const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';
const summary = (db, ids) => db.query('select * from public.get_work_rating_summaries($1::bigint[]) order by work_id', [ids]);
const rights = db => db.query(`select p.proowner::regrole::text as owner, p.prosecdef, p.proconfig, p.proacl::text as acl,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,
  exists(select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE') as public
  from pg_proc p where p.oid='public.get_work_rating_summaries(bigint[])'::regprocedure`);

test('prepared RPC guard preserves accepted results, ACLs and data; rejects excess raw input', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      create table public.ratings(user_id uuid,work_id bigint,rating smallint check(rating between 1 and 10),primary key(user_id,work_id));
      alter table public.ratings enable row level security; alter table public.ratings force row level security;
      create policy own_rating on public.ratings for select to authenticated using(user_id=(select auth.uid()));
      grant select on public.ratings to authenticated;
      alter default privileges in schema public grant execute on functions to anon,authenticated;`);
    await db.query('insert into public.ratings values ($1,1,9),($2,1,7),($2,2,6)', [a,b]);
    await db.exec(await sql(original));
    const before = (await db.query('select * from public.ratings order by user_id,work_id')).rows;
    const accepted = (await summary(db, [1,2,3,null,0,-1,1])).rows;
    const previousRights = (await rights(db)).rows;
    const defaults = (await db.query('select * from pg_default_acl order by oid')).rows;
    await db.exec(await sql(prepared));

    await t.test('accepted aggregation and small-cohort policy remain byte-value equivalent', async () => {
      assert.deepEqual((await summary(db, [1,2,3,null,0,-1,1])).rows, accepted);
      assert.equal(Number(accepted[0].lumiscore), 8);
      assert.equal(Number(accepted[0].rating_count), 2);
      assert.equal(Number(accepted[1].lumiscore), 6);
      assert.equal(Number(accepted[1].rating_count), 1);
    });
    await t.test('null, empty, invalid and duplicate identifiers preserve their contract', async () => {
      for (const ids of [null, [], [null,0,-1]]) assert.equal((await summary(db, ids)).rows.length, 0);
      assert.equal((await summary(db, [1,1,null,-1,0])).rows.length, 1);
      assert.equal((await db.query("select * from public.get_work_rating_summaries('[0:1]={1,2}'::bigint[])")).rows.length, 2);
      assert.equal((await db.query('select * from public.get_work_rating_summaries(array[9223372036854775807]::bigint[])')).rows.length, 1);
      await assert.rejects(() => summary(db, ['invalid-id']), e => e.code === '22P02');
    });
    await t.test('100 accepted, 101 rejected before duplicate/null filtering; multidimensional rejected', async () => {
      assert.equal((await summary(db, Array.from({length:100}, (_,i) => i+1))).rows.length, 100);
      for (const ids of [Array.from({length:101}, (_,i) => i+1), Array(101).fill(1), Array(101).fill(null)]) {
        await assert.rejects(() => summary(db, ids), e => e.code === '22023');
      }
      await assert.rejects(() => db.query('select * from public.get_work_rating_summaries(array[[1,2],[3,4]]::bigint[])'), e => e.code === '22023');
    });
    await t.test('replacement preserves effective grants, owner, definer and empty search_path', async () => {
      assert.deepEqual((await rights(db)).rows, previousRights);
      assert.deepEqual((await db.query('select * from pg_default_acl order by oid')).rows, defaults);
      assert.equal(previousRights[0].public, false);
      assert.equal(previousRights[0].anon, true);
      assert.equal(previousRights[0].authenticated, true);
      assert.equal(previousRights[0].prosecdef, true);
      assert.deepEqual(previousRights[0].proconfig, ['search_path=""']);
    });
    await t.test('real anon role can use aggregates but not read the rating table', async () => {
      await db.exec('set role anon');
      assert.equal((await summary(db, [1])).rows.length, 1);
      await assert.rejects(() => db.query('select * from public.ratings'), e => e.code === '42501');
      await assert.rejects(() => summary(db, Array(101).fill(1)), e => e.code === '22023');
      await db.exec('reset role');
    });
    await t.test('authenticated table access stays owner-isolated and RPC has no owner argument', async () => {
      for (const [user, count] of [[a,1],[b,2]]) {
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
        await db.exec('set role authenticated');
        assert.equal((await db.query('select * from public.ratings')).rows.length, count);
        assert.equal((await summary(db, [1,2])).rows.length, 2);
        await assert.rejects(() => db.query('select * from public.get_work_rating_summaries($1::bigint[], $2::uuid)', [[1],user]), e => e.code === '42883');
        await db.exec('reset role');
      }
    });
    await t.test('no rating writes, replay preserves state and exact old-definition restoration works', async () => {
      assert.deepEqual((await db.query('select * from public.ratings order by user_id,work_id')).rows, before);
      await db.exec(await sql(prepared));
      assert.deepEqual((await summary(db, [1,2,3,null,0,-1,1])).rows, accepted);
      // Restoration is tested locally only; never alter remote migration history.
      await db.exec((await sql(original)).replace('create function ', 'create or replace function '));
      assert.deepEqual((await rights(db)).rows, previousRights);
      assert.equal((await summary(db, Array.from({length:101}, (_,i) => i+1))).rows.length, 100);
      assert.deepEqual((await db.query('select * from public.ratings order by user_id,work_id')).rows, before);
    });
  } finally { await db.close(); }
});
