-- Target ONLY hlvujbrmfdlrfxdjwsmb. Public bibliography; no ratings/users/statuses.
-- Reviewed sources, old/new values and recovery: three-book-evidence.json.
begin;
do $guard$ begin
  if not exists(select 1 from public.works where id=91021001 and open_library_id='OL893414W')
    or not exists(select 1 from public.editions where id=91021001 and work_id=91021001 and isbn_13='9780575073340' and language='eng') then
    raise exception 'Expected isolated Dune fixture; refuse another target';
  end if;
end $guard$;
insert into public.authors(id,name,open_library_id) values
 (921300114,'Delia Owens','OL832711A'),(921301381,'George Orwell','OL118077A') on conflict do nothing;
insert into public.works(id,title,author_id,first_publish_year,open_library_id,source_type) values
 (921100114,'Where the Crawdads Sing',921300114,2018,'OL18766691W','open_library'),
 (921101381,'Animal Farm',921301381,1945,'OL1168007W','open_library') on conflict do nothing;
-- Original public editions preserved alongside the two reviewed additions.
insert into public.editions(id,work_id,title,language,isbn_10,isbn_13,publisher,open_library_edition_id) values
 (921200114,921100114,'Where the Crawdads Sing',null,null,'9780735219090','G.P. Putnam''s Sons','OL26702293M'),
 (921201420,921101381,'Animal Farm','eng','0307261239','9780307261236','Listening Library','OL10352481M'),
 (921201421,921101381,'Dierenboerderij','dut','9041330364',null,'Singel Pockets','OL18430168M') on conflict do nothing;
update public.editions set language='eng' where id=921200114 and work_id=921100114 and title='Where the Crawdads Sing'
 and isbn_13='9780735219090' and open_library_edition_id='OL26702293M' and language is null;
update public.editions set isbn_13='9789041330369' where id=921201421 and work_id=921101381 and title='Dierenboerderij'
 and isbn_10='9041330364' and open_library_edition_id='OL18430168M' and language='dut' and isbn_13 is null;
insert into public.editions(id,work_id,title,language,isbn_10,isbn_13,publisher,open_library_edition_id) values
 (921200115,921100114,'Daar waar de rivierkreeften zingen','nld',null,'9789041716149','Uitgeverij Rainbow',null),
 (921201422,921101381,'Animal Farm','eng','0451526341','9780451526342','Signet','OL7577246M') on conflict do nothing;
do $verify$
declare n integer;
begin
  select count(*) into n from public.authors where
    (id=921300114 and name='Delia Owens' and open_library_id='OL832711A') or
    (id=921301381 and name='George Orwell' and open_library_id='OL118077A');
  if n<>2 then raise exception 'Author identity conflict'; end if;
  select count(*) into n from public.works where
    (id=921100114 and title='Where the Crawdads Sing' and author_id=921300114 and open_library_id='OL18766691W') or
    (id=921101381 and title='Animal Farm' and author_id=921301381 and open_library_id='OL1168007W');
  if n<>2 then raise exception 'Work identity conflict'; end if;
  select count(*) into n from public.editions e join (values
    (921200114::bigint,921100114::bigint,'Where the Crawdads Sing','eng',null::text,'9780735219090','G.P. Putnam''s Sons','OL26702293M'),
    (921200115,921100114,'Daar waar de rivierkreeften zingen','nld',null,'9789041716149','Uitgeverij Rainbow',null),
    (921201420,921101381,'Animal Farm','eng','0307261239','9780307261236','Listening Library','OL10352481M'),
    (921201421,921101381,'Dierenboerderij','dut','9041330364','9789041330369','Singel Pockets','OL18430168M'),
    (921201422,921101381,'Animal Farm','eng','0451526341','9780451526342','Signet','OL7577246M')
  ) v(id,work_id,title,language,isbn_10,isbn_13,publisher,olid)
   on e.id=v.id and e.work_id=v.work_id and e.title=v.title and e.language=v.language
     and e.isbn_10 is not distinct from v.isbn_10 and e.isbn_13=v.isbn_13
     and e.publisher=v.publisher and e.open_library_edition_id is not distinct from v.olid;
  if n<>5 then raise exception 'Edition identity conflict; complete transaction rolled back'; end if;
end $verify$;
commit;
