-- TEST DATA ONLY. Render the JSON placeholder from acceptance-fixture-v1.json.
-- First sign out, revoke analytics and clean only the exact disposable actor.
begin;
set local lock_timeout='2s';
do $cleanup$
declare f jsonb := $fixture$__FIXTURE_JSON__$fixture$::jsonb;
 ids bigint[];fixture_author_id bigint; b jsonb; w bigint;e bigint;n int;k text;
begin
 if f->>'project'<>'hlvujbrmfdlrfxdjwsmb' or f->>'fixtureId'<>'pr51-acceptance-20261028-v1'
 or not exists(select 1 from discovery_test_private.marker where identity='lumiscore-pr8-synthetic-v1')
 then raise exception 'TEST_TARGET_REQUIRED';end if;
 select array_agg(value::bigint) into ids from jsonb_array_elements_text(f->'cleanup'->'workIds');
 fixture_author_id:=(f->'author'->>'id')::bigint;
 if cardinality(ids)<>9 or jsonb_array_length(f->'books')<>9 then raise exception 'EXPECTED_NINE_FIXTURES';end if;
 lock table public.works,public.editions,public.authors,public.work_trait_evidence,taste_private.eligible_inventory_v1 in share row exclusive mode;
 if not exists(select 1 from public.works where id=any(ids))
  and not exists(select 1 from public.editions where id=any(ids) or work_id=any(ids))
  and not exists(select 1 from public.authors where id=fixture_author_id)
  and not exists(select 1 from public.work_trait_evidence where work_id=any(ids))
  and not exists(select 1 from taste_private.eligible_inventory_v1 where work_id=any(ids)) then return;end if;
 if (select count(*) from public.works where id=any(ids))<>9
  or (select count(*) from public.editions where id=any(ids) and work_id=any(ids))<>9
  or (select count(*) from public.work_trait_evidence where work_id=any(ids))<>9
  or (select count(*) from taste_private.eligible_inventory_v1 where work_id=any(ids))<>9
 then raise exception 'PARTIAL_OR_CHANGED_FIXTURE';end if;
 if not exists(select 1 from public.authors a where a.id=fixture_author_id and a.name=f->'author'->>'name' and a.open_library_id is null)
 or exists(select 1 from public.works x where x.author_id=fixture_author_id and x.id<>all(ids))
 then raise exception 'AUTHOR_CHANGED_OR_SHARED';end if;
 if exists(select 1 from public.ratings where work_id=any(ids))
  or exists(select 1 from public.user_book_status where work_id=any(ids))
  or exists(select 1 from public.taste_rating_offers where work_id=any(ids))
  or exists(select 1 from public.collection_books where work_id=any(ids))
  or exists(select 1 from public.work_cover_resolutions where work_id=any(ids))
  or exists(select 1 from public.work_catalog_categories where work_id=any(ids))
  or exists(select 1 from public.catalog_selection_members where work_id=any(ids))
  or exists(select 1 from public.catalog_work_title_aliases where work_id=any(ids))
  or exists(select 1 from catalog_private.editorial_records where work_id=any(ids))
 then raise exception 'REFERENCED_FIXTURE_STOP_AND_REVIEW_EXACT_ROWS';end if;
 for b in select value from jsonb_array_elements(f->'books') loop
  w:=(b->>'workId')::bigint;e:=(b->>'editionId')::bigint;k:=(f->>'fixtureId')||':'||w;
  if not exists(select 1 from public.works x where x.id=w and x.title=b->>'title' and x.author_id=fixture_author_id
   and x.source_type='lumiscore_native' and x.work_type='novel' and x.native_identity_key=k
   and x.open_library_id is null and x.cover_id is null and x.first_publish_year is null)
  then raise exception 'WORK_CHANGED: %',w;end if;
  if not exists(select 1 from public.editions x where x.id=e and x.work_id=w and x.title=b->>'title'
   and x.language='nld' and x.isbn_10 is null and x.isbn_13 is null and x.open_library_edition_id is null
   and x.publisher is null and x.publish_date is null and x.cover_id is null)
   or (select count(*) from public.editions where work_id=w)<>1 then raise exception 'EDITION_CHANGED: %',e;end if;
  if not exists(select 1 from public.work_trait_evidence x where x.work_id=w and x.trait=b->>'trait'
   and x.source='manual' and x.source_key=k and x.weight=1 and x.confidence=1 and x.mapping_version='taste_traits_v1'
   and x.raw_labels=array['SYNTHETIC_FIXTURE',b->>'definition'] and x.verified_at=(f->>'checkedAt')::timestamptz)
  then raise exception 'EVIDENCE_CHANGED: %',w;end if;
  if not exists(select 1 from taste_private.eligible_inventory_v1 x where x.work_id=w and x.edition_id=e
   and x.language='nl' and x.review_id=f->>'fixtureId' and x.policy_version='taste_eligibility_v1'
   and x.source_snapshot=taste_private.inventory_snapshot_v1(w)) then raise exception 'INVENTORY_CHANGED: %',w;end if;
 end loop;
 delete from taste_private.eligible_inventory_v1 where work_id=any(ids) and review_id=f->>'fixtureId';get diagnostics n=row_count;if n<>9 then raise exception 'INVENTORY_DELETE_COUNT';end if;
 delete from public.work_trait_evidence where work_id=any(ids) and source='manual' and source_key=(f->>'fixtureId')||':'||work_id;get diagnostics n=row_count;if n<>9 then raise exception 'EVIDENCE_DELETE_COUNT';end if;
 delete from public.editions where id=any(ids) and work_id=any(ids);get diagnostics n=row_count;if n<>9 then raise exception 'EDITION_DELETE_COUNT';end if;
 delete from public.works where id=any(ids);get diagnostics n=row_count;if n<>9 then raise exception 'WORK_DELETE_COUNT';end if;
 delete from public.authors where id=fixture_author_id and name=f->'author'->>'name';get diagnostics n=row_count;if n<>1 then raise exception 'AUTHOR_DELETE_COUNT';end if;
end $cleanup$;
commit;
