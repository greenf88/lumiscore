begin;
do $$ declare j record;begin
 select * into j from cron.job where jobname='lumiscore-source-cleanup-acceptance-20261108';
 if not found or j.command<>$cmd$set statement_timeout='5s';select public.cleanup_catalog_description_snapshots(100);$cmd$ then raise exception 'Unexpected own job';end if;
 if not exists(select 1 from cron.job_run_details where jobid=j.jobid and status='succeeded') then raise exception 'No successful real scheduler execution yet';end if;
 if exists(select 1 from catalog_description_snapshots where edition_id=979999981) then raise exception 'Old fixture not removed';end if;
 if not exists(select 1 from catalog_description_snapshots where edition_id=1407 and provider_status='resolved') or not exists(select 1 from catalog_description_snapshots where edition_id=5023 and provider_status='withdrawn' and text is null) then raise exception 'Current/withdrawn protection failed';end if;
 if (select count(*) from catalog_work_descriptions where work_id in(1372,4864) and review_status='approved')<>2 then raise exception 'Controlled content changed';end if;
 perform cron.unschedule(j.jobid);
end $$;commit;
select json_build_object('runs',(select json_agg(row(runid,jobid,status,start_time,end_time,return_message)) from cron.job_run_details where jobid=2),'old_deleted',not exists(select 1 from catalog_description_snapshots where edition_id=979999981),'current_retained',exists(select 1 from catalog_description_snapshots where edition_id=1407),'withdrawal_retained',exists(select 1 from catalog_description_snapshots where edition_id=5023 and text is null),'own_job_stopped',not exists(select 1 from cron.job where jobid=2),'existing_job_unchanged',(select json_agg(row(jobid,jobname,schedule,active)) from cron.job)) receipt;
