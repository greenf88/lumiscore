// Test-only narrowing wrapper. No network/database client or production execution.
import{renderRollback}from'./catalog-release-sql.mjs';
const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
export function exactRollback(plan){
 if(plan.summary.target!=='hlvujbrmfdlrfxdjwsmb')throw Error('Test project only');
 const guard=`do $manifest_guard$ declare reviewed jsonb:=${literal(plan.actions)};receipt jsonb;r jsonb;p jsonb;k jsonb;expected jsonb;prior jsonb;ids jsonb:='{}';kv record;i integer:=0;n integer;begin
 receipt:=nullif(current_setting('lumiscore.catalog_release_receipt',true),'')::jsonb;
 if receipt->>'project' is distinct from '${plan.summary.target}' or receipt->>'batch' is distinct from '${plan.summary.batch}' or jsonb_typeof(receipt->'rows') is distinct from 'array' or jsonb_array_length(receipt->'rows')<>${plan.actions.length} then raise exception 'Exact manifest receipt required';end if;
 for p in select value from jsonb_array_elements(reviewed) loop
  i:=i+1;select count(*) into n from jsonb_array_elements(receipt->'rows')x where x->>'seq'=i::text;
  if n<>1 then raise exception 'Receipt manifest sequence mismatch';end if;
  select x into r from jsonb_array_elements(receipt->'rows')x where x->>'seq'=i::text;
  if r->>'relation' is distinct from p->>'relation' then raise exception 'Receipt manifest relation mismatch';end if;
  k:=p->'key';expected:=p->'after';prior:=p->'before';
  for kv in select * from jsonb_each(expected) loop
   if jsonb_typeof(kv.value)='string' and left(kv.value#>>'{}',1)='@' then
    if not ids ? substring(kv.value#>>'{}',2) then raise exception 'Receipt manifest missing parent';end if;
    expected:=jsonb_set(expected,array[kv.key],ids->substring(kv.value#>>'{}',2));end if;
  end loop;
  for kv in select * from jsonb_each(k) loop
   if jsonb_typeof(kv.value)='string' and left(kv.value#>>'{}',1)='@' then k:=jsonb_set(k,array[kv.key],ids->substring(kv.value#>>'{}',2));end if;
  end loop;
  if prior<>'null'::jsonb then execute format('select to_jsonb(jsonb_populate_record(null::public.%I,$1))',p->>'relation') into prior using prior;end if;
  execute format('select coalesce(jsonb_object_agg(x.key,x.value),''{}''::jsonb) from jsonb_each(to_jsonb(jsonb_populate_record(null::public.%I,$1))) x where $1 ? x.key',p->>'relation') into expected using expected;
  if r->'key' is distinct from k or r->'before_row' is distinct from prior or jsonb_typeof(r->'after_row') is distinct from 'object' or not coalesce((r->'after_row')@>expected,false) then raise exception 'Receipt differs from exact reviewed manifest';end if;
  if r->'after_row' ? 'id' then ids:=jsonb_set(ids,array[p->>'ref'],r->'after_row'->'id');end if;
 end loop;
end;$manifest_guard$;\n`;
 return renderRollback(plan).replace('do $undo$',guard+'do $undo$');
}
