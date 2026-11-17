import {createHash} from 'node:crypto';
import baseline from './discovery-baseline.json' with {type:'json'};
const events="'search_started','search_results','search_empty','search_failed','search_book_opened','guest_round_started','guest_round_completed','guest_book_saved','guest_save_failed','guest_suggestions_empty','guest_suggestions_failed'";
const hash=x=>createHash('md5').update(x).digest('hex');
const quote=x=>"'"+x.replaceAll("'","''")+"'";
export function discoveryPatch(rollback=false,target='production'){
 if(!['production','test'].includes(target))throw Error('Unknown target');
 const test=target==='test',normalize=x=>test?x.replaceAll('product_metrics.','product_metrics_test.').replaceAll('record_product_event_v1','record_product_event_test_v1'):x;
 const changes=baseline.flatMap(item=>{
  const old=normalize(item.definition);
  const body=old.slice(old.indexOf('$function$')+10,old.lastIndexOf('$function$'));
  const fragments=[["'referral_arrival') then raise exception",`'referral_arrival',${events}) then raise exception`]];
  if(item.signature.startsWith('product_metrics.')){
   fragments.push(["allowed:=array['locale','surface','source','medium','campaign','traffic'];", "allowed:=array['locale','surface','source','medium','campaign','traffic','device'];\n if p_dimensions ? 'device' and (jsonb_typeof(p_dimensions->'device') is distinct from 'string' or p_dimensions->>'device' not in ('mobile','desktop')) then raise exception 'invalid device' using errcode='22023';end if;"]);
   fragments.push(["if is_rec or p_event in ('want_to_read_saved','book_card_opened','book_detail_opened','rating_saved')", "if is_rec or p_event in ('want_to_read_saved','book_card_opened','book_detail_opened','rating_saved','search_book_opened','guest_book_saved','guest_save_failed')"]);
  }
  if(!test&&hash(body)!==item.hash)throw Error('Baseline hash mismatch');
  let current=body;
  const steps=fragments.map(([before,after])=>{
   if(current.split(before).length!==2)throw Error('Missing or ambiguous patch fragment');
   const next=current.replace(before,after);
   const step={signature:normalize(item.signature),beforeHash:hash(current),afterHash:hash(next),before,after};current=next;return step;
  });
  return rollback?steps.reverse().map(x=>({...x,before:x.after,after:x.before,beforeHash:x.afterHash,afterHash:x.beforeHash})):steps;
 });
 return `-- Discovery UX ${rollback?'rollback':'metrics'}: bounded events/device class only. No schema, ACL, trigger or retention changes.
begin;
set local lock_timeout='1s';
set local statement_timeout='5s';
do $patch$
declare r record; target oid; definition text; body text;
begin
 if current_setting('lumiscore.metrics.release_target',true) is distinct from '${test?'hlvujbrmfdlrfxdjwsmb':'qvplwejffhjvxaypmjut'}' then raise exception 'WRONG_METRICS_TARGET';end if;
 for r in select * from (values
${changes.map(c=>` (${[c.signature,c.beforeHash,c.afterHash,c.before,c.after].map(quote).join(',')})`).join(',\n')}
 ) as changes(signature,before_hash,after_hash,before_body,after_body) loop
  target:=to_regprocedure(r.signature);
  select prosrc into body from pg_proc where oid=target;
  if target is null or md5(body)<>r.before_hash then raise exception 'UNEXPECTED_METRICS_BASELINE %',r.signature;end if;
  if (length(body)-length(replace(body,r.before_body,'')))/length(r.before_body)<>1 then raise exception 'AMBIGUOUS_METRICS_FRAGMENT';end if;
  definition:=pg_get_functiondef(target);
  execute replace(definition,r.before_body,r.after_body);
  select prosrc into body from pg_proc where oid=target;
  if md5(body)<>r.after_hash then raise exception 'UNEXPECTED_METRICS_RESULT';end if;
 end loop;
end $patch$;
commit;
`;
}
