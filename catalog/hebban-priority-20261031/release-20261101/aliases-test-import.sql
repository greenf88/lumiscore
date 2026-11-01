-- Exact target hlvujbrmfdlrfxdjwsmb; four source-reviewed aliases, no Work merge or language eligibility change.
begin;set local lock_timeout='3s';set local statement_timeout='15s';
lock table public.catalog_work_title_aliases in share row exclusive mode;

 select id from public.works where id=962100006 for update;
 select id from public.editions where id=962200008 for update;
 do $parent$ begin
 if(select to_jsonb(w)from public.works w where id=962100006)is distinct from '{"id":962100006,"title":"De zeven zussen","cover_id":null,"author_id":945300758,"work_type":null,"source_type":"open_library","open_library_id":"OL34536006W","first_publish_year":2018,"native_identity_key":null}'::jsonb then raise exception 'Alias Work identity changed';end if;
 if(select to_jsonb(e)from public.editions e where id=962200008)is distinct from '{"id":962200008,"title":"De zeven zussen","isbn_10":"9401609373","isbn_13":"9789401609371","work_id":962100006,"cover_id":null,"language":"nld","publisher":"Xander Uitgevers B.V.","publish_date":null,"open_library_edition_id":"OL46848848M"}'::jsonb then raise exception 'Alias exact edition changed or core17 missing';end if;
 end;$parent$;

 select id from public.works where id=962100005 for update;
 select id from public.editions where id=962200007 for update;
 do $parent$ begin
 if(select to_jsonb(w)from public.works w where id=962100005)is distinct from '{"id":962100005,"title":"Haar naam was Sarah / druk 59","cover_id":null,"author_id":962300004,"work_type":null,"source_type":"open_library","open_library_id":"OL29271146W","first_publish_year":2010,"native_identity_key":null}'::jsonb then raise exception 'Alias Work identity changed';end if;
 if(select to_jsonb(e)from public.editions e where id=962200007)is distinct from '{"id":962200007,"title":"Haar naam was Sarah","isbn_10":"9047201795","isbn_13":"9789047201793","work_id":962100005,"cover_id":null,"language":"nld","publisher":"Artemis & Co","publish_date":null,"open_library_edition_id":"OL40250893M"}'::jsonb then raise exception 'Alias exact edition changed or core17 missing';end if;
 end;$parent$;

 select id from public.works where id=930100049 for update;
 select id from public.editions where id=930200049 for update;
 do $parent$ begin
 if(select to_jsonb(w)from public.works w where id=930100049)is distinct from '{"id":930100049,"title":"Het achtste leven (voor Brilka)","cover_id":null,"author_id":930300049,"work_type":"novel","source_type":"lumiscore_native","open_library_id":null,"first_publish_year":null,"native_identity_key":"hetachtstelevenvoorbrilka::ninoharatischwili"}'::jsonb then raise exception 'Alias Work identity changed';end if;
 if(select to_jsonb(e)from public.editions e where id=930200049)is distinct from '{"id":930200049,"title":"Het achtste leven (voor Brilka)","isbn_10":null,"isbn_13":"9789025448417","work_id":930100049,"cover_id":null,"language":"nld","publisher":"Atlas Contact, Uitgeverij","publish_date":null,"open_library_edition_id":null}'::jsonb then raise exception 'Alias exact edition changed or core17 missing';end if;
 end;$parent$;

 select id from public.works where id=930100051 for update;
 select id from public.editions where id=930200051 for update;
 do $parent$ begin
 if(select to_jsonb(w)from public.works w where id=930100051)is distinct from '{"id":930100051,"title":"Al het blauw van de hemel","cover_id":null,"author_id":8800018,"work_type":"novel","source_type":"lumiscore_native","open_library_id":null,"first_publish_year":null,"native_identity_key":"alhetblauwvandehemel::melissadacosta"}'::jsonb then raise exception 'Alias Work identity changed';end if;
 if(select to_jsonb(e)from public.editions e where id=930200051)is distinct from '{"id":930200051,"title":"Al het blauw van de hemel","isbn_10":null,"isbn_13":"9789022340479","work_id":930100051,"cover_id":null,"language":"nld","publisher":"Standaard Uitgeverij - Algemeen","publish_date":null,"open_library_edition_id":null}'::jsonb then raise exception 'Alias exact edition changed or core17 missing';end if;
 end;$parent$;

create temporary table pr63_alias_receipt(work_id bigint,title text)on commit drop;
do $aliases$ declare expected jsonb:='[{"work_id":930100049,"title":"Das achte Leben (Für Brilka)"},{"work_id":930100051,"title":"Tout le bleu du ciel"},{"work_id":962100005,"title":"Sarah''s Key"},{"work_id":962100006,"title":"The Seven Sisters"}]'::jsonb;actual jsonb;n integer;begin
 select count(*)into n from public.catalog_work_title_aliases a where exists(select 1 from jsonb_array_elements(expected)x where a.work_id=(x->>'work_id')::bigint and a.title=x->>'title');
 if n not in(0,4)then raise exception 'Partial alias state; review instead of filling silently';end if;
 if n=0 then
 insert into public.catalog_work_title_aliases(work_id,title)select (x->>'work_id')::bigint,x->>'title'from jsonb_array_elements(expected)x;
 insert into pr63_alias_receipt select (x->>'work_id')::bigint,x->>'title'from jsonb_array_elements(expected)x;
 end if;
end;$aliases$;
select jsonb_build_object('project','hlvujbrmfdlrfxdjwsmb','batch','pr63-reviewed-original-title-aliases-20261101','changes',coalesce(jsonb_agg(to_jsonb(r)order by work_id,title),'[]'))receipt from pr63_alias_receipt r;
commit;
