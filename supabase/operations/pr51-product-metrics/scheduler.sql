-- PROPOSAL ONLY for qvplwejffhjvxaypmjut; install AFTER install.sql.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
do $$begin
 if current_setting('lumiscore.metrics.release_target',true) is distinct from 'qvplwejffhjvxaypmjut' then raise exception 'EXPLICIT_PRODUCTION_TARGET_REQUIRED';end if;
 if obj_description(to_regnamespace('product_metrics'),'pg_namespace') is distinct from 'lumiscore-product-metrics-v3-production' then raise exception 'PRODUCTION_V3_TARGET_REQUIRED';end if;
end$$;
create extension if not exists pg_cron;
do $$declare j record;command_text text:='SET statement_timeout=''3s''; SELECT product_metrics.cleanup();';begin
 select * into j from cron.job where jobname='lumiscore-product-metrics-cleanup-v3';
 if found then
  if j.command is distinct from command_text or j.schedule<>'*/5 * * * *' or j.username<>current_user or j.database<>current_database() or not j.active then raise exception 'UNEXPECTED_EXISTING_METRICS_JOB';end if;
 else
  perform cron.schedule('lumiscore-product-metrics-cleanup-v3','*/5 * * * *',command_text);
 end if;
end$$;
commit;
