begin;do $stop$ declare j record;begin
 select * into j from cron.job where jobname='lumiscore-description-snapshot-cleanup-v1';
 if found then if j.schedule<>'17 * * * *' or j.command<>$cmd$set statement_timeout='5s';do $run$ declare j record;recent text[];begin
 select * into j from cron.job where jobname='lumiscore-description-snapshot-cleanup-v1';
 if not found or not j.active then raise exception 'Expected own active cleanup job';end if;
 select array_agg(status) into recent from(select status from cron.job_run_details where jobid=j.jobid and status in('succeeded','failed') order by runid desc limit 3) r;
 if recent=array['failed','failed','failed'] then
  perform cron.alter_job(j.jobid,active:=false);
  raise warning 'catalog_snapshot_cleanup paused after three failed runs';return;
 end if;
 perform public.cleanup_catalog_description_snapshots(100);
end $run$;$cmd$ then raise exception 'Changed cleanup job; stop';end if;perform cron.unschedule(j.jobid);end if;
end $stop$;commit;
-- Stops future runs only; physically deleted snapshots cannot be recovered by unscheduling.
