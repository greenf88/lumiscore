-- Optional, separately approved existing pg_cron scheduling. No producer/backfill.
begin;
do $install$ declare j record;begin
 if md5(pg_get_functiondef(to_regprocedure('public.publish_catalog_public_revisions(integer)'))) is distinct from 'ff4771a57a55912034912bbec337175e' then raise exception 'Exact publisher implementation required';end if;
 select * into j from cron.job where jobname='lumiscore-reviewed-revision-publisher-v1';
 if found then
  if j.schedule<>'*/5 * * * *' or not j.active or j.command<>$cmd$set statement_timeout='5s';select public.publish_catalog_public_revisions(50);$cmd$ then raise exception 'Existing publisher job differs; stop';end if;
 else perform cron.schedule('lumiscore-reviewed-revision-publisher-v1','*/5 * * * *',$cmd$set statement_timeout='5s';select public.publish_catalog_public_revisions(50);$cmd$);end if;
end $install$;
commit;
-- Operational events retry after5/10 minutes, max3 then failed. No automatic producer.
-- Inspect SQLSTATE-only failed events via an authorized operator; do not delete/rewrite evidence.

