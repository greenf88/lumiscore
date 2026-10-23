-- TEST ONLY. Default ROLLBACK. Requires saved ABSENT baseline; retain all data.
-- If any objects pre-existed, restore saved definitions/ACLs, never this path.
begin;
set local lock_timeout='2s';
do $$declare r record;got text;j record;begin
 if current_setting('lumiscore.metrics.absent_baseline',true) is distinct from 'confirmed' then raise exception 'ABSENT_BASELINE_REVIEW_REQUIRED';end if;
 if not exists(select 1 from discovery_test_private.marker where identity='lumiscore-pr8-synthetic-v1') then raise exception 'TEST_TARGET_REQUIRED';end if;
 if obj_description(to_regnamespace('product_metrics_test'),'pg_namespace') is distinct from 'lumiscore-product-metrics-v3-test' then raise exception 'UNEXPECTED_SCHEMA';end if;
 if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='product_metrics_test')<>9 then raise exception 'UNEXPECTED_PRIVATE_FUNCTIONS';end if;
 for r in select * from(values
 ('product_metrics_test.cleanup(timestamp with time zone, integer)','8891f5e5729d384d01f3c54320edf519'),
 ('product_metrics_test.consent(text, uuid, timestamp with time zone)','4f55aa4157ef2f290935e87d3848e085'),
 ('product_metrics_test.current_time()','0f07466da6eaa28778c1857bfdde383d'),
 ('product_metrics_test.observe_transition()','aedfe031193840152543c6ebe9bee28f'),
 ('product_metrics_test.operational(text)','e218cc77e6ca60f5118dd657416cd76f'),
 ('product_metrics_test.record_event(uuid, text, jsonb)','67c79487a391c693ae29f2a34e5c02c9'),
 ('product_metrics_test.request_context()','4dca0a239c8aae2e73cdfc04624a7cb9'),
 ('product_metrics_test.request_grant()','df834b387ae70986416c2a5f73e8fa3e'),
 ('product_metrics_test.valid_context(jsonb)','0313e1ecf9ba7b34709e9b136e710d90'),
 ('public.product_analysis_consent_test_v3(text, uuid, timestamp with time zone)','e5017cd6fe79e95561bf7e5f3aac0718'),
 ('public.record_product_event_test_v1(uuid, text, jsonb)','8c373b1093031520d683a1bdcf626572'),
 ('public.record_product_events_test_v1(jsonb)','c1d64cce8930bd56218af5f8e00264ba'),
 ('public.record_product_sign_in_test_v1(jsonb)','1827e4bf18acdd4b8dead177f298175f'))v(signature,expected) loop
  select md5(prosrc) into got from pg_proc where oid=to_regprocedure(r.signature);
  if got is distinct from r.expected then raise exception 'FUNCTION_CHANGED: %',r.signature;end if;
 end loop;
 if (select count(*) from pg_trigger where not tgisinternal and tgname like 'product_metric%')<>3 then raise exception 'UNEXPECTED_TRIGGER_COUNT';end if;
 for r in select * from(values('product_metric_rating_v1','public.ratings'::regclass),('product_metric_status_v1','public.user_book_status'::regclass),('product_metric_round_v1','public.taste_rating_rounds'::regclass))v(name,relation) loop
  if not exists(select 1 from pg_trigger where tgname=r.name and tgrelid=r.relation and not tgisinternal and tgfoid=to_regprocedure('product_metrics_test.observe_transition()')) then raise exception 'UNEXPECTED_TRIGGER: %',r.name;end if;
 end loop;
 if to_regclass('cron.job') is not null then
  execute 'select * from cron.job where jobname=''lumiscore-product-metrics-test-cleanup-v3''' into j;
  if j.jobid is not null then
   if j.command is distinct from 'SET statement_timeout=''3s''; SELECT product_metrics_test.cleanup();' or j.schedule<>'*/5 * * * *' or j.username<>current_user or j.database<>current_database() then raise exception 'UNEXPECTED_METRICS_JOB';end if;
   perform cron.unschedule(j.jobid);
  end if;
 end if;
end$$;
drop trigger product_metric_rating_v1 on public.ratings;
drop trigger product_metric_status_v1 on public.user_book_status;
drop trigger product_metric_round_v1 on public.taste_rating_rounds;
revoke all on function public.record_product_event_test_v1(uuid,text,jsonb),public.record_product_events_test_v1(jsonb),public.record_product_sign_in_test_v1(jsonb),public.product_analysis_consent_test_v3(text,uuid,timestamptz) from public,anon,authenticated;
revoke all on all functions in schema product_metrics_test from public,anon,authenticated;
revoke usage on schema product_metrics_test from public,anon,authenticated;
-- Keep grant rows until expiry (no new writes are possible); keep counters for
-- separately approved cleanup. Do not drop pg_cron or other jobs, no CASCADE.
rollback;
