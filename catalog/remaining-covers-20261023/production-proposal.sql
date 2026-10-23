-- PROPOSAL ONLY qvplwejffhjvxaypmjut; separate production approval required.
-- Default rollback. Dry-run before applying. Retain FULL committed receipt.
-- Adds three editions only, never updates/removes existing records or Works.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
lock table public.editions in share row exclusive mode;
create temporary table remaining_cover_receipt(action text,edition_id bigint,work_id bigint,isbn text,before_row jsonb,after_row jsonb) on commit drop;
do $checked$
declare r record; found_id bigint; next_id bigint; identity_sequence regclass; sequence_value bigint; sequence_called boolean;
begin
  select pg_get_serial_sequence('public.editions','id')::regclass into identity_sequence;
  if identity_sequence is null or not exists(select 1 from pg_attribute where attrelid='public.editions'::regclass and attname='id' and attidentity in ('a','d'))
    or not exists(select 1 from pg_sequence where seqrelid=identity_sequence and seqincrement=1 and seqcache=1 and not seqcycle) then
    raise exception 'Unexpected edition identity generator; stop without sequence changes'; end if;
  execute format('select last_value,is_called from %s',identity_sequence) into sequence_value,sequence_called;
  if sequence_value+(case when sequence_called then 1 else 0 end)<=(select coalesce(max(id),0) from public.editions) then
    raise exception 'Identity sequence behind existing rows; stop for separate review'; end if;
  for r in select * from jsonb_to_recordset($rows$[{"testEditionId":924210148,"workOlid":"OL71042W","author":"C. S. Lewis","oldIsbn":"9780606203081","oldOlid":"OL10925015M","oldTitle":"Magician's Nephew (Chronicles of Narnia)","oldPublisher":"Demco Media","title":"The Magician's Nephew (The Chronicles of Narnia)","language":"eng","isbn10":"0064471101","isbn13":"9780064471107","editionOlid":"OL7292690M","publisher":"HarperTrophy","targetWorkId":148,"targetOldId":148},{"testEditionId":924210228,"workOlid":"OL28996W","author":"Philip Pullman","oldIsbn":"9780606295437","oldOlid":"OL10943545M","oldTitle":"Amber Spyglass (His Dark Materials Trilogy)","oldPublisher":"Turtleback Books Distributed by Demco Media","title":"The Amber Spyglass","language":"eng","isbn10":"0440418569","isbn13":"9780440418566","editionOlid":"OL7521619M","publisher":"Dell Yearling","targetWorkId":228,"targetOldId":228},{"testEditionId":924210553,"workOlid":"OL34113490W","author":"Freida McFadden","oldIsbn":"9781538742587","oldOlid":"OL46205129M","oldTitle":"Housemaid's Secret","oldPublisher":"Grand Central Publishing","title":"The Housemaid's Secret","language":"eng","isbn10":"1837901325","isbn13":"9781837901326","editionOlid":"OL46530123M","publisher":"Bookouture","targetWorkId":553,"targetOldId":553}]$rows$::jsonb)
    as x("targetWorkId" bigint,"targetOldId" bigint,"testEditionId" bigint,"workOlid" text,"author" text,"oldTitle" text,"oldIsbn" text,"oldOlid" text,"oldPublisher" text,"title" text,"language" text,"isbn10" text,"isbn13" text,"editionOlid" text,"publisher" text) loop
    if not exists(select 1 from public.works w join public.authors a on a.id=w.author_id where w.id=r."targetWorkId" and w.open_library_id=r."workOlid" and a.name=r.author) then
      raise exception 'Work/author identity drift for %',r."targetWorkId"; end if;
    if not exists(select 1 from public.editions e where e.id=r."targetOldId" and e.work_id=r."targetWorkId" and e.title=r."oldTitle" and e.language='eng'
      and e.isbn_13=r."oldIsbn" and e.open_library_edition_id=r."oldOlid" and e.publisher=r."oldPublisher") then
      raise exception 'Existing edition drift; stop without overwriting %',r."targetOldId"; end if;
    if (select count(*) from public.editions where isbn_13=r.isbn13 or isbn_10=r.isbn10 or open_library_edition_id=r."editionOlid")>1 then
      raise exception 'Duplicate candidate edition identity %',r.isbn13; end if;
    if exists(select 1 from public.editions e where (e.isbn_13=r.isbn13 or e.isbn_10=r.isbn10 or e.open_library_edition_id=r."editionOlid") and
      (e.work_id is distinct from r."targetWorkId" or e.title is distinct from r.title or e.language is distinct from r.language or e.isbn_13 is distinct from r.isbn13
        or e.isbn_10 is distinct from r.isbn10 or e.open_library_edition_id is distinct from r."editionOlid" or e.publisher is distinct from r.publisher)) then
      raise exception 'Candidate identity/value conflict %; manual review required',r.isbn13; end if;
    select id into found_id from public.editions where isbn_13=r.isbn13;
    if found_id is null then
      insert into public.editions(work_id,title,language,isbn_10,isbn_13,open_library_edition_id,publisher)
      values(r."targetWorkId",r.title,r.language,r.isbn10,r.isbn13,r."editionOlid",r.publisher) returning id into next_id;
      insert into remaining_cover_receipt select 'added edition',next_id,r."targetWorkId",r.isbn13,null,to_jsonb(e) from public.editions e where e.id=next_id;
    end if;
  end loop;
  if (select count(*) from public.editions where isbn_13 in ('9780064471107','9780440418566','9781837901326'))<>3
    or (select count(*) from remaining_cover_receipt) not in (0,3) then
    raise exception 'Expected all three new editions or unchanged repeat; partial state requires review'; end if;
end $checked$;
select * from remaining_cover_receipt order by work_id;
rollback;
