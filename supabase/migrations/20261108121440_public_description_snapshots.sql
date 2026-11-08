-- Public exact-edition snapshots. Independently reviewed installation required.
begin;
create table public.catalog_description_snapshots (
 work_id bigint not null references public.works(id),
 edition_id bigint not null references public.editions(id),
 locale text not null check(locale in('en','nl')),
 binding_hash text not null check(binding_hash ~ '^[a-f0-9]{64}$'),
 bound_author_id bigint not null,
 bound_title text not null,
 bound_language text not null,
 bound_isbn13 text,
 bound_open_library_work_id text not null,
 text text not null check(length(trim(text)) between 60 and 20000),
 source_key text not null check(source_key ~ '^OL[0-9]+M$'),
 fetched_at timestamptz not null,
 checked_at timestamptz not null check(checked_at>=fetched_at),
 provider_status text not null check(provider_status in('resolved','temporary_failure','confirmed_missing')),
 validation text not null check(validation='identity_and_language_verified'),
 primary key(work_id,edition_id,locale)
);
alter table public.catalog_description_snapshots enable row level security;
alter table public.catalog_description_snapshots force row level security;
revoke all on public.catalog_description_snapshots from public,anon,authenticated,service_role;
grant select on public.catalog_description_snapshots to anon,authenticated,service_role;
grant insert,update on public.catalog_description_snapshots to service_role;
create policy description_snapshot_public_read on public.catalog_description_snapshots for select using(true);
create function public.guard_description_snapshot()returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from public.editions e join public.works w on w.id=e.work_id
  where e.id=new.edition_id and e.work_id=new.work_id and w.author_id=new.bound_author_id
  and w.open_library_id=new.bound_open_library_work_id and e.title=new.bound_title
  and e.language=new.bound_language and e.isbn_13 is not distinct from new.bound_isbn13
  and e.open_library_edition_id=new.source_key and e.language in(case new.locale when 'nl' then 'nld' else 'eng' end,new.locale)) then
  raise exception 'Description edition/Work/source/language binding changed';
 end if;
 if new.fetched_at>clock_timestamp()+interval '5 minutes' or new.checked_at>clock_timestamp()+interval '5 minutes' then raise exception 'Future snapshot';end if;
 if tg_op='UPDATE' and (new.fetched_at<old.fetched_at or new.checked_at<old.checked_at) then raise exception 'Older provider response';end if;
 if tg_op='UPDATE' and new.fetched_at=old.fetched_at and
  (new.text is distinct from old.text or new.binding_hash is distinct from old.binding_hash) then
  raise exception 'Changed payload at the same fetch revision';end if;
 return new;
end $$;
revoke all on function public.guard_description_snapshot() from public,anon,authenticated;
create trigger description_snapshot_guard before insert or update on public.catalog_description_snapshots for each row execute function public.guard_description_snapshot();
comment on table public.catalog_description_snapshots is 'Last validated exact-edition Open Library synopsis. Not an editorial approval, index rule or reader record. No browser writes.';
-- A trusted correction/withdrawal must match the exact current snapshot.
create function public.withdraw_catalog_description_snapshot(p_work_id bigint,p_edition_id bigint,p_locale text,p_binding_hash text,p_fetched_at timestamptz)
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
commit;
