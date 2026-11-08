-- Public verified change ledger. No automatic dates or historical backfill.
-- Stop if an object with this name exists. No invented historical backfill.
begin;
create table public.catalog_public_page_revisions (
 work_id bigint not null references public.works(id),
 locale text not null check(locale in ('nl','en')),
 presentation_hash text not null check(presentation_hash ~ '^[a-f0-9]{64}$'),
 content_changed_at timestamptz not null,
 receipt_sha256 text not null check(receipt_sha256 ~ '^[a-f0-9]{64}$'),
 primary key(work_id,locale)
);
alter table public.catalog_public_page_revisions enable row level security;
alter table public.catalog_public_page_revisions force row level security;
revoke all on public.catalog_public_page_revisions from public,anon,authenticated,service_role;
grant select on public.catalog_public_page_revisions to anon,authenticated,service_role;
create policy public_revision_read on public.catalog_public_page_revisions for select using(true);
create function public.record_catalog_public_revision(
 p_work_id bigint,p_locale text,p_expected_hash text,p_new_hash text,p_changed_at timestamptz,p_receipt_sha256 text
)returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare prior public.catalog_public_page_revisions%rowtype;
begin
 if p_locale is null or p_locale not in('nl','en') or p_new_hash is null
  or p_new_hash !~ '^[a-f0-9]{64}$' or p_receipt_sha256 is null or p_receipt_sha256 !~ '^[a-f0-9]{64}$' or p_changed_at is null
  or p_changed_at>clock_timestamp()+interval '5 minutes' then
  raise exception 'Invalid verified content revision';
 end if;
 -- Serialize the missing-row case too, without table-wide locking.
 perform pg_advisory_xact_lock(hashtextextended(p_work_id::text||':'||p_locale,0));
 select * into prior from public.catalog_public_page_revisions where work_id=p_work_id and locale=p_locale for update;
 if found then
  if prior.presentation_hash is distinct from p_expected_hash then raise exception 'Revision changed since manifest';end if;
  if prior.presentation_hash=p_new_hash then return false;end if;
  if p_changed_at<prior.content_changed_at then raise exception 'Content chronology conflict';end if;
  update public.catalog_public_page_revisions set presentation_hash=p_new_hash,content_changed_at=p_changed_at,receipt_sha256=p_receipt_sha256 where work_id=p_work_id and locale=p_locale;
 else
  if p_expected_hash is not null then raise exception 'Expected revision absent';end if;
  insert into public.catalog_public_page_revisions values(p_work_id,p_locale,p_new_hash,p_changed_at,p_receipt_sha256);
 end if;
 return true;
end $$;
revoke all on function public.record_catalog_public_revision(bigint,text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.record_catalog_public_revision(bigint,text,text,text,timestamptz,text) to service_role;
commit;
