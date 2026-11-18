import {readFileSync,writeFileSync} from 'node:fs';
const dir=new URL('../catalog/remaining-covers-20261118/',import.meta.url),read=n=>JSON.parse(readFileSync(new URL(n,dir),'utf8'));
const baseline=read('baseline.json'),covers=read('proposal.json'),changes=read('corrections.json');
const payload={baseline,changes,covers:covers.map(({image,visualReviewed,...r})=>r)};
const data=JSON.stringify(payload);if(data.includes('$payload$'))throw Error('Unexpected SQL delimiter');
const begin=`-- Reviewed public catalogue data only. Default DRY RUN; review receipt before COMMIT.
begin;
set local lock_timeout='3s';
set local statement_timeout='60s';
lock table public.authors,public.works,public.editions,public.catalog_edition_metadata in share row exclusive mode;
create temporary table cover_review_receipt(work_id bigint,locale text,edition_id bigint,isbn13 text,cover_url text) on commit drop;
do $checked$
declare p jsonb:=$payload$${data}$payload$::jsonb; r jsonb; c jsonb; e jsonb; current_row jsonb; aid bigint; eid bigint;
begin
`;
const production=begin+`
 -- Validate the complete snapshot before any catalogue mutation.
 for r in select value from jsonb_array_elements(p->'baseline'->'works') loop
  if not exists(select 1 from public.works w join public.authors a on a.id=w.author_id where w.id=(r->>'id')::bigint and w.title=r->>'title' and w.author_id=(r->>'author_id')::bigint and w.open_library_id is not distinct from r->>'open_library_id' and a.name=r->>'authorName' and a.open_library_id is not distinct from r->>'authorOlid') then raise exception 'Work/author identity drift: %',r->>'id';end if;
  if (select count(*) from public.editions where work_id=(r->>'id')::bigint)<>(select count(*) from jsonb_array_elements(p->'baseline'->'editions') x where x->>'work_id'=r->>'id') then raise exception 'Edition set drift: %',r->>'id';end if;
 end loop;
 for r in select value from jsonb_array_elements(p->'baseline'->'editions') loop
  select to_jsonb(x) into current_row from public.editions x where id=(r->>'id')::bigint;
  if current_row is distinct from r then raise exception 'Edition drift: %',r->>'id';end if;
 end loop;
 for r in select value from jsonb_array_elements(p->'covers') loop
  if r->'newEdition'<>'null'::jsonb then
   if exists(select 1 from public.editions where isbn_13=r->>'isbn13' or (r->'newEdition'->>'isbn_10' is not null and isbn_10=r->'newEdition'->>'isbn_10')) then raise exception 'New edition identifier conflict: %',r->>'isbn13';end if;
  elsif exists(select 1 from public.catalog_edition_metadata where edition_id=(r->>'editionId')::bigint) then raise exception 'Existing review conflict: %',r->>'editionId';end if;
  if exists(select 1 from public.editions where work_id<>(r->>'workId')::bigint and isbn_13=r->>'isbn13') then raise exception 'Cross-Work identifier conflict: %',r->>'isbn13';end if;
 end loop;
 for r in select value from jsonb_array_elements(p->'changes') loop
  if r ? 'authorName' then
   select author_id into aid from public.works where id=(r->>'workId')::bigint;
   if (select count(*) from public.works where author_id=aid)<>1 then raise exception 'Shared author rename refused';end if;
   update public.authors set name=r->>'authorName' where id=aid;
  end if;
  if r ? 'workAuthorName' then
   if (select count(*) from public.authors where name=r->>'workAuthorName')>1 then raise exception 'Ambiguous author identity';end if;
   select id into aid from public.authors where name=r->>'workAuthorName';
   if aid is null then insert into public.authors(name) values(r->>'workAuthorName') returning id into aid;end if;
   update public.works set author_id=aid where id=(r->>'workId')::bigint;
  end if;
  if r ? 'workTitle' then update public.works set title=r->>'workTitle' where id=(r->>'workId')::bigint;end if;
  if r ? 'language' then update public.editions set language=r->>'language' where id=(r->>'editionId')::bigint;end if;
  if r ? 'editionTitle' then update public.editions set title=r->>'editionTitle' where id=(r->>'editionId')::bigint;end if;
 end loop;
 for r in select value from jsonb_array_elements(p->'covers') loop
  eid:=(r->>'editionId')::bigint;
  if r->'newEdition'<>'null'::jsonb then
   e:=r->'newEdition';
   insert into public.editions(work_id,title,language,isbn_13,isbn_10,publisher,open_library_edition_id,preferred_for_catalog)
   values((r->>'workId')::bigint,e->>'title',e->>'language',e->>'isbn_13',e->>'isbn_10',e->>'publisher',e->>'open_library_edition_id',true) returning id into eid;
  end if;
  select author_id into aid from public.works where id=(r->>'workId')::bigint;
  if not exists(select 1 from public.editions where id=eid and work_id=(r->>'workId')::bigint and title=r->>'title' and language=r->>'language' and isbn_13=r->>'isbn13') then raise exception 'Final edition binding mismatch: %',r->>'key';end if;
  insert into public.catalog_edition_metadata(edition_id,work_id,bound_author_id,bound_title,bound_language,bound_isbn13,format,cover_url,card_cover_url,evidence_url,evidence,review_status,reviewed_at,review_batch)
  values(eid,(r->>'workId')::bigint,aid,r->>'title',r->>'language',r->>'isbn13',r->>'format',r->>'coverUrl',null,r->>'evidenceUrl',r->'evidence','approved',now(),'remaining-covers-20261118');
  insert into cover_review_receipt values((r->>'workId')::bigint,r->>'locale',eid,r->>'isbn13',r->>'coverUrl');
 end loop;
 if (select count(*) from cover_review_receipt)<>${covers.length} then raise exception 'Incomplete cover review';end if;
end $checked$;
select * from cover_review_receipt order by locale,work_id;
rollback;
`;
const rollback=begin+`
 -- Compare-and-swap rollback. Abort if an edited field or review has changed.
 if (select count(*) from public.catalog_edition_metadata where review_batch='remaining-covers-20261118')<>${covers.length} then raise exception 'Review batch drift';end if;
 for r in select value from jsonb_array_elements(p->'baseline'->'works') loop
  select value into c from jsonb_array_elements(p->'changes') where value->>'workId'=r->>'id';
  if not exists(select 1 from public.works w join public.authors a on a.id=w.author_id where w.id=(r->>'id')::bigint and w.title=coalesce(c->>'workTitle',r->>'title') and w.open_library_id is not distinct from r->>'open_library_id' and a.name=coalesce(c->>'workAuthorName',c->>'authorName',r->>'authorName') and (c ? 'workAuthorName' or w.author_id=(r->>'author_id')::bigint)) then raise exception 'Rollback Work drift: %',r->>'id';end if;
 end loop;
 for r in select value from jsonb_array_elements(p->'baseline'->'editions') loop
  select value into c from jsonb_array_elements(p->'changes') where value->>'editionId'=r->>'id';
  e:=r;if c ? 'language' then e:=jsonb_set(e,'{language}',c->'language');end if;if c ? 'editionTitle' then e:=jsonb_set(e,'{title}',c->'editionTitle');end if;
  select to_jsonb(x) into current_row from public.editions x where id=(r->>'id')::bigint;
  if current_row is distinct from e then raise exception 'Rollback edition drift: %',r->>'id';end if;
 end loop;
 for r in select value from jsonb_array_elements(p->'covers') loop
  select m.edition_id into eid from public.catalog_edition_metadata m where m.review_batch='remaining-covers-20261118' and m.work_id=(r->>'workId')::bigint and m.bound_isbn13=r->>'isbn13' and m.bound_title=r->>'title' and m.bound_language=r->>'language' and m.cover_url=r->>'coverUrl' and m.review_status='approved' and m.evidence=r->'evidence';
  if eid is null then raise exception 'Rollback review drift: %',r->>'key';end if;
  if r->'newEdition'<>'null'::jsonb then
   select to_jsonb(x)-'id'-'work_id'-'created_at'-'preferred_for_catalog' into current_row from public.editions x where id=eid and work_id=(r->>'workId')::bigint and preferred_for_catalog;
   if current_row is distinct from r->'newEdition' then raise exception 'Rollback new edition drift';end if;
  end if;
  insert into cover_review_receipt values((r->>'workId')::bigint,r->>'locale',eid,r->>'isbn13',r->>'coverUrl');
 end loop;
 delete from public.catalog_edition_metadata where review_batch='remaining-covers-20261118';
 for r in select value from jsonb_array_elements(p->'covers') where value->'newEdition'<>'null'::jsonb loop
  delete from public.editions where id=(select edition_id from cover_review_receipt where work_id=(r->>'workId')::bigint and locale=r->>'locale');
 end loop;
 for c in select value from jsonb_array_elements(p->'changes') loop
  select value into r from jsonb_array_elements(p->'baseline'->'editions') where value->>'id'=c->>'editionId';
  update public.editions set language=r->>'language',title=r->>'title' where id=(r->>'id')::bigint;
  select value into r from jsonb_array_elements(p->'baseline'->'works') where value->>'id'=c->>'workId';
  update public.works set title=r->>'title',author_id=(r->>'author_id')::bigint where id=(r->>'id')::bigint;
  if c ? 'authorName' then update public.authors set name=r->>'authorName' where id=(r->>'author_id')::bigint;end if;
 end loop;
 -- Newly created author identities are retained; no unrelated author is deleted.
end $checked$;
select * from cover_review_receipt order by locale,work_id;
rollback;
`;
writeFileSync(new URL('production.sql',dir),production);writeFileSync(new URL('rollback.sql',dir),rollback);
console.log({covers:covers.length,productionBytes:production.length,rollbackBytes:rollback.length});
