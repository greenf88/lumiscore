-- Read only. Compare function bodies, privileges and settings before applying the patch.
select n.nspname || '.' || p.proname || '(' || oidvectortypes(p.proargtypes) || ')' as signature,
       md5(p.prosrc) as body_md5, p.proconfig as settings, p.prosecdef as security_definer,
       p.proacl::text as acl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.oid in (
  to_regprocedure('product_metrics.valid_context(jsonb)'),
  to_regprocedure('product_metrics.record_event(uuid,text,jsonb)'),
  to_regprocedure('public.record_product_event_v1(uuid,text,jsonb)')
)
order by signature;
