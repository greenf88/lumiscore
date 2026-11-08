begin;
alter table public.catalog_description_snapshots alter column text drop not null;
alter table public.catalog_description_snapshots add column withdrawn_at timestamptz,
 add column withdrawn_text_sha256 text, add column withdrawal_receipt_sha256 text;
alter table public.catalog_description_snapshots drop constraint catalog_description_snapshots_provider_status_check;
alter table public.catalog_description_snapshots add constraint catalog_description_snapshots_provider_status_check
 check(provider_status in('resolved','temporary_failure','confirmed_missing','withdrawn'));
alter table public.catalog_description_snapshots add constraint snapshot_withdrawal_state check(
 (provider_status='withdrawn' and text is null and withdrawn_at is not null
 and withdrawn_text_sha256 is not null and withdrawal_receipt_sha256 is not null
 and withdrawn_text_sha256 ~ '^[a-f0-9]{64}$' and withdrawal_receipt_sha256 ~ '^[a-f0-9]{64}$')
 or (provider_status<>'withdrawn' and text is not null and withdrawn_at is null
 and withdrawn_text_sha256 is null and withdrawal_receipt_sha256 is null));
create or replace function public.guard_description_snapshot() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_op='UPDATE' and old.provider_status='withdrawn' then
  if (to_jsonb(new)-'checked_at') is distinct from (to_jsonb(old)-'checked_at') then
   raise exception 'Withdrawn source cannot be automatically reimported';end if;
  if new.checked_at<old.checked_at or new.checked_at>clock_timestamp()+interval '5 minutes' then
   raise exception 'Invalid withdrawal check time';end if;
  return new;
 end if;
 if not exists(select 1 from public.editions e join public.works w on w.id=e.work_id
 where e.id=new.edition_id and e.work_id=new.work_id and w.author_id=new.bound_author_id
 and w.open_library_id=new.bound_open_library_work_id and e.title=new.bound_title
 and public.catalog_snapshot_language(e.language)=public.catalog_snapshot_language(new.bound_language)
 and e.isbn_13 is not distinct from new.bound_isbn13 and e.open_library_edition_id=new.source_key
 and public.catalog_snapshot_language(e.language)=case new.locale when 'nl' then 'nld' when 'en' then 'eng' end)
 then raise exception 'Description edition/Work/source/language binding changed';end if;
 if new.fetched_at>clock_timestamp()+interval '5 minutes' or new.checked_at>clock_timestamp()+interval '5 minutes'
 then raise exception 'Future snapshot';end if;
 if tg_op='UPDATE' and (new.fetched_at<old.fetched_at or new.checked_at<old.checked_at) then
 raise exception 'Older provider response';end if;
 if new.provider_status='withdrawn' then
  if tg_op<>'UPDATE' then raise exception 'Withdrawal requires an existing exact snapshot';end if;
  if new.withdrawn_text_sha256 is distinct from encode(sha256(convert_to(old.text,'UTF8')),'hex')
   or new.withdrawal_receipt_sha256 is distinct from encode(sha256(convert_to(to_jsonb(old)::text,'UTF8')),'hex')
  then raise exception 'Withdrawal receipt/content mismatch';end if;
 elsif tg_op='UPDATE' and new.fetched_at=old.fetched_at and
 (new.text is distinct from old.text or new.binding_hash is distinct from old.binding_hash) then
 raise exception 'Changed payload at the same fetch revision';end if;
 return new;
end $$;
revoke all on function public.guard_description_snapshot() from public,anon,authenticated;
create or replace function public.withdraw_catalog_description_snapshot(p_work_id bigint,p_edition_id bigint,p_locale text,p_binding_hash text,p_fetched_at timestamptz)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare prior public.catalog_description_snapshots%rowtype;
begin
 select * into prior from public.catalog_description_snapshots where work_id=p_work_id and edition_id=p_edition_id
 and locale=p_locale and binding_hash=p_binding_hash and fetched_at=p_fetched_at for update;
 if not found then raise exception 'Snapshot withdrawal CAS mismatch or absent row';end if;
 if prior.provider_status='withdrawn' then return false;end if;
 update public.catalog_description_snapshots set text=null,provider_status='withdrawn',withdrawn_at=clock_timestamp(),
 checked_at=greatest(clock_timestamp(),prior.checked_at),
 withdrawn_text_sha256=encode(sha256(convert_to(prior.text,'UTF8')),'hex'),
 withdrawal_receipt_sha256=encode(sha256(convert_to(to_jsonb(prior)::text,'UTF8')),'hex')
 where work_id=p_work_id and edition_id=p_edition_id and locale=p_locale;
 return true;
end $$;
revoke all on function public.withdraw_catalog_description_snapshot(bigint,bigint,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.withdraw_catalog_description_snapshot(bigint,bigint,text,text,timestamptz) to service_role;
comment on column public.catalog_description_snapshots.withdrawal_receipt_sha256 is
 'Hash of exact pre-withdrawal row; not editorial approval. Keep identity evidence to prevent automatic reimport.';
commit;
