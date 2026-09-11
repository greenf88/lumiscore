create function public.get_work_rating_summaries(target_work_ids bigint[])
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
  with requested as (
    select distinct requested_work_id as work_id
    from unnest(coalesce(target_work_ids, '{}'::bigint[])) as requested_work_id
    where requested_work_id > 0
    limit 100
  )
  select
    requested.work_id,
    round(avg(ratings.rating)::numeric, 1)::numeric(3, 1) as lumiscore,
    count(ratings.rating)::bigint as rating_count
  from requested
  left join public.ratings as ratings
    on ratings.work_id = requested.work_id
  group by requested.work_id;
$$;

comment on function public.get_work_rating_summaries(bigint[]) is
  'Returns only public aggregate scores and counts for up to 100 works; never exposes individual ratings or user IDs.';

revoke all on function public.get_work_rating_summaries(bigint[]) from public;
grant execute on function public.get_work_rating_summaries(bigint[])
  to anon, authenticated;
