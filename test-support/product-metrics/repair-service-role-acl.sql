-- TEST ONLY. Restore the reviewed four wrapper ACLs without changing defaults,
-- function bodies, tables, client-role permissions, or any business data.
begin;
set local lock_timeout='2s';
do $$declare r record;p record;begin
 if not exists(select 1 from discovery_test_private.marker where identity='lumiscore-pr8-synthetic-v1') or obj_description(to_regnamespace('product_metrics_test'),'pg_namespace') is distinct from 'lumiscore-product-metrics-v3-test' then raise exception 'TEST_V3_TARGET_REQUIRED';end if;
 for r in select * from(values
 ('public.product_analysis_consent_test_v3(text,uuid,timestamp with time zone)','e5017cd6fe79e95561bf7e5f3aac0718'),
 ('public.record_product_event_test_v1(uuid,text,jsonb)','8c373b1093031520d683a1bdcf626572'),
 ('public.record_product_events_test_v1(jsonb)','c1d64cce8930bd56218af5f8e00264ba'),
 ('public.record_product_sign_in_test_v1(jsonb)','1827e4bf18acdd4b8dead177f298175f'))v(signature,body_hash) loop
  select md5(prosrc) body_hash,prosecdef,proconfig into p from pg_proc where oid=to_regprocedure(r.signature);
  if not found or p.body_hash is distinct from r.body_hash or p.prosecdef or p.proconfig is distinct from array['search_path=""']::text[] then raise exception 'UNEXPECTED_FUNCTION: %',r.signature;end if;
  execute format('revoke execute on function %s from service_role',r.signature);
  if has_function_privilege('service_role',to_regprocedure(r.signature),'EXECUTE') then raise exception 'UNEXPECTED_INHERITED_SERVICE_ROLE_PERMISSION';end if;
 end loop;
end$$;
commit;
-- Targeted reversal ONLY if this repair needs reverting and the four function
-- hashes still match: restore the saved service_role EXECUTE on these four
-- signatures. Do not alter global/default ACLs or any other role/object.
