-- Review preparation only: bound the existing RPC contract, not score publication.
begin;

create or replace function public.get_work_rating_summaries(target_work_ids bigint[])
returns table (
  work_id bigint,
  lumiscore numeric(3, 1),
  rating_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Bound raw input, including duplicates/nulls, before unnest or aggregation.
  if coalesce(cardinality(target_work_ids), 0) > 100
    or coalesce(array_ndims(target_work_ids), 1) > 1 then
    raise exception using
      errcode = '22023',
      message = 'target_work_ids must be a one-dimensional array of at most 100 values';
  end if;

  return query
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
end;
$$;

comment on function public.get_work_rating_summaries(bigint[]) is
  'Public aggregate scores and counts for at most 100 input values; no user IDs. Small-cohort aggregates can reveal rating values; publication policy is unchanged.';

-- Preserve the reviewed guest/authenticated contract, without PUBLIC execution.
revoke all on function public.get_work_rating_summaries(bigint[]) from public;
grant execute on function public.get_work_rating_summaries(bigint[]) to anon, authenticated;

commit;
