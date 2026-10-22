-- TEST ONLY. Default ROLLBACK; source data and retained counters are never deleted.
-- Preconditions: verified project hlvujbrmfdlrfxdjwsmb, saved absent baseline and
-- current verify-install.sql output. If baseline objects existed, restore the
-- captured definitions/ACLs instead; this path MUST NOT be used.
-- An operator must set lumiscore.metrics.absent_baseline='confirmed' in this
-- transaction after reviewing evidence, then deliberately change final ROLLBACK
-- to COMMIT. This setting is a safety latch, not actual target/auth validation.
begin;
set local lock_timeout='2s';
do $$declare r record;got text;begin
 if current_setting('lumiscore.metrics.absent_baseline',true) is distinct from 'confirmed' then raise exception 'ABSENT_BASELINE_REVIEW_REQUIRED';end if;
 if not exists(select 1 from discovery_test_private.marker where identity='lumiscore-pr8-synthetic-v1') then raise exception 'TEST_TARGET_REQUIRED';end if;
 if obj_description(to_regnamespace('product_metrics_test'),'pg_namespace') is distinct from 'lumiscore-product-metrics-v2-test' then raise exception 'UNEXPECTED_SCHEMA';end if;
 if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='product_metrics_test')<>4 then raise exception 'UNEXPECTED_PRIVATE_FUNCTIONS';end if;
 for r in select * from(values
 ('product_metrics_test.observe_transition()','aedfe031193840152543c6ebe9bee28f'),
 ('product_metrics_test.record_event(uuid,text,jsonb)','3386dfdcfeb6ffef6966d5461cb0ae0a'),
 ('product_metrics_test.request_context()','b241bc45b0bfe5a399bcb0e90786780c'),
 ('product_metrics_test.valid_context(jsonb)','0313e1ecf9ba7b34709e9b136e710d90'),
 ('public.record_product_event_test_v1(uuid,text,jsonb)','8c373b1093031520d683a1bdcf626572'),
 ('public.record_product_events_test_v1(jsonb)','c1d64cce8930bd56218af5f8e00264ba'),
 ('public.record_product_sign_in_test_v1(jsonb)','1827e4bf18acdd4b8dead177f298175f'))v(signature,expected) loop
  select md5(prosrc) into got from pg_proc where oid=to_regprocedure(r.signature);
  if got is distinct from r.expected then raise exception 'FUNCTION_CHANGED: %',r.signature;end if;
 end loop;
 if (select count(*) from pg_trigger where not tgisinternal and tgname like 'product_metric%')<>3 then raise exception 'UNEXPECTED_TRIGGER_COUNT';end if;
 for r in select * from(values('product_metric_rating_v1','public.ratings'::regclass),('product_metric_status_v1','public.user_book_status'::regclass),('product_metric_round_v1','public.taste_rating_rounds'::regclass))v(name,relation) loop
  if not exists(select 1 from pg_trigger where tgname=r.name and tgrelid=r.relation and not tgisinternal and tgfoid=to_regprocedure('product_metrics_test.observe_transition()')) then raise exception 'UNEXPECTED_TRIGGER: %',r.name;end if;
 end loop;
end$$;
drop trigger product_metric_rating_v1 on public.ratings;
drop trigger product_metric_status_v1 on public.user_book_status;
drop trigger product_metric_round_v1 on public.taste_rating_rounds;
revoke all on function public.record_product_event_test_v1(uuid,text,jsonb),public.record_product_events_test_v1(jsonb),public.record_product_sign_in_test_v1(jsonb) from public,anon,authenticated;
revoke execute on function product_metrics_test.valid_context(jsonb),product_metrics_test.record_event(uuid,text,jsonb) from public,anon,authenticated;
revoke usage on schema product_metrics_test from public,anon,authenticated;
-- Keep tables and functions, no CASCADE. Keep privileged read-only report access.
-- All other business triggers and app writes are unchanged.
rollback;
