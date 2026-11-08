-- Proposal: physically remove ordinary source snapshots after 90 days from fetch.
-- Withdrawal identities remain indefinitely without source bodies.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
do $preflight$ begin
 if to_regprocedure('public.cleanup_catalog_description_snapshots(integer)') is not null and md5(pg_get_functiondef(to_regprocedure('public.cleanup_catalog_description_snapshots(integer)')))<>'bd0711956e26ba4bcfe57c50cc4895cc' then raise exception 'Existing cleanup function differs';end if;
 if to_regclass('public.catalog_snapshot_cleanup_age_idx') is not null and md5(pg_get_indexdef(to_regclass('public.catalog_snapshot_cleanup_age_idx')))<>'843f315cdfb5c722206b3cd8d7b930bc' then raise exception 'Existing retention index differs';end if;
end $preflight$;
create index if not exists catalog_snapshot_cleanup_age_idx on public.catalog_description_snapshots(fetched_at,work_id,edition_id,locale)
 where provider_status<>'withdrawn';
create or replace function public.cleanup_catalog_description_snapshots(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=pg_catalog set lock_timeout='100ms' as $$
declare cutoff timestamptz:=statement_timestamp()-interval '2160 hours'; removed integer;
begin
 if p_limit is null or p_limit<1 or p_limit>500 then raise exception 'Cleanup batch must be 1..500';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('catalog_description_snapshot_cleanup_v1',0)) then
  return jsonb_build_object('deleted',0,'skipped_overlap',true);end if;
 with candidates as (
  select work_id,edition_id,locale,fetched_at from public.catalog_description_snapshots
  where provider_status<>'withdrawn' and fetched_at<cutoff
  order by fetched_at,work_id,edition_id,locale for update skip locked limit p_limit
 ), deleted as (
  delete from public.catalog_description_snapshots s using candidates c
  where s.work_id=c.work_id and s.edition_id=c.edition_id and s.locale=c.locale
   and s.fetched_at=c.fetched_at and s.fetched_at<cutoff and s.provider_status<>'withdrawn'
  returning 1
 ) select count(*) into removed from deleted;
 raise log 'catalog_snapshot_cleanup deleted=% cutoff=%',removed,cutoff;
 return jsonb_build_object('deleted',removed,'skipped_overlap',false,'cutoff',cutoff);
end $$;
revoke all on function public.cleanup_catalog_description_snapshots(integer) from public,anon,authenticated;
grant execute on function public.cleanup_catalog_description_snapshots(integer) to service_role;
comment on function public.cleanup_catalog_description_snapshots(integer) is 'Bounded PR92 source-body retention. Never removes withdrawals, reviewed text or public revision evidence. No retry loop.';
commit;
