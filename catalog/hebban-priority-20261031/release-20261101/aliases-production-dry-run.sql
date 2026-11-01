-- Exact target qvplwejffhjvxaypmjut; four source-reviewed aliases, no Work merge or language eligibility change.
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

create temporary table pr63_alias_receipt(work_id bigint,title text)on commit drop;
do $aliases$ declare expected jsonb:='[{"work_id":1435,"title":"The Seven Sisters"},{"work_id":1440,"title":"Sarah''s Key"},{"work_id":10231,"title":"Das achte Leben (Für Brilka)"},{"work_id":10232,"title":"Tout le bleu du ciel"}]'::jsonb;actual jsonb;n integer;begin
 select count(*)into n from public.catalog_work_title_aliases a where exists(select 1 from jsonb_array_elements(expected)x where a.work_id=(x->>'work_id')::bigint and a.title=x->>'title');
 if n not in(0,4)then raise exception 'Partial alias state; review instead of filling silently';end if;
 if n=0 then
 insert into public.catalog_work_title_aliases(work_id,title)select (x->>'work_id')::bigint,x->>'title'from jsonb_array_elements(expected)x;
 insert into pr63_alias_receipt select (x->>'work_id')::bigint,x->>'title'from jsonb_array_elements(expected)x;
 end if;
end;$aliases$;
select jsonb_build_object('project','qvplwejffhjvxaypmjut','batch','pr63-reviewed-original-title-aliases-20261101','changes',coalesce(jsonb_agg(to_jsonb(r)order by work_id,title),'[]'))receipt from pr63_alias_receipt r;
rollback;
