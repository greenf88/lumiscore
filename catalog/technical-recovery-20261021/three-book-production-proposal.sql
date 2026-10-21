-- REVIEW ONLY. Production qvplwejffhjvxaypmjut; NOT APPLIED.
-- Default ROLLBACK is deliberate. Only after separate approval: run unchanged
-- dry-run, retain receipt, then replace the final ROLLBACK with COMMIT.
-- Sources and exact old/new fields: three-book-evidence.json.
begin;
set local lock_timeout='3s';
lock table public.editions in share row exclusive mode;
create temporary table pr48_receipt(action text, edition_id bigint, work_id bigint, isbn text) on commit drop;
do $checked$
declare next_id bigint; current_id bigint;
begin
  if (select count(*) from public.works w join public.authors a on a.id=w.author_id where
    (w.id=114 and w.open_library_id='OL18766691W' and a.name='Delia Owens') or
    (w.id=1381 and w.open_library_id='OL1168007W' and a.name='George Orwell'))<>2 then
    raise exception 'Work/author identity changed; stop';
  end if;
  if not exists(select 1 from public.editions where id=114 and work_id=114
    and title='Where the Crawdads Sing' and isbn_13='9780735219090'
    and open_library_edition_id='OL26702293M' and (language is null or language='eng'))
    or not exists(select 1 from public.editions where id=1421 and work_id=1381
    and title='Dierenboerderij' and language='dut' and isbn_10='9041330364'
    and open_library_edition_id='OL18430168M' and (isbn_13 is null or isbn_13='9789041330369')) then
    raise exception 'Edition old/new value or identity changed; stop';
  end if;
  with changed as (update public.editions set language='eng' where id=114 and language is null returning id,work_id,isbn_13)
    insert into pr48_receipt select 'language NULL -> eng',id,work_id,isbn_13 from changed;
  with changed as (update public.editions set isbn_13='9789041330369' where id=1421 and isbn_13 is null returning id,work_id,isbn_13)
    insert into pr48_receipt select 'ISBN13 NULL -> equivalent ISBN13',id,work_id,isbn_13 from changed;

  if exists(select 1 from public.editions where isbn_13='9789041716149' and
    (work_id<>114 or title<>'Daar waar de rivierkreeften zingen' or language is distinct from 'nld')) then
    raise exception 'Dutch Crawdads ISBN collision';
  end if;
  select id into current_id from public.editions where isbn_13='9789041716149';
  if current_id is null then
    if exists(select 1 from public.editions where work_id=114 and lower(title)='daar waar de rivierkreeften zingen') then
      raise exception 'Dutch Crawdads title already exists under another identity; review before adding';
    end if;
    select coalesce(max(id),0)+1 into next_id from public.editions;
    insert into public.editions(id,work_id,title,language,isbn_13,publisher)
      values(next_id,114,'Daar waar de rivierkreeften zingen','nld','9789041716149','Uitgeverij Rainbow');
    insert into pr48_receipt values('added edition',next_id,114,'9789041716149');
  end if;

  if exists(select 1 from public.editions where (isbn_13='9780451526342' or open_library_edition_id='OL7577246M') and
    (work_id<>1381 or title<>'Animal Farm' or language is distinct from 'eng'
      or isbn_13 is distinct from '9780451526342' or open_library_edition_id is distinct from 'OL7577246M')) then
    raise exception 'Animal Farm printed edition collision';
  end if;
  select id into current_id from public.editions where isbn_13='9780451526342';
  if current_id is null then
    select coalesce(max(id),0)+1 into next_id from public.editions;
    insert into public.editions(id,work_id,title,language,isbn_10,isbn_13,publisher,open_library_edition_id)
      values(next_id,1381,'Animal Farm','eng','0451526341','9780451526342','Signet','OL7577246M');
    insert into pr48_receipt values('added edition',next_id,1381,'9780451526342');
  end if;
end $checked$;
-- Retain these IDs for an eventual approved recovery. Repeat must return zero rows.
select * from pr48_receipt order by edition_id;
rollback;
