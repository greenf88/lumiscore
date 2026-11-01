// Operator-only SQL preparation. Never imported by the app; no network or writes.
const literal=x=>"'"+String(x).replaceAll("'","''")+"'";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tables={offers:'taste_rating_offers',rounds:'taste_rating_rounds',ratings:'ratings',statuses:'user_book_status',preferences:'user_reading_preferences'};
const metricTables=['daily_counters','receipts','consent_grants','budgets','grant_budgets','operational_counts'];
export function exactCleanup(manifest){
 if(manifest.project!=='hlvujbrmfdlrfxdjwsmb'||manifest.marker!==1||!uuid.test(manifest.own_account?.id)
  ||!manifest.own_account?.email?.endsWith('@example.test')||!manifest.own_account?.created_at
  ||manifest.sessions!==0||manifest.refresh_tokens!==0||manifest.active_grants!==0||manifest.bad_contexts!==0
  ||manifest.provenance!=='All selected metric rows are from the recorded PR51 isolated synthetic runs after the proven empty metric baseline; no other analysis writer used this test target.')throw Error('Exact reviewed test manifest required');
 for(const name of metricTables)if(!Array.isArray(manifest.metrics[name])||manifest.metrics[name].some(x=>!/^[a-f0-9]{32}$/.test(x))||new Set(manifest.metrics[name]).size!==manifest.metrics[name].length)throw Error('Exact unique metric row fingerprints required');
 for(const key of Object.keys(tables))if(!Array.isArray(manifest.business[key])||manifest.business[key].some(x=>x.user_id!==manifest.own_account.id))throw Error('Only exact owned business rows allowed');
 const json=literal(JSON.stringify(manifest));
 return `begin;
set local lock_timeout='2s';
do $exact$
declare f jsonb:=${json}::jsonb;uid uuid;entry record;got jsonb;deleted int;
begin
 if f->>'project'<>'hlvujbrmfdlrfxdjwsmb' or not exists(select 1 from discovery_test_private.marker where identity='lumiscore-pr8-synthetic-v1') then raise exception 'TEST_TARGET_REQUIRED';end if;
 uid:=(f->'own_account'->>'id')::uuid;
 perform 1 from auth.users where id=uid for update;
 if not exists(select 1 from auth.users where id=uid and email=f->'own_account'->>'email' and created_at=(f->'own_account'->>'created_at')::timestamptz) then raise exception 'EXACT_DISPOSABLE_ACCOUNT_REQUIRED';end if;
 if exists(select 1 from auth.sessions where user_id=uid) or exists(select 1 from auth.refresh_tokens where user_id=uid::text) then raise exception 'SIGN_OUT_FIRST';end if;
 if exists(select 1 from public.taste_test_responses where user_id=uid) or exists(select 1 from auth.scim_users where user_id=uid) then raise exception 'UNMANIFESTED_OWN_REFERENCES';end if;
 for entry in select * from (values ${Object.entries(tables).map(([k,t])=>`(${literal(k)},${literal(t)})`).join(',')})v(key,tablename) loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from public.%I t where user_id=$1',entry.tablename) into got using uid;
  if got is distinct from (select coalesce(jsonb_agg(value order by value::text),'[]'::jsonb) from jsonb_array_elements(f->'business'->entry.key)) then raise exception 'BUSINESS_ROW_CHANGED: %',entry.tablename;end if;
 end loop;
 lock table ${metricTables.map(t=>'product_metrics_test.'+t).join(',')} in share row exclusive mode;
 if exists(select 1 from product_metrics_test.consent_grants where revoked_at is null and expires_at>now()) then raise exception 'REVOKE_FIRST';end if;
 for entry in select value as tablename from jsonb_array_elements_text(${literal(JSON.stringify(metricTables))}::jsonb) loop
  execute format('select coalesce(jsonb_agg(md5(to_jsonb(t)::text) order by md5(to_jsonb(t)::text)),''[]''::jsonb) from product_metrics_test.%I t',entry.tablename) into got;
  if got is distinct from f->'metrics'->entry.tablename then raise exception 'METRIC_ROW_CHANGED: %',entry.tablename;end if;
 end loop;
 for entry in select * from (values ${Object.entries(tables).map(([k,t])=>`(${literal(k)},${literal(t)})`).join(',')})v(key,tablename) loop
  execute format('delete from public.%I where user_id=$1',entry.tablename) using uid;get diagnostics deleted=row_count;
  if deleted<>jsonb_array_length(f->'business'->entry.key) then raise exception 'BUSINESS_DELETE_COUNT';end if;
 end loop;
 delete from auth.users where id=uid and email=f->'own_account'->>'email';get diagnostics deleted=row_count;
 if deleted<>1 then raise exception 'ACCOUNT_DELETE_COUNT';end if;
 for entry in select value as tablename from jsonb_array_elements_text(${literal(JSON.stringify(metricTables))}::jsonb) loop
  execute format('delete from product_metrics_test.%I t where md5(to_jsonb(t)::text) in (select value from jsonb_array_elements_text($1))',entry.tablename) using f->'metrics'->entry.tablename;get diagnostics deleted=row_count;
  if deleted<>jsonb_array_length(f->'metrics'->entry.tablename) then raise exception 'METRIC_DELETE_COUNT';end if;
 end loop;
end $exact$;
commit;
`;
}
