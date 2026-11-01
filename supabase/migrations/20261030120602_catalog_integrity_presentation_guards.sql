-- TEST FIRST. Requires reviewed-presentation storage from 20261030063949.
-- Additive validation only; no book, rating, account or progress rows changed.
set local lock_timeout='3s';
set local statement_timeout='30s';
alter table public.catalog_edition_metadata drop constraint if exists catalog_edition_metadata_format_check;
alter table public.catalog_edition_metadata add constraint catalog_edition_metadata_format_check
 check(format in ('paperback','hardcover','ebook','audio','other','unknown'));
alter table public.catalog_work_descriptions drop constraint if exists catalog_description_usable_text;
alter table public.catalog_work_descriptions add constraint catalog_description_usable_text check (
 length(btrim(regexp_replace(regexp_replace(text,'<[^>]*>','','g'),'&(nbsp|#160);',' ','gi')))>=20
 and lower(btrim(text)) !~ '^(no (book )?description( available| found)?|description (not available|unavailable|missing)|geen (boek)?beschrijving( beschikbaar| gevonden)?|samenvatting (ontbreekt|niet beschikbaar)|503 service unavailable|429 too many requests)[.! ]*$'
);
-- The existing server-only importer can read bibliographic review locks. This
-- grants no write, Auth, rating, preference or private reporting access.
grant select on public.catalog_edition_metadata,public.catalog_work_descriptions to service_role;

create or replace function public.catalog_guard_reviewed_identity()
returns trigger language plpgsql security invoker set search_path='' as $guard$
begin
 if tg_table_name='editions' then
  if row(new.work_id,new.title,new.language,new.isbn_13,new.isbn_10,new.open_library_edition_id)
   is distinct from row(old.work_id,old.title,old.language,old.isbn_13,old.isbn_10,old.open_library_edition_id)
   and exists(select 1 from public.catalog_edition_metadata m where m.edition_id=old.id and m.review_status='approved') then
   raise exception using errcode='23514',message='Reviewed edition identity is locked; withdraw and review the binding in an explicit correction transaction';
  end if;
 elsif tg_table_name='works' then
  if new.author_id is distinct from old.author_id and (
   exists(select 1 from public.catalog_work_descriptions d where d.work_id=old.id and d.review_status='approved')
   or exists(select 1 from public.catalog_edition_metadata m where m.work_id=old.id and m.review_status='approved')) then
   raise exception using errcode='23514',message='Reviewed Work author is locked; explicit identity correction required';
  end if;
 end if;
 return new;
end;
$guard$;
revoke all on function public.catalog_guard_reviewed_identity() from public,anon,authenticated,service_role;
drop trigger if exists catalog_preserve_reviewed_edition_identity on public.editions;
create trigger catalog_preserve_reviewed_edition_identity before update of work_id,title,language,isbn_13,isbn_10,open_library_edition_id
 on public.editions for each row execute function public.catalog_guard_reviewed_identity();
drop trigger if exists catalog_preserve_reviewed_work_author on public.works;
create trigger catalog_preserve_reviewed_work_author before update of author_id
 on public.works for each row execute function public.catalog_guard_reviewed_identity();
