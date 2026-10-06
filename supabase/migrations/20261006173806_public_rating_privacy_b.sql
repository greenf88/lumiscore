-- Privacy B. Forward-only function changes; no data writes or default privilege changes.
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
  ) select a.id, case when a.n>=5 then a.score end,
    case when a.n<5 then null when a.n<10 then '5–9' when a.n<20 then '10–19'
      when a.n<50 then '20–49' else '50+' end,
    case when a.n>=5 then 'available' else 'insufficient_evidence' end
  from aggregates a;
end;
$$;
revoke all on function public.get_work_rating_summaries_v2(bigint[]) from public, anon, authenticated;
grant execute on function public.get_work_rating_summaries_v2(bigint[]) to anon, authenticated;

-- Keep old RPC signatures/dependencies but never disclose an exact count, even above threshold.
create or replace function public.get_work_rating_summaries(target_work_ids bigint[])
returns table(work_id bigint,lumiscore numeric(3,1),rating_count bigint)
language sql stable security definer set search_path = '' as $$
  select s.work_id,s.lumiscore,null::bigint from public.get_work_rating_summaries_v2(target_work_ids) s;
$$;
create or replace function public.get_work_rating_summary(target_work_id bigint)
returns table(work_id bigint,lumiscore numeric(3,1),rating_count bigint)
language sql stable security definer set search_path = '' as $$
  select s.work_id,s.lumiscore,null::bigint from public.get_work_rating_summaries_v2(array[target_work_id]) s;
$$;
comment on function public.get_work_rating_summary(bigint) is 'Privacy B: score from five distinct raters; exact counts withheld. Not an anonymity guarantee.';
comment on function public.get_work_rating_summaries(bigint[]) is 'Privacy B compatibility API: score from five distinct raters, exact counts always withheld; bounded raw input.';
revoke all on function public.get_work_rating_summary(bigint), public.get_work_rating_summaries(bigint[]) from public, anon, authenticated;
grant execute on function public.get_work_rating_summary(bigint), public.get_work_rating_summaries(bigint[]) to anon, authenticated;

