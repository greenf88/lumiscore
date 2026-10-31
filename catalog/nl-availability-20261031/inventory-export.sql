-- PRODUCTION READ ONLY qvplwejffhjvxaypmjut. Public bibliography only.
-- Each query is paged at1000 using ORDER BY id OFFSET :offset LIMIT1000.
-- Export count+md5(jsonb_agg(to_jsonb(t) order by id)::text) before AND after
-- the complete page sequence; reject drift. Values are integrity fingerprints,
-- not backups. Snapshot coherence checks retained in snapshot-coherence.json.
select id,title,author_id,open_library_id,first_publish_year,work_type,source_type,native_identity_key,cover_id from public.works order by id;
select id,work_id,title,language,isbn_13,isbn_10,open_library_edition_id,publisher from public.editions order by id;
select id,name,open_library_id from public.authors order by id;
select * from public.catalog_edition_metadata order by edition_id;
select * from public.catalog_work_descriptions order by work_id,language;
select id,slug,name,collection_type,description,expected_main_series_total from public.collections order by id;
select collection_id,work_id,sequence_number,publication_order,subgroup from public.collection_books order by collection_id,work_id;
select work_id,title from public.catalog_work_title_aliases order by work_id,title;
-- SQL-selected IDs/editionIDs and exact source-body hashes are retained in
-- sql-choices-nl.json/sql-choices-en.json, not guessed by a second selector.
-- node --experimental-strip-types scripts/nl-availability-register.mjs
