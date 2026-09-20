create table if not exists public.user_reading_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reading_periods text[] not null default '{}',
  onboarding_dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_reading_preferences_reading_periods_check check (
    reading_periods <@ array[
      'before_1950', '1950_1979', '1980_1999', '2000_2014',
      '2015_present', 'all_periods', 'no_preference'
    ]::text[]
    and cardinality(reading_periods) =
      (case when 'before_1950' = any (reading_periods) then 1 else 0 end) +
      (case when '1950_1979' = any (reading_periods) then 1 else 0 end) +
      (case when '1980_1999' = any (reading_periods) then 1 else 0 end) +
      (case when '2000_2014' = any (reading_periods) then 1 else 0 end) +
      (case when '2015_present' = any (reading_periods) then 1 else 0 end) +
      (case when 'all_periods' = any (reading_periods) then 1 else 0 end) +
      (case when 'no_preference' = any (reading_periods) then 1 else 0 end)
    and not (
      reading_periods && array['all_periods', 'no_preference']::text[]
      and cardinality(reading_periods) > 1
    )
  )
);

alter table public.user_reading_preferences enable row level security;
alter table public.user_reading_preferences force row level security;

revoke all on table public.user_reading_preferences from public, anon, authenticated;
grant select, insert, update, delete on table public.user_reading_preferences to authenticated;

create policy "reading_preferences_select_own"
on public.user_reading_preferences for select to authenticated
using ((select auth.uid()) = user_id);

create policy "reading_preferences_insert_own"
on public.user_reading_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "reading_preferences_update_own"
on public.user_reading_preferences for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "reading_preferences_delete_own"
on public.user_reading_preferences for delete to authenticated
using ((select auth.uid()) = user_id);

comment on table public.user_reading_preferences is
  'Private, optional reader publication-period preferences used as a bounded cold-start signal.';
