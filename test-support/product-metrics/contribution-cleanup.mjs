// Operator-only test cleanup renderer. No network, credentials or implicit writes.
const keys={daily_counters:['day','event','dimensions'],operational_counts:['minute','reason'],budgets:['minute'],grant_budgets:['grant_id','minute'],receipts:['event_id'],consent_grants:['token']};
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'";
export function contributionCleanup(manifest){
 if(manifest.project!=='hlvujbrmfdlrfxdjwsmb'||manifest.run!=='pr51-acceptance-20261101-v2'||!Array.isArray(manifest.rows)||manifest.rows.length>2000)throw Error('Exact reviewed test contribution manifest required');
 const seen=new Set();
 for(const r of manifest.rows){
  const columns=keys[r.table];if(!columns||!r.after||!r.key||!('before'in r)||Object.keys(r.key).sort().join()!==[...columns].sort().join()||columns.some(k=>!same(r.key[k],r.after[k])))throw Error('Exact supported row key required');
  const id=r.table+JSON.stringify(canonical(r.key));if(seen.has(id))throw Error('Duplicate cleanup key');seen.add(id);
  if('n'in r.after){if(!Number.isSafeInteger(r.delta)||r.delta<1||!Number.isSafeInteger(r.after.n)||r.after.n-(r.before?.n??0)!==r.delta)throw Error('Exact own contribution required');
   if(r.before&&(!same(Object.fromEntries(Object.entries(r.before).filter(([k])=>k!=='n')),Object.fromEntries(Object.entries(r.after).filter(([k])=>k!=='n')))||r.before.n<1))throw Error('Shared row identity changed');
  }else if(r.before!==null||r.delta!==undefined)throw Error('Only new exact individual receipts/grants may be removed');
 }
 return `begin;set local lock_timeout='2s';set local statement_timeout='10s';
lock table ${Object.keys(keys).map(t=>'product_metrics_test.'+t).join(',')} in share row exclusive mode;
do $cleanup$ declare f jsonb:=${literal(manifest)}::jsonb;r jsonb;actual jsonb;affected integer;begin
 if f->>'project'<>'hlvujbrmfdlrfxdjwsmb' or not exists(select 1 from discovery_test_private.marker where identity='lumiscore-pr8-synthetic-v1')then raise exception 'TEST_TARGET_REQUIRED';end if;
 for r in select value from jsonb_array_elements(f->'rows') loop
  execute format('select to_jsonb(t)from product_metrics_test.%I t where to_jsonb(t)@>$1 for update',r->>'table')into actual using r->'key';
  if actual is not distinct from nullif(r->'before','null'::jsonb)then continue;end if;
  if actual is distinct from r->'after'then raise exception 'LATER_OR_SHARED_CHANGE_STOP: %',r->>'table';end if;
  if r->'before'='null'::jsonb then
   execute format('delete from product_metrics_test.%I t where to_jsonb(t)=$1',r->>'table')using r->'after';
  else
   execute format('update product_metrics_test.%I t set n=n-$1 where to_jsonb(t)=$2',r->>'table')using (r->>'delta')::bigint,r->'after';
  end if;
  get diagnostics affected=row_count;if affected<>1 then raise exception 'EXACT_CONTRIBUTION_COUNT';end if;
 end loop;
end $cleanup$;commit;`;
}
