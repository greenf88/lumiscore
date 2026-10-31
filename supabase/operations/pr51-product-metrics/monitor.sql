-- PRIVILEGED READ ONLY; no public reporting RPC or new alert destination.
-- Execute independently of traffic. A missing/failed job is not successful cleanup.
select s.last_attempt_at,s.last_success_at,s.last_error_code,s.backlog,
 coalesce(s.last_success_at<clock_timestamp()-interval '10 minutes',true) as cleanup_overdue
from (select 1) x left join product_metrics.maintenance_state s on s.task='cleanup';
select minute,reason,n from product_metrics.operational_counts
where minute>=clock_timestamp()-interval '24 hours' order by minute,reason;
-- Every observed rejection/storage failure means incomplete measurement.
-- Client/network losses and failed operational-counter writes remain unknown.
select coalesce(sum(n) filter(where reason in('project_rate_limited','grant_rate_limited','busy','storage_error')),0) as observed_lost,
 coalesce(sum(n) filter(where reason='accepted'),0) as observed_accepted,
 'Never equate this to all loss or unique visitor conversion' as limitation
from product_metrics.operational_counts where minute>=clock_timestamp()-interval '24 hours';
-- Run these only after the separate pg_cron test installation succeeds:
-- select jobid,jobname,schedule,active from cron.job where jobname='lumiscore-product-metrics-cleanup-v3';
-- select status,start_time,end_time from cron.job_run_details where jobid=(select jobid from cron.job where jobname='lumiscore-product-metrics-cleanup-v3') order by start_time desc limit 10;
