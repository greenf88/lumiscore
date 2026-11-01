-- PROPOSAL ONLY. Non-destructive disable; keep metrics and all business data.
-- Requires captured ABSENT baseline, exact function bodies and current owner.
begin;
set local lock_timeout='2s';
do $$declare r record;got text;j record;begin
 if current_setting('lumiscore.metrics.release_target',true) is distinct from 'qvplwejffhjvxaypmjut' then raise exception 'EXPLICIT_PRODUCTION_TARGET_REQUIRED';end if;
 if current_setting('lumiscore.metrics.absent_baseline',true) is distinct from 'confirmed' then raise exception 'ABSENT_BASELINE_REVIEW_REQUIRED';end if;
 if obj_description(to_regnamespace('product_metrics'),'pg_namespace') is distinct from 'lumiscore-product-metrics-v3-production' then raise exception 'UNEXPECTED_SCHEMA';end if;
 if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='product_metrics')<>9 then raise exception 'PRIVATE_FUNCTIONS_CHANGED';end if;
 for r in select * from(values ('product_metrics.cleanup(timestamp with time zone, integer)','6a16d6c599a51b018e7eca57142d2769','{postgres=X/postgres}'),('product_metrics.consent(text, uuid, timestamp with time zone)','274446b3a8bc910162a06b1e64c3ec62','{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}'),('product_metrics.current_time()','0f07466da6eaa28778c1857bfdde383d','{postgres=X/postgres}'),('product_metrics.observe_transition()','c12ac03bfd16b52b7dff5bfc50a62707','{postgres=X/postgres}'),('product_metrics.operational(text)','7c25ee228f419ea81b09d7e19e507fc2','{postgres=X/postgres}'),('product_metrics.record_event(uuid, text, jsonb)','6defac60d9666fc12a8a55619f95054f','{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}'),('product_metrics.request_context()','3b9bb3cd1f073273812eba10c9a66d4e','{postgres=X/postgres}'),('product_metrics.request_grant()','df834b387ae70986416c2a5f73e8fa3e','{postgres=X/postgres}'),('product_metrics.valid_context(jsonb)','dbd4208e0de0a22889ca349e182c804a','{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}'),('public.product_analysis_consent_v3(text, uuid, timestamp with time zone)','505eda940ccc872aa2cf9c1048b9e0b4','{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}'),('public.record_product_event_v1(uuid, text, jsonb)','250c772c796fe4fbafff3ce2f8e9b9e3','{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}'),('public.record_product_events_v1(jsonb)','388765abd73b1a038aa0afdf55e963af','{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}'),('public.record_product_sign_in_v1(jsonb)','5ccdcce95a5b4350af5666ea0ab747cd','{postgres=X/postgres,authenticated=X/postgres}'))v(signature,expected,expected_acl) loop
  select md5(prosrc) into got from pg_proc where oid=to_regprocedure(r.signature);
  if got is distinct from r.expected or (select coalesce(proacl::text,'') from pg_proc where oid=to_regprocedure(r.signature)) is distinct from r.expected_acl then raise exception 'FUNCTION_OR_RIGHTS_CHANGED:%',r.signature;end if;
 end loop;
 if (select count(*) from pg_trigger where not tgisinternal and tgname like 'product_metric%')<>3 then raise exception 'TRIGGER_COUNT_CHANGED';end if;
 for r in select * from(values('product_metric_rating_v1','public.ratings'::regclass),('product_metric_status_v1','public.user_book_status'::regclass),('product_metric_round_v1','public.taste_rating_rounds'::regclass))v(name,relation) loop
 if not exists(select 1 from pg_trigger where tgname=r.name and tgrelid=r.relation and not tgisinternal and tgfoid=to_regprocedure('product_metrics.observe_transition()')) then raise exception 'TRIGGER_CHANGED';end if;
 end loop;
 if to_regclass('cron.job') is not null then
  execute 'select * from cron.job where jobname=''lumiscore-product-metrics-cleanup-v3''' into j;
  if j.jobid is not null then
   if j.command is distinct from 'SET statement_timeout=''3s''; SELECT product_metrics.cleanup();' or j.schedule<>'*/5 * * * *' or j.username<>current_user or j.database<>current_database() then raise exception 'CRON_CHANGED';end if;
   perform cron.unschedule(j.jobid);
  end if;
 end if;
end$$;
drop trigger product_metric_rating_v1 on public.ratings;
drop trigger product_metric_status_v1 on public.user_book_status;
drop trigger product_metric_round_v1 on public.taste_rating_rounds;
revoke all on function public.record_product_event_v1(uuid,text,jsonb),public.record_product_events_v1(jsonb),public.record_product_sign_in_v1(jsonb),public.product_analysis_consent_v3(text,uuid,timestamptz) from public,anon,authenticated,service_role;
revoke all on all functions in schema product_metrics from public,anon,authenticated,service_role;
revoke usage on schema product_metrics from public,anon,authenticated,service_role;
-- No DROP SCHEMA/CASCADE, no business DELETE, no sequence reset.
-- Default dry run. Change final ROLLBACK to COMMIT only for the approved disable.
rollback;
