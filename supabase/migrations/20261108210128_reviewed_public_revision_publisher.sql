-- Operational journal for explicitly reviewed page revisions; no source text.
-- Uses PR92's sole public revision ledger and recorder. No catalogue triggers/backfill.
begin;
create table public.catalog_public_revision_events(
 event_id uuid primary key default gen_random_uuid(),
 work_id bigint not null references public.works(id), locale text not null check(locale in('en','nl')),
 expected_hash text check(expected_hash ~ '^[a-f0-9]{64}$'), new_hash text not null check(new_hash ~ '^[a-f0-9]{64}$'),
 changed_at timestamptz not null check(changed_at>='1990-01-01'),
 receipt_sha256 text not null check(receipt_sha256 ~ '^[a-f0-9]{64}$'),
 projection_version text not null check(projection_version='catalog_public_v2'),
 state text not null default 'pending' check(state in('pending','published','failed')),
 attempts integer not null default 0 check(attempts between 0 and 3),
 next_attempt_at timestamptz not null default now(), created_at timestamptz not null default now(),
 published_at timestamptz, error_code text check(error_code ~ '^[A-Z0-9]{5}$'),
 unique(work_id,locale,receipt_sha256)
);
alter table public.catalog_public_revision_events enable row level security;
alter table public.catalog_public_revision_events force row level security;
revoke all on public.catalog_public_revision_events from public,anon,authenticated,service_role;
create index catalog_revision_pending_idx on public.catalog_public_revision_events(next_attempt_at,changed_at,created_at,event_id) where state='pending';
create function public.enqueue_catalog_public_revision(p_work_id bigint,p_locale text,p_expected_hash text,p_new_hash text,p_changed_at timestamptz,p_receipt_sha256 text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare prior public.catalog_public_revision_events%rowtype; eid uuid;
begin
 if p_changed_at is null or p_changed_at>clock_timestamp()+interval '5 minutes' then raise exception 'Invalid real content change date';end if;
 perform pg_advisory_xact_lock(hashtextextended('enqueue:'||p_work_id::text||':'||p_locale,0));
 select * into prior from public.catalog_public_revision_events where work_id=p_work_id and locale=p_locale and receipt_sha256=p_receipt_sha256;
 if found then
  if prior.expected_hash is distinct from p_expected_hash or prior.new_hash is distinct from p_new_hash or prior.changed_at is distinct from p_changed_at then raise exception 'Receipt reused with different revision';end if;
  return prior.event_id;
 end if;
 insert into public.catalog_public_revision_events(work_id,locale,expected_hash,new_hash,changed_at,receipt_sha256,projection_version)
 values(p_work_id,p_locale,p_expected_hash,p_new_hash,p_changed_at,p_receipt_sha256,'catalog_public_v2') returning event_id into eid;
 return eid;
end $$;
revoke all on function public.enqueue_catalog_public_revision(bigint,text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.enqueue_catalog_public_revision(bigint,text,text,text,timestamptz,text) to service_role;
create function public.publish_catalog_public_revisions(p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path=pg_catalog set lock_timeout='100ms' as $$
declare e record; published integer:=0; rejected integer:=0; err text;
begin
 if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Publisher batch must be 1..100';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('catalog_public_revision_publisher_v1',0)) then return jsonb_build_object('published',0,'skipped_overlap',true);end if;
 for e in select * from public.catalog_public_revision_events where state='pending' and attempts<3 and next_attempt_at<=statement_timestamp()
 order by changed_at,created_at,event_id for update skip locked limit p_limit loop
  begin
   perform public.record_catalog_public_revision(e.work_id,e.locale,e.expected_hash,e.new_hash,e.changed_at,e.receipt_sha256);
   update public.catalog_public_revision_events set state='published',published_at=clock_timestamp(),attempts=attempts+1,error_code=null where event_id=e.event_id;
   published:=published+1;
  exception when others then
   get stacked diagnostics err=returned_sqlstate;
   update public.catalog_public_revision_events set attempts=attempts+1,state=case when attempts+1>=3 then 'failed' else 'pending' end,
    next_attempt_at=clock_timestamp()+make_interval(mins=>5*(attempts+1)),error_code=err where event_id=e.event_id;
   rejected:=rejected+1;
  end;
 end loop;
 return jsonb_build_object('published',published,'deferred_or_failed',rejected,'skipped_overlap',false);
end $$;
revoke all on function public.publish_catalog_public_revisions(integer) from public,anon,authenticated;
grant execute on function public.publish_catalog_public_revisions(integer) to service_role;
comment on table public.catalog_public_revision_events is 'Private operational hash/receipt journal, not a second metadata store. Enqueue only after a separately reviewed committed public content change. No source text, readers or automatic source promotion.';
commit;
