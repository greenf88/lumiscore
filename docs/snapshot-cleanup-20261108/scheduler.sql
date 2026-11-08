-- Separately approved 90-day physical retention; existing pg_cron only.
-- Pauses its own job after three consecutive failed runs. Inspect/fix before explicit resume.
begin;
do $install$ declare j record;begin
 if md5(pg_get_functiondef(to_regprocedure('public.cleanup_catalog_description_snapshots(integer)'))) is distinct from 'b2acfe3e4f6d4a9314d600fd6622b831' then raise exception 'Exact cleanup implementation required';end if;
 select * into j from cron.job where jobname='lumiscore-description-snapshot-cleanup-v1';
 if found then
  if j.schedule<>'17 * * * *' or j.command<>$cmd$set statement_timeout='5s';do $run$ declare j record;recent text[];begin
 select * into j from cron.job where jobname='lumiscore-description-snapshot-cleanup-v1';
 if not found or not j.active then raise exception 'Expected own active cleanup job';end if;
 select array_agg(status) into recent from(select status from cron.job_run_details where jobid=j.jobid and status in('succeeded','failed') order by runid desc limit 3) r;
 if recent=array['failed','failed','failed'] then
  perform cron.alter_job(j.jobid,active:=false);
  raise warning 'catalog_snapshot_cleanup paused after three failed runs';return;
 end if;
 perform public.cleanup_catalog_description_snapshots(100);
end $run$;$cmd$ or not j.active then raise exception 'Existing cleanup job differs; stop';end if;
 else perform cron.schedule('lumiscore-description-snapshot-cleanup-v1','17 * * * *',$cmd$set statement_timeout='5s';do $run$ declare j record;recent text[];begin
 select * into j from cron.job where jobname='lumiscore-description-snapshot-cleanup-v1';
 if not found or not j.active then raise exception 'Expected own active cleanup job';end if;
 select array_agg(status) into recent from(select status from cron.job_run_details where jobid=j.jobid and status in('succeeded','failed') order by runid desc limit 3) r;
 if recent=array['failed','failed','failed'] then
  perform cron.alter_job(j.jobid,active:=false);
  raise warning 'catalog_snapshot_cleanup paused after three failed runs';return;
 end if;
 perform public.cleanup_catalog_description_snapshots(100);
end $run$;$cmd$);end if;
end $install$;
commit;
