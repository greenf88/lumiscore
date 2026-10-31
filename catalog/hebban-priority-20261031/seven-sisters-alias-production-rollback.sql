-- Target qvplwejffhjvxaypmjut; use ONLY this alias import's FIRST nonempty COMMIT receipt.
-- Set app.pr63_alias_receipt to that exact saved JSON before executing; absent/empty receipt refuses deletion.
begin;set local lock_timeout='3s';set local statement_timeout='10s';
select id from public.works where id=1435 for update;
select id from public.editions where id=1499 for update;
do $guard$ declare r jsonb:=current_setting('app.pr63_alias_receipt',true)::jsonb;begin
 if r is null or r->>'target'<>'qvplwejffhjvxaypmjut' or r->>'batch'<>'pr63-seven-sisters-alias'
 or r->'changes' is distinct from '[{"work_id":1435,"title":"The Seven Sisters"}]'::jsonb then raise exception 'Exact own alias receipt required';end if;
 if (select to_jsonb(w) from public.works w where id=1435) is distinct from '{"id":1435,"title":"De zeven zussen","cover_id":null,"subjects":null,"subtitle":null,"author_id":758,"work_type":null,"created_at":"2026-09-16T15:08:29.849994+00:00","source_type":"open_library","open_library_id":"OL34536006W","first_publish_year":2018,"native_identity_key":null}'::jsonb then raise exception 'Later Work change; preserve';end if;
 if (select to_jsonb(e) from public.editions e where id=1499) is distinct from '{"id":1499,"title":"De zeven zussen","isbn_10":"9401609373","isbn_13":"9789401609371","work_id":1435,"language":"nld","publisher":"Xander Uitgevers B.V.","created_at":"2026-09-16T15:08:30.089585+00:00","open_library_edition_id":"OL46848848M"}'::jsonb then raise exception 'Later edition change; preserve';end if;
 if not exists(select 1 from public.catalog_work_title_aliases where work_id=1435 and title='The Seven Sisters') then raise exception 'Alias absent or changed; stop';end if;
end;$guard$;
delete from public.catalog_work_title_aliases where work_id=1435 and title='The Seven Sisters' returning *;
commit;
