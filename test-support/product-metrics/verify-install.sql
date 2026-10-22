-- READ ONLY metadata, no user/ratings/events or mutation. Check tool project_id
-- hlvujbrmfdlrfxdjwsmb independently; a SQL setting is not project identity proof.
select jsonb_build_object(
 'test_marker',(select count(*) from discovery_test_private.marker where identity='lumiscore-pr8-synthetic-v1'),
 'schema',to_regnamespace('product_metrics_test')::text,
 'schema_comment',obj_description(to_regnamespace('product_metrics_test'),'pg_namespace'),
 'tables',(select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
 'anon_select',has_table_privilege('anon',c.oid,'SELECT'),'authenticated_select',has_table_privilege('authenticated',c.oid,'SELECT'),
 'anon_write',has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE'),'authenticated_write',has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE'),
 'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull) order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped))), '[]'::jsonb)
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='product_metrics_test' and c.relkind='r'),
 'functions',(select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'returns',pg_get_function_result(p.oid),
 'body_md5',md5(p.prosrc),'definer',p.prosecdef,'settings',p.proconfig,'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,
 'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'))),'[]'::jsonb)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='product_metrics_test' or(n.nspname='public' and p.proname in('record_product_event_test_v1','record_product_events_test_v1','record_product_sign_in_test_v1'))),
 'triggers',(select coalesce(jsonb_agg(jsonb_build_object('name',tgname,'table',tgrelid::regclass::text,'enabled',tgenabled,'definition',pg_get_triggerdef(oid))),'[]'::jsonb) from pg_trigger where not tgisinternal and tgname like 'product_metric%')
) as verification;
