begin;
do $stop$ declare j record;begin
 select * into j from cron.job where jobname='lumiscore-reviewed-revision-publisher-v1';
 if found then
  if j.schedule<>'*/5 * * * *' or j.command<>$cmd$set statement_timeout='5s';select public.publish_catalog_public_revisions(50);$cmd$ then raise exception 'Publisher job changed; stop';end if;
  perform cron.unschedule(j.jobid);
 end if;
end $stop$;
commit;
-- Stopping scheduler preserves event evidence and published PR92 ledger dates.

