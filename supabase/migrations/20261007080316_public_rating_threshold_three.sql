-- User-approved public-score threshold: three distinct raters, not three ratings by one person.
-- Forward-only replacement; preserve existing data, roles, RLS and collaborative peer threshold.
begin;

create or replace function public.get_work_rating_summaries_v2(target_work_ids bigint[])
returns table(work_id bigint, lumiscore numeric(3,1), rating_count_band text, evidence_status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(cardinality(target_work_ids),0)>100 or coalesce(array_ndims(target_work_ids),1)>1 then
    raise exception using errcode='22023', message='target_work_ids must be a one-dimensional array of at most 100 values';
  end if;
  return query with ids as (
    select distinct id from unnest(target_work_ids) id where id>0
  ), aggregates as (
    select ids.id, count(distinct r.user_id) as n, round(avg(r.rating)::numeric,1)::numeric(3,1) as score
    from ids left join public.ratings r on r.work_id=ids.id group by ids.id
  ) select a.id, case when a.n>=3 then a.score end,
    case when a.n<3 then null when a.n<5 then '3–4' when a.n<10 then '5–9' when a.n<20 then '10–19'
      when a.n<50 then '20–49' else '50+' end,
    case when a.n>=3 then 'available' else 'insufficient_evidence' end
  from aggregates a;
end;
$$;

-- Preserve the deliberately public, bounded aggregate API; never grant raw rating access.
revoke all on function public.get_work_rating_summaries_v2(bigint[]) from public, anon, authenticated;
grant execute on function public.get_work_rating_summaries_v2(bigint[]) to anon, authenticated;
comment on function public.get_work_rating_summaries_v2(bigint[]) is
  'Public score from three distinct raters; count bands only, bounded input. Not an anonymity guarantee.';
comment on function public.get_work_rating_summary(bigint) is
  'Public score from three distinct raters via V2; exact counts withheld. Not an anonymity guarantee.';
comment on function public.get_work_rating_summaries(bigint[]) is
  'Compatibility API: public score from three distinct raters via V2; exact counts withheld; bounded input.';

commit;
