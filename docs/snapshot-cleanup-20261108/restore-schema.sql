-- Only own unchanged code objects; never restore already removed bodies.
begin;set local lock_timeout='3s';do $$ begin
if md5(pg_get_functiondef('public.cleanup_catalog_description_snapshots(integer)'::regprocedure))<>'b2acfe3e4f6d4a9314d600fd6622b831' or md5(pg_get_indexdef('public.catalog_snapshot_cleanup_age_idx'::regclass))<>'843f315cdfb5c722206b3cd8d7b930bc' then raise exception 'Cleanup implementation drift';end if;
if exists(select 1 from cron.job where command like '%cleanup_catalog_description_snapshots%') then raise exception 'Stop cleanup jobs first';end if;end $$;
drop function public.cleanup_catalog_description_snapshots(integer);drop index public.catalog_snapshot_cleanup_age_idx;commit;

