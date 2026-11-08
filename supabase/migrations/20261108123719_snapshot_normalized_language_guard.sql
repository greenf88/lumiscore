-- Same explicit EN/NL aliases as normalizeEditionLanguage; never an eligibility override.
begin;
create function public.catalog_snapshot_language(value text) returns text language sql immutable strict set search_path=pg_catalog as $$
 with raw as (select replace(lower(trim(value)),'_','-') v), normalized as (
 select case when v ~ '^/?languages/[a-z-]+/?$' then regexp_replace(regexp_replace(v,'^/?languages/',''),'/$','') else v end v from raw)
 select case when v ~ '^(en(-us|-gb)?|eng|english)$' then 'eng'
 when v ~ '^(nl(-nl|-be)?|nld|dut|dutch|nederlands)$' then 'nld' else null end from normalized;
$$;
revoke all on function public.catalog_snapshot_language(text) from public,anon,authenticated;
grant execute on function public.catalog_snapshot_language(text) to service_role;
create or replace function public.guard_description_snapshot()returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if not exists(select 1 from public.editions e join public.works w on w.id=e.work_id
  where e.id=new.edition_id and e.work_id=new.work_id and w.author_id=new.bound_author_id
  and w.open_library_id=new.bound_open_library_work_id and e.title=new.bound_title
  and public.catalog_snapshot_language(e.language)=public.catalog_snapshot_language(new.bound_language)
  and e.isbn_13 is not distinct from new.bound_isbn13 and e.open_library_edition_id=new.source_key
  and public.catalog_snapshot_language(e.language)=case new.locale when 'nl' then 'nld' when 'en' then 'eng' end) then
  raise exception 'Description edition/Work/source/language binding changed';end if;
 if new.fetched_at>clock_timestamp()+interval '5 minutes' or new.checked_at>clock_timestamp()+interval '5 minutes' then raise exception 'Future snapshot';end if;
 if tg_op='UPDATE' and (new.fetched_at<old.fetched_at or new.checked_at<old.checked_at) then raise exception 'Older provider response';end if;
 if tg_op='UPDATE' and new.fetched_at=old.fetched_at and
  (new.text is distinct from old.text or new.binding_hash is distinct from old.binding_hash) then
  raise exception 'Changed payload at the same fetch revision';end if;
 return new;
end $$;
revoke all on function public.guard_description_snapshot() from public,anon,authenticated;
commit;
