// Local PostgreSQL simulation only; never import this module in application code.
export const fixture=`create role anon;create role authenticated;create role service_role;
alter default privileges in schema public grant execute on functions to service_role;
create schema discovery_test_private;create table discovery_test_private.marker(identity text);insert into discovery_test_private.marker values('lumiscore-pr8-synthetic-v1');
create schema auth;grant usage on schema auth to anon,authenticated;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create table public.ratings(id uuid default gen_random_uuid(),user_id uuid,work_id bigint,rating smallint check(rating between 1 and 10),primary key(user_id,work_id));
create table public.user_book_status(user_id uuid,work_id bigint,status text,primary key(user_id,work_id));
create table public.taste_rating_rounds(id uuid primary key default gen_random_uuid(),user_id uuid,goal int,completed_at timestamptz);
grant select,insert,update on public.ratings,public.user_book_status,public.taste_rating_rounds to authenticated;`;
