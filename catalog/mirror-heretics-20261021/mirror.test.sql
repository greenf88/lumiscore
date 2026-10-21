-- APPROVED TEST ONLY hlvujbrmfdlrfxdjwsmb.
-- Additive/idempotent; no existing record update/delete or schema change. Full dates remain in reviewed.json for production (no date column).
begin isolation level repeatable read;set local lock_timeout='3s';set local statement_timeout='20s';
do $catalog$
declare matches integer;before_users jsonb;after_users jsonb;
begin
 select jsonb_build_object('ratings',(select md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' order by md5(to_jsonb(r)::text)),'')) from public.ratings r),'statuses',(select md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' order by md5(to_jsonb(s)::text)),'')) from public.user_book_status s)) into before_users;

 if not exists(select 1 from public.collections where id=32 and slug='once-upon-a-broken-heart' and collection_type='series' and expected_main_series_total=3) then raise exception 'Trilogy identity/denominator changed';end if;

 if exists(select 1 from public.authors where (id=735 or name ilike 'Stephanie Garber' or open_library_id='OL7387659A') and not(id=735 and name='Stephanie Garber' and open_library_id='OL7387659A')) then raise exception 'Author collision';end if;
 if not exists(select 1 from public.authors where id=735) then insert into public.authors(id,name,open_library_id) values(735,'Stephanie Garber','OL7387659A');end if;
 if exists(select 1 from public.works where (id=10138 or title ilike '%mirror%infinite%' or open_library_id='OL45033863W') and not(id=10138 and title='The Mirror of Infinite Endings' and author_id=735 and open_library_id='OL45033863W' and first_publish_year=2026)) then raise exception 'Work duplicate/collision';end if;
 if not exists(select 1 from public.works where id=10138) then insert into public.works(id,title,author_id,open_library_id,first_publish_year,source_type) values(10138,'The Mirror of Infinite Endings',735,'OL45033863W',2026,'open_library');end if;


 select count(*) into matches from public.editions where isbn_13='9781250462039' or open_library_edition_id='OL61433279M';
 if matches>1 then raise exception 'Duplicate edition requires review';end if;
 if matches=1 then
  if not exists(select 1 from public.editions where work_id=10138 and isbn_13='9781250462039' and title='The Mirror of Infinite Endings' and language='eng' and publisher='Flatiron Books' and open_library_edition_id is not distinct from 'OL61433279M') then raise exception 'Conflicting edition identity; no overwrite';end if;
 else
  if exists(select 1 from public.editions where id=91021202) then raise exception 'Test edition ID occupied';end if;
  insert into public.editions(id,work_id,title,isbn_13,language,publisher,open_library_edition_id,publish_date) values(91021202,10138,'The Mirror of Infinite Endings','9781250462039','eng','Flatiron Books','OL61433279M','2026-09-22');
 end if;

 select count(*) into matches from public.editions where isbn_13='9781399641777';
 if matches>1 then raise exception 'Duplicate edition requires review';end if;
 if matches=1 then
  if not exists(select 1 from public.editions where work_id=10138 and isbn_13='9781399641777' and title='The Mirror of Infinite Endings' and language='eng' and publisher='Orion' and open_library_edition_id is not distinct from null) then raise exception 'Conflicting edition identity; no overwrite';end if;
 else
  if exists(select 1 from public.editions where id=91021203) then raise exception 'Test edition ID occupied';end if;
  insert into public.editions(id,work_id,title,isbn_13,language,publisher,open_library_edition_id,publish_date) values(91021203,10138,'The Mirror of Infinite Endings','9781399641777','eng','Orion',null,'2026-09-29');
 end if;
 if exists(select 1 from public.collection_books where collection_id=32 and work_id=10138 and row(sequence_number,publication_order,subgroup) is distinct from row(4,4,'companion'::text)) then raise exception 'Companion membership conflict';end if;
 if exists(select 1 from public.collection_books where collection_id=32 and sequence_number=4 and work_id<>10138) then raise exception 'Publisher position occupied';end if;
 insert into public.collection_books(collection_id,work_id,sequence_number,publication_order,subgroup) select 32,10138,4,4,'companion' where not exists(select 1 from public.collection_books where collection_id=32 and work_id=10138);
 insert into public.work_catalog_categories(work_id,category_id) select 10138,'fiction_fantasy' where not exists(select 1 from public.work_catalog_categories where work_id=10138 and category_id='fiction_fantasy');
 select jsonb_build_object('ratings',(select md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' order by md5(to_jsonb(r)::text)),'')) from public.ratings r),'statuses',(select md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' order by md5(to_jsonb(s)::text)),'')) from public.user_book_status s)) into after_users;
 if before_users is distinct from after_users then raise exception 'User state changed; rollback';end if;
end;$catalog$;
select jsonb_build_object('project','hlvujbrmfdlrfxdjwsmb','preserved',jsonb_build_object('authors',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from public.authors t where id<>735),'works',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from public.works t where id<>10138),'editions',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from public.editions t where id not in(91021201,91021202,91021203)),'collections',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from public.collections t),'collection_books',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from public.collection_books t where not(collection_id=32 and work_id=10138)),'ratings',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from public.ratings t),'user_book_status',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from public.user_book_status t),'taste_rating_offers',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from public.taste_rating_offers t),'taste_rating_rounds',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from public.taste_rating_rounds t),'taste_test_responses',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from public.taste_test_responses t),'work_catalog_categories',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from public.work_catalog_categories t where not(work_id=10138 and category_id='fiction_fantasy')),'catalog_work_title_aliases',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from public.catalog_work_title_aliases t),'work_trait_evidence',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from public.work_trait_evidence t)),'editions',(select jsonb_agg(to_jsonb(e) order by isbn_13) from public.editions e where isbn_13 in('9780593201763','9781250462039','9781399641777')),'membership',(select to_jsonb(c) from public.collection_books c where collection_id=32 and work_id=10138)) as receipt;commit;