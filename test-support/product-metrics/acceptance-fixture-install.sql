-- TEST DATA ONLY. Render the JSON placeholder from acceptance-fixture-v1.json.
-- Run the existing-policy validator first. No schema, rules or existing rows changed.
begin;
set local lock_timeout='2s';
do $install$
declare f jsonb := $fixture$__FIXTURE_JSON__$fixture$::jsonb;
 b jsonb; w bigint; e bigint; wanted_title text; key text; expected_traits int;
begin
 if f->>'project'<>'hlvujbrmfdlrfxdjwsmb' or f->>'fixtureId'<>'pr51-acceptance-20261028-v1'
 or not exists(select 1 from discovery_test_private.marker where identity='lumiscore-pr8-synthetic-v1')
 then raise exception 'TEST_TARGET_REQUIRED';end if;
 if jsonb_array_length(f->'books')<>9 then raise exception 'EXPECTED_NINE_FIXTURES';end if;
 -- Refuse collisions by ID or native identity, rather than overwriting public data.
 if exists(select 1 from public.authors where id=(f->'author'->>'id')::bigint
   and (name is distinct from f->'author'->>'name' or open_library_id is not null))
 then raise exception 'AUTHOR_ID_COLLISION';end if;
 insert into public.authors(id,name) values((f->'author'->>'id')::bigint,f->'author'->>'name') on conflict(id) do nothing;
 for b in select value from jsonb_array_elements(f->'books') loop
  w:=(b->>'workId')::bigint;e:=(b->>'editionId')::bigint;wanted_title:=b->>'title';key:=(f->>'fixtureId')||':'||w;
  if exists(select 1 from public.works where native_identity_key=key and id<>w) then raise exception 'NATIVE_IDENTITY_COLLISION';end if;
  if exists(select 1 from public.works where id=w and
   (title is distinct from wanted_title or author_id is distinct from (f->'author'->>'id')::bigint
    or source_type is distinct from 'lumiscore_native' or work_type is distinct from 'novel'
    or native_identity_key is distinct from key or open_library_id is not null or cover_id is not null or first_publish_year is not null))
  then raise exception 'WORK_CHANGED: %',w;end if;
  insert into public.works(id,title,author_id,source_type,work_type,native_identity_key)
   values(w,wanted_title,(f->'author'->>'id')::bigint,'lumiscore_native','novel',key) on conflict(id) do nothing;
  if exists(select 1 from public.editions where id=e and
   (work_id<>w or title is distinct from wanted_title or language is distinct from 'nld' or isbn_10 is not null
    or isbn_13 is not null or open_library_edition_id is not null or publisher is not null or publish_date is not null or cover_id is not null))
  then raise exception 'EDITION_CHANGED: %',e;end if;
  insert into public.editions(id,work_id,title,language) values(e,w,wanted_title,'nld') on conflict(id) do nothing;
  if (select count(*) from public.editions where work_id=w)<>1
    or exists(select 1 from public.collection_books where work_id=w)
    or exists(select 1 from public.work_catalog_categories where work_id=w)
  then raise exception 'UNEXPECTED_FIXTURE_METADATA: %',w;end if;
  if exists(select 1 from public.work_trait_evidence where work_id=w and
   (trait is distinct from b->>'trait' or source is distinct from 'manual' or source_key is distinct from key
    or weight<>1 or confidence<>1 or mapping_version<>'taste_traits_v1'
    or raw_labels is distinct from array['SYNTHETIC_FIXTURE',b->>'definition']
    or verified_at is distinct from (f->>'checkedAt')::timestamptz))
  then raise exception 'EVIDENCE_CHANGED: %',w;end if;
  insert into public.work_trait_evidence(work_id,trait,weight,confidence,source,source_key,raw_labels,mapping_version,verified_at,updated_at)
   values(w,b->>'trait',1,1,'manual',key,array['SYNTHETIC_FIXTURE',b->>'definition'],'taste_traits_v1',(f->>'checkedAt')::timestamptz,(f->>'checkedAt')::timestamptz)
   on conflict(work_id,trait,source,source_key) do nothing;
  select count(*) into expected_traits from public.work_trait_evidence where work_id=w;
  if expected_traits<>1 then raise exception 'EXPECTED_ONE_FIXTURE_TRAIT';end if;
  if exists(select 1 from taste_private.eligible_inventory_v1 where work_id=w and
   (language<>'nl' or edition_id<>e or policy_version<>'taste_eligibility_v1' or review_id<>f->>'fixtureId'
    or source_snapshot is distinct from taste_private.inventory_snapshot_v1(w)))
  then raise exception 'INVENTORY_CHANGED: %',w;end if;
  insert into taste_private.eligible_inventory_v1(work_id,language,edition_id,policy_version,source_snapshot,review_id,approved_at)
   values(w,'nl',e,'taste_eligibility_v1',taste_private.inventory_snapshot_v1(w),f->>'fixtureId',(f->>'checkedAt')::timestamptz)
   on conflict(language,work_id) do nothing;
  if not taste_private.inventory_current_v1(w,'nl') or taste_private.inventory_current_v1(w,'en') then raise exception 'FIXTURE_LANGUAGE_OR_SNAPSHOT_FAILED';end if;
 end loop;
end $install$;
commit;
