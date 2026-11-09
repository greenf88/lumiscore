-- Stop rather than destroy withdrawal evidence or later changes. No CASCADE.
begin;set local timezone='UTC';set local lock_timeout='3s';
do $$ begin
if exists(select 1 from catalog_description_snapshots where provider_status='withdrawn' or text is null or withdrawn_at is not null or withdrawal_receipt_sha256 is not null) then raise exception 'Withdrawal evidence exists; schema restore blocked';end if;
if to_regprocedure('public.cleanup_catalog_description_snapshots(integer)') is not null then raise exception 'Restore dependent cleanup package first';end if;
if md5(pg_get_functiondef('public.guard_description_snapshot()'::regprocedure))<>'dd97ee538c6cfb599236acb7121c5636' or md5(pg_get_functiondef('public.withdraw_catalog_description_snapshot(bigint,bigint,text,text,timestamptz)'::regprocedure))<>'b0a4759809be4025a63603cdeec42101' or md5(pg_get_functiondef('public.reinstate_catalog_description_snapshot(bigint,bigint,text,text,jsonb)'::regprocedure))<>'fd91720952c2ff144699e7c78d12a7e7' then raise exception 'Later source implementation changed';end if;end $$;
drop function public.reinstate_catalog_description_snapshot(bigint,bigint,text,text,jsonb);
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

create or replace function public.withdraw_catalog_description_snapshot(p_work_id bigint,p_edition_id bigint,p_locale text,p_binding_hash text,p_fetched_at timestamptz)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare affected integer;
begin
 delete from public.catalog_description_snapshots where work_id=p_work_id and edition_id=p_edition_id and locale=p_locale
  and binding_hash=p_binding_hash and fetched_at=p_fetched_at;
 get diagnostics affected=row_count;
 if affected=0 then raise exception 'Snapshot withdrawal CAS mismatch or absent row';end if;
 return true;
end $$;
revoke all on function public.withdraw_catalog_description_snapshot(bigint,bigint,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.withdraw_catalog_description_snapshot(bigint,bigint,text,text,timestamptz) to service_role;

alter table public.catalog_description_snapshots drop constraint snapshot_withdrawal_state;
alter table public.catalog_description_snapshots drop constraint catalog_description_snapshots_provider_status_check;
alter table public.catalog_description_snapshots add constraint catalog_description_snapshots_provider_status_check check(provider_status in('resolved','temporary_failure','confirmed_missing'));
alter table public.catalog_description_snapshots alter column text set not null;
alter table public.catalog_description_snapshots drop column withdrawn_at,drop column withdrawn_text_sha256,drop column withdrawal_receipt_sha256;
commit;
