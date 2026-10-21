-- TEST ONLY: hlvujbrmfdlrfxdjwsmb. Minimal public bibliographic fixture.
-- No users, ratings, progress, categories, collection links, schema or privileges.
begin;
set local lock_timeout='3s';
do $$
declare aid bigint; wid bigint; eid bigint;
begin
 select id into aid from public.authors where open_library_id='OL9150900A';
 if aid is null then
   insert into public.authors(id,name,open_library_id) values(921301191,'Charlotte de Monchy','OL9150900A');
   aid:=921301191;
 end if;
 select id into wid from public.works where open_library_id='OL24326852W';
 if wid is null then
   insert into public.works(id,title,open_library_id,author_id,first_publish_year,source_type)
   values(921101191,'Nee heb je','OL24326852W',aid,2019,'open_library');
   wid:=921101191;
 end if;
 if not exists(select 1 from public.works where id=wid and title='Nee heb je' and author_id=aid) then raise exception 'Work mismatch'; end if;
 select id into eid from public.editions where isbn_13='9789022585979' or open_library_edition_id='OL32196483M';
 if eid is null then
   insert into public.editions(id,work_id,title,open_library_edition_id,isbn_13,language,publisher)
   values(921201191,wid,'Nee heb je','OL32196483M','9789022585979',null,'Boekerij');
   eid:=921201191;
 end if;
 if not exists(select 1 from public.editions where id=eid and work_id=wid and title='Nee heb je'
   and isbn_13='9789022585979' and open_library_edition_id='OL32196483M' and (language is null or language='nld')) then raise exception 'Edition mismatch'; end if;
 update public.editions set language='nld' where id=eid and language is null;
end $$;
select e.id,e.work_id,e.title,e.isbn_13,e.language from public.editions e where e.isbn_13='9789022585979';
commit;