create or replace function public.catalog_discovery_page(
  p_query text default '', p_categories text[] default '{}',
  p_selection text default '', p_languages text[] default '{}',
  p_sort text default 'az', p_page integer default 1,
  p_page_size integer default 32, p_alias_ids bigint[] default '{}',
  p_author_id bigint default null
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with args as (
    select left(trim(coalesce(p_query,'')),100) as q,
      case when p_page_size in (32,64,128) then p_page_size else 32 end as size
  ), base as materialized (
    select w.id,w.title,w.first_publish_year from public.works w
    left join public.authors a on a.id=w.author_id cross join args
    where (p_author_id is null or w.author_id=p_author_id)
    and (args.q='' or position(lower(args.q) in lower(w.title))>0
      or position(lower(args.q) in lower(a.name))>0
      or w.id=any(coalesce(p_alias_ids,'{}'))
      or exists(select 1 from public.catalog_work_title_aliases alias where alias.work_id=w.id
        and position(lower(args.q) in lower(alias.title))>0)
      or exists(select 1 from public.editions e where e.work_id=w.id
        and position(lower(args.q) in lower(e.title))>0))
    and (coalesce(p_selection,'')='' or exists(
      select 1 from public.catalog_selection_members m where m.work_id=w.id and m.selection_slug=p_selection))
    and (coalesce(cardinality(p_languages),0)=0 or exists(
      select 1 from public.editions e where e.work_id=w.id and
        (('nl'=any(p_languages) and lower(e.language) in ('nl','nld','dut'))
        or ('en'=any(p_languages) and lower(e.language) in ('en','eng')))))
  ), filtered as materialized (
    select * from base b where coalesce(cardinality(p_categories),0)=0 or exists(
      select 1 from public.work_catalog_categories c where c.work_id=b.id and c.category_id=any(p_categories))
  ), summary_batches as (
    select array_agg(id) as ids from (
      select id,(row_number() over(order by id)-1)/100 as batch from filtered where p_sort='highest'
    ) numbered group by batch
  ), summaries as materialized (
    -- Reuse the existing public aggregate, never expose individual ratings.
    select s.* from summary_batches b cross join lateral public.get_work_rating_summaries(b.ids) s
  ), ranked as materialized (
    select f.*,s.lumiscore from filtered f left join summaries s on s.work_id=f.id

  ), stats as (select count(*) as total from ranked), paging as (
    select total,size,greatest(1,ceil(total::numeric/size)::integer) as pages,
      least(greatest(1,coalesce(p_page,1)),greatest(1,ceil(total::numeric/size)::integer)) as page
    from stats cross join args
  ), results as (
    select f.id, row_number() over(order by
      case when p_sort='highest' then f.lumiscore end desc nulls last,
            case when p_sort='newest' then f.first_publish_year end desc nulls last,
      lower(f.title),f.id) as position
    from ranked f order by position
    limit (select size from paging) offset (select (page::bigint-1)*size from paging)
  ), facets as (
    select c.id,count(distinct b.id) as count from public.catalog_categories c
    left join public.work_catalog_categories wc on wc.category_id=c.id
    left join base b on b.id=wc.work_id group by c.id
  )
  select jsonb_build_object('workIds',coalesce((select jsonb_agg(id order by position) from results),'[]'::jsonb),
    'total',total,'page',page,'pageSize',size,'pageCount',pages,
    'selectionCount',(select count(*) from public.catalog_selection_members where selection_slug='lumiscore-selectie-1000'),
    'facets',coalesce((select jsonb_object_agg(id,count) from facets),'{}'::jsonb)) from paging;
$$;
revoke all on function public.catalog_discovery_page(text,text[],text,text[],text,integer,integer,bigint[],bigint) from public;
grant execute on function public.catalog_discovery_page(text,text[],text,text[],text,integer,integer,bigint[],bigint) to anon, authenticated;


create or replace function public.get_collaborative_recommendation_signals(
  candidate_limit integer default 100
)
returns table (
  work_id bigint,
  collaborative_score double precision,
  collaborative_weight double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  with request_context as (
    select auth.uid() as target_user_id
  ),
  my_likes as (
    select ratings.work_id
    from public.ratings
    cross join request_context
    where ratings.user_id = request_context.target_user_id
      and ratings.rating >= 8
  ),
  eligible_target as (
    select count(*) >= 2 as has_enough_likes
    from my_likes
  ),
  similar_readers as (
    select
      ratings.user_id,
      count(*)::integer as shared_like_count,
      least(1::numeric, count(*)::numeric / 4) as similarity_strength
    from public.ratings
    join my_likes using (work_id)
    cross join request_context
    where ratings.user_id <> request_context.target_user_id
      and ratings.rating >= 8
    group by ratings.user_id
    having count(*) >= 2
  ),
  candidate_support as (
    select
      candidate_ratings.work_id,
      similar_readers.user_id,
      similar_readers.shared_like_count,
      similar_readers.similarity_strength,
      least(
        1::numeric,
        .6::numeric + (candidate_ratings.rating - 8)::numeric * .2
      ) as candidate_preference
    from similar_readers
    join public.ratings as candidate_ratings
      on candidate_ratings.user_id = similar_readers.user_id
    cross join request_context
    cross join eligible_target
    where eligible_target.has_enough_likes
      and candidate_ratings.rating >= 8
      and not exists (
        select 1
        from public.ratings as target_ratings
        where target_ratings.user_id = request_context.target_user_id
          and target_ratings.work_id = candidate_ratings.work_id
      )
  ),
  candidate_aggregates as (
    select
      candidate_support.work_id,
      count(*)::integer as supporter_count,
      max(candidate_support.shared_like_count) as maximum_shared_likes,
      sum(candidate_support.similarity_strength) as similarity_weight,
      sum(
        candidate_support.similarity_strength *
        candidate_support.candidate_preference
      ) as weighted_preference
    from candidate_support
    group by candidate_support.work_id
    having count(distinct candidate_support.user_id) >= 5
  )
  select
    candidate_aggregates.work_id,
    least(
      1::numeric,
      greatest(
        0::numeric,
        (candidate_aggregates.weighted_preference + 1.1) /
          (candidate_aggregates.similarity_weight + 2)
      )
    )::double precision as collaborative_score,
    least(
      .15::numeric,
      .03::numeric +
        greatest(0, candidate_aggregates.supporter_count - 1)::numeric * .025 +
        greatest(0, candidate_aggregates.maximum_shared_likes - 2)::numeric * .015
    )::double precision as collaborative_weight
  from candidate_aggregates
  order by collaborative_weight desc, collaborative_score desc, work_id
  limit least(greatest(coalesce(candidate_limit, 100), 1), 100);
$$;

comment on function public.get_collaborative_recommendation_signals(integer) is
  'Owner-scoped collaborative signals only with at least five distinct contributing peers; not an anonymity guarantee.';

revoke all on function public.get_collaborative_recommendation_signals(integer)
  from public, anon;
grant execute on function public.get_collaborative_recommendation_signals(integer)
  to authenticated;


commit;
