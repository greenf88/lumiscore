-- Target qvplwejffhjvxaypmjut. Source-bound title alias ONLY. Execute core17 corrections first.
begin;set local lock_timeout='3s';set local statement_timeout='10s';
select id from public.works where id=1435 for update;
select id from public.editions where id=1499 for update;
do $guard$ begin
 if (select to_jsonb(w) from public.works w where id=1435) is distinct from '{"id":1435,"title":"De zeven zussen","cover_id":null,"subjects":null,"subtitle":null,"author_id":758,"work_type":null,"created_at":"2026-09-16T15:08:29.849994+00:00","source_type":"open_library","open_library_id":"OL34536006W","first_publish_year":2018,"native_identity_key":null}'::jsonb then raise exception 'Alias Work identity drift';end if;
 if (select to_jsonb(e) from public.editions e where id=1499) is distinct from '{"id":1499,"title":"De zeven zussen","isbn_10":"9401609373","isbn_13":"9789401609371","work_id":1435,"language":"nld","publisher":"Xander Uitgevers B.V.","created_at":"2026-09-16T15:08:30.089585+00:00","open_library_edition_id":"OL46848848M"}'::jsonb then raise exception 'Alias edition drift or core import missing';end if;
end;$guard$;
with inserted as (insert into public.catalog_work_title_aliases(work_id,title)
 values(1435,'The Seven Sisters') on conflict do nothing returning *)
select jsonb_build_object('target','qvplwejffhjvxaypmjut','batch','pr63-seven-sisters-alias',
 'changes',coalesce((select jsonb_agg(to_jsonb(i)) from inserted i),'[]'::jsonb)) as receipt;
rollback;
