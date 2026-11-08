begin;
do $$ declare j record;begin
 select * into j from cron.job where jobname='lumiscore-publisher-acceptance-20261108';
 if not found or j.command<>$cmd$set statement_timeout='5s';select public.publish_catalog_public_revisions(50);$cmd$ then raise exception 'Unexpected own publisher job';end if;
 if not exists(select 1 from cron.job_run_details where jobid=j.jobid and status='succeeded') then raise exception 'No actual scheduler success';end if;
 if (select count(*) from catalog_public_revision_events where receipt_sha256='7b7887c947da544d699d5e53d8374eecb65956d3ee5098de153131f95fb58222' and state='published' and attempts=1)<>1 then raise exception 'Unexpected fixture publication';end if;
 perform cron.unschedule(j.jobid);
end $$;commit;
select json_build_object('stopped',not exists(select 1 from cron.job where jobname='lumiscore-publisher-acceptance-20261108'),'events',(select json_agg(to_jsonb(e)) from catalog_public_revision_events e),'ledger',(select json_agg(to_jsonb(r)) from catalog_public_page_revisions r),'runs',(select json_agg(row(runid,jobid,status,start_time,end_time)) from cron.job_run_details where jobid=3)) receipt;
