-- TEST ONLY, separate installation after install.sql. Never run on production.
begin;
do $$begin
 if not exists(select 1 from discovery_test_private.marker where identity='lumiscore-pr8-synthetic-v1') or obj_description(to_regnamespace('product_metrics_test'),'pg_namespace') is distinct from 'lumiscore-product-metrics-v3-test' then raise exception 'TEST_V3_TARGET_REQUIRED';end if;
end$$;
create extension if not exists pg_cron;
do $$declare j record;command_text text:='SET statement_timeout=''3s''; SELECT product_metrics_test.cleanup();';begin
 select * into j from cron.job where jobname='lumiscore-product-metrics-test-cleanup-v3';
 if found then
  if j.command is distinct from command_text or j.schedule<>'*/5 * * * *' or j.username<>current_user or j.database<>current_database() or not j.active then raise exception 'UNEXPECTED_EXISTING_METRICS_JOB';end if;
 else
  perform cron.schedule('lumiscore-product-metrics-test-cleanup-v3','*/5 * * * *',command_text);
 end if;
end$$;
commit;
