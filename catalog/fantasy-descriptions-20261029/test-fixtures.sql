-- TEST ONLY hlvujbrmfdlrfxdjwsmb. Two original public catalogue fixtures, NOT better editions.
-- Approved 29 October; no user rows, ratings, traits or inventory touched.
begin;
DO $guard$
begin
 if not exists(select 1 from public.works where id=91021001 and open_library_id='OL893414W') then raise exception 'Wrong test target'; end if;
 if exists(select 1 from public.authors where (id=929300014 or open_library_id='OL25342A' or name='Mary Shelley') and not(id=929300014 and open_library_id='OL25342A' and name='Mary Shelley')) then raise exception 'Unexpected Mary Shelley identity'; end if;
 if not exists(select 1 from public.authors where id=921300017 and name='Ursula K. Le Guin') then raise exception 'Reused author changed'; end if;
 if exists(select 1 from public.works where (id=929100014 or open_library_id='OL450063W') and not(id=929100014 and open_library_id='OL450063W' and title='Frankenstein; or, The Modern Prometheus' and author_id=929300014 and first_publish_year=1818)) then raise exception 'Work 14 changed/collision'; end if;
 if exists(select 1 from public.editions where (id=929200014 or open_library_edition_id='OL26385062M') and not(id=929200014 and work_id=929100014 and open_library_edition_id='OL26385062M' and isbn_13='9788415089452' and title='FRANKENSTEIN. Bilingüe' and language is null)) then raise exception 'Edition 14 changed/collision'; end if;
 if exists(select 1 from public.works where (id=929100022 or open_library_id='OL59798W') and not(id=929100022 and open_library_id='OL59798W' and title='A Wizard of Earthsea' and author_id=921300017 and first_publish_year=1968)) then raise exception 'Work 22 changed/collision'; end if;
 if exists(select 1 from public.editions where (id=929200022 or open_library_edition_id='OL10635933M') and not(id=929200022 and work_id=929100022 and open_library_edition_id='OL10635933M' and isbn_13='9780563389163' and title='A Wizard of Earthsea (The Earthsea Cycle, Book 1)' and language is null)) then raise exception 'Edition 22 changed/collision'; end if;
end $guard$;
insert into public.authors(id,open_library_id,name) select 929300014,'OL25342A','Mary Shelley' where not exists(select 1 from public.authors where id=929300014);
insert into public.works(id,open_library_id,title,author_id,first_publish_year,source_type,work_type) select 929100014,'OL450063W','Frankenstein; or, The Modern Prometheus',929300014,1818,'open_library',null where not exists(select 1 from public.works where id=929100014);
insert into public.editions(id,work_id,open_library_edition_id,isbn_13,language,title,publisher) select 929200014,929100014,'OL26385062M','9788415089452',null,'FRANKENSTEIN. Bilingüe','Plutón Ediciones' where not exists(select 1 from public.editions where id=929200014);
insert into public.works(id,open_library_id,title,author_id,first_publish_year,source_type,work_type) select 929100022,'OL59798W','A Wizard of Earthsea',921300017,1968,'open_library',null where not exists(select 1 from public.works where id=929100022);
insert into public.editions(id,work_id,open_library_edition_id,isbn_13,language,title,publisher) select 929200022,929100022,'OL10635933M','9780563389163',null,'A Wizard of Earthsea (The Earthsea Cycle, Book 1)','BBC Pubns' where not exists(select 1 from public.editions where id=929200022);
DO $assert$ begin if(select count(*) from public.works where id in(929100014,929100022))<>2 or (select count(*) from public.editions where id in(929200014,929200022) and language is null)<>2 then raise exception 'Expected exactly two original fixtures'; end if;end $assert$;
select 'two public Works, two unchanged original editions, one new author; user tables untouched' as outcome;
rollback;
