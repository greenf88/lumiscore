create index if not exists ratings_positive_user_work_idx
on public.ratings (user_id, work_id)
include (rating)
where rating >= 8;

create function public.get_collaborative_recommendation_signals(
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
  'Returns bounded, anonymous collaborative candidate signals for auth.uid(); never returns reader identities or rating histories.';

revoke all on function public.get_collaborative_recommendation_signals(integer)
  from public, anon;
grant execute on function public.get_collaborative_recommendation_signals(integer)
  to authenticated;
