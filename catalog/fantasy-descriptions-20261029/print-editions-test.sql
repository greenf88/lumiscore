-- TEST ONLY hlvujbrmfdlrfxdjwsmb. Two additive print editions; no existing rows changed.
-- Exact additions only; default ROLLBACK. See print-editions-evidence.json.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
lock table public.editions in share row exclusive mode;
create temporary table print_before on commit drop as
 select id,to_jsonb(e) row_data from public.editions e where id in(929200014,929200022);
create temporary table print_receipt(action text,edition_id bigint,work_id bigint,isbn13 text,after_row jsonb) on commit drop;
do $checked$
declare target record; inserted_id bigint;
begin
 if (select count(*) from public.works w join public.authors a on a.id=w.author_id where
 (w.id=929100014 and w.open_library_id='OL450063W' and w.title='Frankenstein; or, The Modern Prometheus' and w.first_publish_year=1818 and a.id=929300014 and a.name='Mary Shelley') or
 (w.id=929100022 and w.open_library_id='OL59798W' and w.title='A Wizard of Earthsea' and w.first_publish_year=1968 and a.id=921300017 and a.name='Ursula K. Le Guin'))<>2
 then raise exception 'Wrong target or changed Work/author; stop';end if;
 if not exists(select 1 from public.editions where id=929200014 and work_id=929100014 and title='FRANKENSTEIN. Bilingüe'
 and isbn_13='9788415089452' and isbn_10 is null and language is null and publisher='Plutón Ediciones' and open_library_edition_id='OL26385062M')
 or not exists(select 1 from public.editions where id=929200022 and work_id=929100022 and title='A Wizard of Earthsea (The Earthsea Cycle, Book 1)'
 and isbn_13='9780563389163' and isbn_10 is null and language is null and publisher='BBC Pubns' and open_library_edition_id='OL10635933M')
 then raise exception 'Original edition value changed; do not relabel or overwrite';end if;
 if exists(select 1 from public.editions where work_id in(929100014,929100022) and id not in(929200014,929200022)
 and (isbn_13 is null or isbn_13 not in('9780141439471','9780553383041'))) then raise exception 'Unexpected additional edition; review selection first';end if;
 for target in select * from(values
 (929100014::bigint,'Frankenstein','9780141439471','0141439475','OL3701481M','Penguin Books'),
 (929100022::bigint,'A Wizard of Earthsea (The Earthsea Cycle, Book 1)','9780553383041','0553383043','OL7826592M','Spectra')
 )v(work_id,title,isbn13,isbn10,olid,publisher)
 loop
  if exists(select 1 from public.editions e where(e.isbn_13=target.isbn13 or e.isbn_10=target.isbn10 or e.open_library_edition_id=target.olid)
   and (e.work_id is distinct from target.work_id or e.title is distinct from target.title or e.language is distinct from 'eng'
   or e.isbn_13 is distinct from target.isbn13 or e.isbn_10 is distinct from target.isbn10
   or e.publisher is distinct from target.publisher or e.open_library_edition_id is distinct from target.olid))
  then raise exception 'ISBN/OL identity collision for %',target.isbn13;end if;
  if(select count(*) from public.editions where isbn_13=target.isbn13)>1 then raise exception 'Duplicate ISBN';end if;
  if not exists(select 1 from public.editions where isbn_13=target.isbn13) then
   insert into public.editions(id,work_id,title,isbn_13,isbn_10,language,publisher,open_library_edition_id)
    values(case target.work_id when 929100014 then 929214014 else 929214022 end,target.work_id,target.title,target.isbn13,target.isbn10,'eng',target.publisher,target.olid) returning id into inserted_id;
   insert into print_receipt select 'added English print edition',e.id,e.work_id,e.isbn_13,to_jsonb(e) from public.editions e where e.id=inserted_id;
  end if;
 end loop;
 if(select count(*) from print_receipt) not in(0,2) then raise exception 'Partial prior installation: expect two additions or zero on replay';end if;
 if(select count(*) from public.editions where isbn_13 in('9780141439471','9780553383041'))<>2
 or(select count(*) from print_before)<>2
 or exists(select 1 from print_before b left join public.editions e on e.id=b.id where to_jsonb(e) is distinct from b.row_data)
 then raise exception 'Count or original-row preservation check failed';end if;
end $checked$;
select * from print_receipt order by work_id;
rollback;
