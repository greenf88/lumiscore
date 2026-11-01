-- Only this exact alias batch's FIRST nonempty committed receipt; never a replay/dry-run.
begin;set local lock_timeout='3s';set local statement_timeout='15s';
lock table public.catalog_work_title_aliases in share row exclusive mode;

 select id from public.works where id=1435 for update;
 select id from public.editions where id=1499 for update;
 do $parent$ begin
 if(select to_jsonb(w)from public.works w where id=1435)is distinct from '{"id":1435,"title":"De zeven zussen","cover_id":null,"subjects":null,"subtitle":null,"author_id":758,"work_type":null,"created_at":"2026-09-16T15:08:29.849994+00:00","source_type":"open_library","open_library_id":"OL34536006W","first_publish_year":2018,"native_identity_key":null}'::jsonb then raise exception 'Alias Work identity changed';end if;
 if(select to_jsonb(e)from public.editions e where id=1499)is distinct from '{"id":1499,"title":"De zeven zussen","isbn_10":"9401609373","isbn_13":"9789401609371","work_id":1435,"language":"nld","publisher":"Xander Uitgevers B.V.","created_at":"2026-09-16T15:08:30.089585+00:00","open_library_edition_id":"OL46848848M"}'::jsonb then raise exception 'Alias exact edition changed or core17 missing';end if;
 end;$parent$;

 select id from public.works where id=1440 for update;
 select id from public.editions where id=1504 for update;
 do $parent$ begin
 if(select to_jsonb(w)from public.works w where id=1440)is distinct from '{"id":1440,"title":"Haar naam was Sarah / druk 59","cover_id":null,"subjects":null,"subtitle":null,"author_id":761,"work_type":null,"created_at":"2026-09-16T15:08:41.595464+00:00","source_type":"open_library","open_library_id":"OL29271146W","first_publish_year":2010,"native_identity_key":null}'::jsonb then raise exception 'Alias Work identity changed';end if;
 if(select to_jsonb(e)from public.editions e where id=1504)is distinct from '{"id":1504,"title":"Haar naam was Sarah","isbn_10":"9047201795","isbn_13":"9789047201793","work_id":1440,"language":"nld","publisher":"Artemis & Co","created_at":"2026-09-16T15:08:41.870822+00:00","open_library_edition_id":"OL40250893M"}'::jsonb then raise exception 'Alias exact edition changed or core17 missing';end if;
 end;$parent$;

 select id from public.works where id=10231 for update;
 select id from public.editions where id=10420 for update;
 do $parent$ begin
 if(select to_jsonb(w)from public.works w where id=10231)is distinct from '{"id":10231,"title":"Het achtste leven (voor Brilka)","cover_id":null,"subjects":null,"subtitle":null,"author_id":5702,"work_type":"novel","created_at":"2026-10-31T14:31:29.28399+00:00","source_type":"lumiscore_native","open_library_id":null,"first_publish_year":null,"native_identity_key":"hetachtstelevenvoorbrilka::ninoharatischwili"}'::jsonb then raise exception 'Alias Work identity changed';end if;
 if(select to_jsonb(e)from public.editions e where id=10420)is distinct from '{"id":10420,"title":"Het achtste leven (voor Brilka)","isbn_10":null,"isbn_13":"9789025448417","work_id":10231,"language":"nld","publisher":"Atlas Contact, Uitgeverij","created_at":"2026-10-31T14:31:29.28399+00:00","open_library_edition_id":null}'::jsonb then raise exception 'Alias exact edition changed or core17 missing';end if;
 end;$parent$;

 select id from public.works where id=10232 for update;
 select id from public.editions where id=10421 for update;
 do $parent$ begin
 if(select to_jsonb(w)from public.works w where id=10232)is distinct from '{"id":10232,"title":"Al het blauw van de hemel","cover_id":null,"subjects":null,"subtitle":null,"author_id":718,"work_type":"novel","created_at":"2026-10-31T14:31:29.28399+00:00","source_type":"lumiscore_native","open_library_id":null,"first_publish_year":null,"native_identity_key":"alhetblauwvandehemel::melissadacosta"}'::jsonb then raise exception 'Alias Work identity changed';end if;
 if(select to_jsonb(e)from public.editions e where id=10421)is distinct from '{"id":10421,"title":"Al het blauw van de hemel","isbn_10":null,"isbn_13":"9789022340479","work_id":10232,"language":"nld","publisher":"Standaard Uitgeverij - Algemeen","created_at":"2026-10-31T14:31:29.28399+00:00","open_library_edition_id":null}'::jsonb then raise exception 'Alias exact edition changed or core17 missing';end if;
 end;$parent$;

do $guard$ declare r jsonb:=nullif(current_setting('app.pr63_current_alias_receipt',true),'')::jsonb;actual jsonb;begin
 if r->>'project' is distinct from 'qvplwejffhjvxaypmjut' or r->>'batch' is distinct from 'pr63-reviewed-original-title-aliases-20261101' or r->'changes' is distinct from '[{"work_id":1435,"title":"The Seven Sisters"},{"work_id":1440,"title":"Sarah''s Key"},{"work_id":10231,"title":"Das achte Leben (Für Brilka)"},{"work_id":10232,"title":"Tout le bleu du ciel"}]'::jsonb then raise exception 'Exact first committed four-alias receipt required';end if;
 select jsonb_agg(to_jsonb(a)order by work_id,title)into actual from public.catalog_work_title_aliases a where exists(select 1 from jsonb_array_elements(r->'changes')x where a.work_id=(x->>'work_id')::bigint and a.title=x->>'title');
 if actual is distinct from r->'changes'then raise exception 'Alias absent or changed; preserve';end if;
end;$guard$;
delete from public.catalog_work_title_aliases a where exists(select 1 from jsonb_array_elements(current_setting('app.pr63_current_alias_receipt')::jsonb->'changes')x where a.work_id=(x->>'work_id')::bigint and a.title=x->>'title');
commit;
