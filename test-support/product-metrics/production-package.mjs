// Operator-only rendering. No network, database connection or implicit writes.
import {readFile} from 'node:fs/promises';
export const productionProject='qvplwejffhjvxaypmjut';
export const productionSchema='product_metrics';
const read=async n=>(await readFile(new URL(n,import.meta.url),'utf8')).replaceAll('\r\n','\n');
export function productionNames(sql){
 return sql.replaceAll('product_metrics_test','product_metrics')
  .replaceAll('product_analysis_consent_test_v3','product_analysis_consent_v3')
  .replaceAll('record_product_event_test_v1','record_product_event_v1')
  .replaceAll('record_product_events_test_v1','record_product_events_v1')
  .replaceAll('record_product_sign_in_test_v1','record_product_sign_in_v1')
  .replaceAll('lumiscore-product-metrics-test-cleanup-v3','lumiscore-product-metrics-cleanup-v3')
  .replaceAll('lumiscore-product-metrics-v3-test','lumiscore-product-metrics-v3-production')
  .replaceAll("p->>'traffic'='synthetic'","p->>'traffic'='production'");
}
export const productionLatch=`if current_setting('lumiscore.metrics.release_target',true) is distinct from '${productionProject}' then raise exception 'EXPLICIT_PRODUCTION_TARGET_REQUIRED';end if;`;
export async function productionInstaller(){
 const source=await read('install.sql');
 const firstSchema=source.indexOf('create schema if not exists product_metrics_test;');
 if(firstSchema<0)throw Error('Reviewed test installer changed');
 const guard=`-- PROPOSAL ONLY. Run on ${productionProject} only after release approval.
-- Fresh installation only; stop on existing objects. Never rename the TEST schema.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
do $$begin
 ${productionLatch}
 if to_regnamespace('discovery_test_private') is not null then raise exception 'TEST_DATABASE_FORBIDDEN';end if;
 if to_regnamespace('product_metrics') is not null
 or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('record_product_event_v1','record_product_events_v1','record_product_sign_in_v1','product_analysis_consent_v3'))
 or exists(select 1 from pg_trigger where not tgisinternal and tgname like 'product_metric%')
 then raise exception 'EXISTING_METRICS_STOP_CAPTURE_BASELINE';end if;
end$$;
`;
 return guard+productionNames(source.slice(firstSchema)).replace(/commit;\s*$/i,`-- Explicitly exclude Supabase service_role defaults; not needed by the app.
revoke all on schema product_metrics from service_role;
revoke all on all tables in schema product_metrics from service_role;
revoke all on all functions in schema product_metrics from service_role;
commit;
`);
}
export async function productionScheduler(){
 const source=productionNames(await read('scheduler-test.sql'));
 return source.replace('-- TEST ONLY, separate installation after install.sql. Never run on production.',`-- PROPOSAL ONLY for ${productionProject}; install AFTER install.sql.`)
 .replace('begin;',"begin;\nset local lock_timeout='2s';\nset local statement_timeout='30s';")
 .replace("if not exists(select 1 from discovery_test_private.marker where identity='lumiscore-pr8-synthetic-v1') or ",productionLatch+'\n if ')
 .replace("raise exception 'TEST_V3_TARGET_REQUIRED'","raise exception 'PRODUCTION_V3_TARGET_REQUIRED'");
}
export async function productionReport(){return productionNames(await read('report.sql')).replaceAll("traffic='synthetic'","traffic='production'").replaceAll("->>'traffic'='synthetic'","->>'traffic'='production'").replace('-- On the isolated test project only:', '-- Production only:');}
export async function productionMonitor(){return productionNames(await read('monitor.sql'));}
export async function productionVerification(){
 return productionNames(await read('verify-install.sql')).replaceAll('hlvujbrmfdlrfxdjwsmb',productionProject).replace(/ 'test_marker',\(select count\(\*\) from discovery_test_private.marker where identity='lumiscore-pr8-synthetic-v1'\),/,'');
}
export function productionRollback(functions){
 if(functions.length!==13)throw Error('Exact thirteen function fingerprints required');
 return `-- PROPOSAL ONLY. Non-destructive disable; keep metrics and all business data.
-- Requires captured ABSENT baseline, exact function bodies and current owner.
begin;
set local lock_timeout='2s';
do $$declare r record;got text;j record;begin
 ${productionLatch}
 if current_setting('lumiscore.metrics.absent_baseline',true) is distinct from 'confirmed' then raise exception 'ABSENT_BASELINE_REVIEW_REQUIRED';end if;
 if obj_description(to_regnamespace('product_metrics'),'pg_namespace') is distinct from 'lumiscore-product-metrics-v3-production' then raise exception 'UNEXPECTED_SCHEMA';end if;
 if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='product_metrics')<>9 then raise exception 'PRIVATE_FUNCTIONS_CHANGED';end if;
 for r in select * from(values ${functions.map(f=>`('${f.signature}','${f.body_md5}','${f.acl?.replaceAll("'","''")??''}')`).join(',')})v(signature,expected,expected_acl) loop
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
`;
}
