create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  work_id bigint not null
    references public.works (id) on delete cascade,
  rating smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ratings_rating_range_check check (rating between 1 and 10),
  constraint ratings_user_work_unique unique (user_id, work_id)
);

comment on table public.ratings is
  'One whole-number LumiScore rating per authenticated user and work.';
comment on column public.ratings.rating is
  'Whole-number reader rating from 1 through 10.';

create index ratings_work_id_idx on public.ratings (work_id);

alter table public.ratings enable row level security;
alter table public.ratings force row level security;

revoke all on table public.ratings from anon, authenticated;
grant select, insert, update, delete on table public.ratings to authenticated;

create policy "ratings_select_own"
on public.ratings
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "ratings_insert_own"
on public.ratings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "ratings_update_own"
on public.ratings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "ratings_delete_own"
on public.ratings
for delete
to authenticated
using ((select auth.uid()) = user_id);

create function public.protect_rating_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.work_id is distinct from old.work_id then
    raise exception 'A rating cannot be reassigned to another user or work.'
      using errcode = '22023';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.protect_rating_identity() from public;

create trigger ratings_protect_identity_before_update
before update on public.ratings
for each row
execute function public.protect_rating_identity();

create function public.get_work_rating_summary(target_work_id bigint)
returns table (
  work_id bigint,
  lumiscore numeric(3, 1),
  rating_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    target_work_id as work_id,
    round(avg(rating)::numeric, 1)::numeric(3, 1) as lumiscore,
    count(*)::bigint as rating_count
  from public.ratings
  where ratings.work_id = target_work_id;
$$;

comment on function public.get_work_rating_summary(bigint) is
  'Returns only the public aggregate score and count for one work; never exposes individual ratings or user IDs.';

revoke all on function public.get_work_rating_summary(bigint) from public;
grant execute on function public.get_work_rating_summary(bigint)
  to anon, authenticated;
