import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { permissionsMigration } from '../../scripts/discovery-permissions.mjs';
const migration = '20261003183631_discovery_taste_rounds.sql';
const sql = async file => readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8');
export const a = '00000000-0000-4000-8000-000000000001';
export const b = '00000000-0000-4000-8000-000000000002';
export async function fixture({ correctPermissions = true } = {}) {
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
export async function asUser(db, id = a) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('set role authenticated');
}
export const state = async db => (await db.query('select public.taste_rating_state() as state')).rows[0].state;
export const act = async (db, action, r = null, work = null, score = null, language = 'en') => (await db.query(
  'select public.taste_rating_advance($1,$2,$3,$4,$5) as state', [action,r,work,score,language])).rows[0].state;
