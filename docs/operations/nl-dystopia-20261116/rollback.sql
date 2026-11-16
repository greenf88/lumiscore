-- Roll back only this batch. Review the receipt first; never widen these predicates.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $rollback$
DECLARE ids bigint[];
BEGIN
  SELECT array_agg(edition_id) INTO ids FROM public.catalog_edition_metadata
    WHERE review_batch='nl-dystopia-complete-20261116' AND work_id IN (100,179,208,2600,2717,2724,2846);
  IF cardinality(ids) IS DISTINCT FROM 7 THEN RAISE EXCEPTION 'Expected exactly seven unchanged additions'; END IF;
  IF EXISTS(SELECT 1 FROM public.editions e JOIN public.catalog_edition_metadata m ON m.edition_id=e.id
    WHERE e.id=ANY(ids) AND (e.work_id<>m.work_id OR e.title<>m.bound_title OR e.language<>m.bound_language OR e.isbn_13<>m.bound_isbn13))
    THEN RAISE EXCEPTION 'Edition identity changed after release'; END IF;
  IF (SELECT count(*) FROM public.catalog_work_descriptions WHERE review_batch='nl-dystopia-complete-20261116' AND language='nl' AND work_id IN(100,179,208,2600,2717,2724,2846))<>7
    THEN RAISE EXCEPTION 'Description batch changed after release'; END IF;
  DELETE FROM public.catalog_work_descriptions WHERE review_batch='nl-dystopia-complete-20261116' AND language='nl' AND work_id IN(100,179,208,2600,2717,2724,2846);
  DELETE FROM public.catalog_edition_metadata WHERE edition_id=ANY(ids) AND review_batch='nl-dystopia-complete-20261116';
  DELETE FROM public.editions WHERE id=ANY(ids);
  UPDATE public.works SET first_publish_year=2010 WHERE id=179 AND open_library_id='OL15719630W' AND author_id=135 AND first_publish_year=2011;
  IF NOT FOUND THEN RAISE EXCEPTION 'Publication year changed after release'; END IF;
END $rollback$;
COMMIT;
