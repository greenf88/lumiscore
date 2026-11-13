import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {productionInstaller} from './production-package.mjs';

const hash=value=>createHash('md5').update(value).digest('hex');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
// Each replacement requires the complete reviewed function body, not merely a matching substring.
export async function leesroutesPatch(rollback=false,target='production'){
 assert.ok(['production','test'].includes(target));
 const isTest=target==='test';
 const baseline=isTest?await readFile(new URL('install.sql',import.meta.url),'utf8'):await productionInstaller();
 const normalize=value=>isTest?value.replaceAll('product_metrics.','product_metrics_test.').replaceAll('record_product_event_v1','record_product_event_test_v1'):value;
 const bodies=new Map();
 const changes=[];
 const change=(name,signature,before,after)=>{
  [name,signature,before,after]=[name,signature,before,after].map(normalize);
  let body=bodies.get(name);
  if(!body){const start=baseline.indexOf('create or replace function '+name+'(');assert.notEqual(start,-1);const from=baseline.indexOf('as $$',start)+5;body=baseline.slice(from,baseline.indexOf('$$;',from));}
  assert.equal(body.split(before).length,2,name+' must have exactly one fragment');
  const next=body.replace(before,after);
  changes.push({signature,beforeHash:hash(body),afterHash:hash(next),before,after});bodies.set(name,next);
 };
 const unknown="(p->>'source'='direct_unknown' and p->>'medium'='unknown' and p->>'campaign'='none')";
 change('product_metrics.valid_context','product_metrics.valid_context(jsonb)',unknown,"(p->>'source'='leesroutes' and p->>'medium'='referral' and p->>'campaign'='none') or "+unknown);
 change('product_metrics.record_event','product_metrics.record_event(uuid,text,jsonb)',"'taste_result_opened','sign_in_succeeded') then raise exception 'invalid event'","'taste_result_opened','sign_in_succeeded','referral_arrival') then raise exception 'invalid event'");
 const guard="if not product_metrics.valid_context(c) then raise exception 'invalid context' using errcode='22023';end if;";
 change('product_metrics.record_event','product_metrics.record_event(uuid,text,jsonb)',guard,guard+"\n if p_event='referral_arrival' and p_dimensions->>'source' is distinct from 'leesroutes' then raise exception 'invalid referral' using errcode='22023';end if;");
 change('public.record_product_event_v1','public.record_product_event_v1(uuid,text,jsonb)',"'book_detail_opened','taste_result_opened') then raise exception 'browser event required'","'book_detail_opened','taste_result_opened','referral_arrival') then raise exception 'browser event required'");
 const selected=rollback?[...changes].reverse().map(c=>({...c,beforeHash:c.afterHash,afterHash:c.beforeHash,before:c.after,after:c.before})):changes;
 return `-- Leesroutes referral ${rollback?'rollback':'allowlist patch'}; no table, policy, trigger, grant or retention changes.
-- ${isTest?'Synthetic test':'Production'} only. Review against a read-only baseline; set lumiscore.metrics.release_target first.
begin;
set local lock_timeout='1s';
set local statement_timeout='5s';
do $patch$
declare r record; oid_value oid; body text; definition text;
begin
 if current_setting('lumiscore.metrics.release_target',true) is distinct from '${isTest?'hlvujbrmfdlrfxdjwsmb':'qvplwejffhjvxaypmjut'}' then raise exception 'WRONG_METRICS_TARGET';end if;
 for r in select * from (values
${selected.map(c=>'  ('+[c.signature,c.beforeHash,c.afterHash,c.before,c.after].map(quote).join(',')+')').join(',\n')}
 ) as changes(signature,before_hash,after_hash,before_fragment,after_fragment) loop
  oid_value:=to_regprocedure(r.signature);
  if oid_value is null then raise exception 'MISSING_METRICS_FUNCTION %',r.signature;end if;
  select prosrc into body from pg_proc where oid=oid_value;
  if md5(body)<>r.before_hash then raise exception 'UNEXPECTED_METRICS_BASELINE %',r.signature;end if;
  if (length(body)-length(replace(body,r.before_fragment,'')))/length(r.before_fragment)<>1 then raise exception 'UNEXPECTED_METRICS_FRAGMENT %',r.signature;end if;
  definition:=pg_get_functiondef(oid_value);
  execute replace(definition,r.before_fragment,r.after_fragment);
  select prosrc into body from pg_proc where oid=oid_value;
  if md5(body)<>r.after_hash then raise exception 'UNEXPECTED_METRICS_RESULT %',r.signature;end if;
 end loop;
end $patch$;
commit;
`;
}
