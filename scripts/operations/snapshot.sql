-- LumiScore operations: SELECT only. Run via the authorized Supabase connector.
-- Internal aggregate report; do not publish small reader counts in the public repo.
select jsonb_build_object(
  'schemaVersion', 1,
  'capturedAt', now(),
  'project', 'lumiscore-production',
  'metrics', jsonb_build_object(
    'works', (select count(*) from public.works),
    'collections', (select count(*) from public.collections),
    'ratings', (select count(*) from public.ratings),
    'ratingAccounts', (select count(distinct user_id) from public.ratings),
    'ratedWorks', (select count(distinct work_id) from public.ratings),
    'traitWorks', (select count(distinct work_id) from public.work_trait_evidence),
    'contentTraitWorks', (select count(distinct work_id) from public.work_trait_evidence
      where trait not in ('classic','contemporary')),
    'completedRounds', (select count(*) from public.taste_rating_rounds where completed_at is not null)
  ),
  'coverStates', (select coalesce(jsonb_object_agg(state,n),'{}'::jsonb)
    from (select state,count(*) n from public.work_cover_resolutions group by state)s),
  'coverRetryDue', (select count(*) from public.work_cover_resolutions
    where state='temporary_failure' and (retry_after is null or retry_after<=now())),
  'coverTemporaryWithoutResolved', (select count(distinct a.work_id)
    from public.work_cover_resolutions a where a.state='temporary_failure'
    and not exists(select 1 from public.work_cover_resolutions b
      where b.work_id=a.work_id and b.state='resolved')),
  'invalidMemberships', (select count(*) from public.collection_books cb
    left join public.works w on w.id=cb.work_id
    left join public.collections c on c.id=cb.collection_id
    where w.id is null or c.id is null),
  'missingAuthors', (select count(*) from public.works w
    left join public.authors a on a.id=w.author_id where a.id is null),
  'duplicateOpenLibraryIds', (select count(*) from(select open_library_id
    from public.works where open_library_id is not null
    group by open_library_id having count(*)>1)s),
  'emptyTitles', (select count(*) from public.works where title is null or btrim(title)=''),
  'collectionCoverage', (select coalesce(jsonb_agg(jsonb_build_object(
    'slug',c.slug,'type',c.collection_type,'expected',c.expected_main_series_total,
    'catalogued',(select count(distinct cb.work_id)
      from public.collection_books cb where cb.collection_id=c.id)) order by c.slug),'[]'::jsonb)
    from public.collections c)
) as snapshot;
