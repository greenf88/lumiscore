import {createHash} from 'node:crypto';
import production from './reading-guides-baseline.json' with {type:'json'};
import synthetic from './reading-guides-test-baseline.json' with {type:'json'};
const hash = x => createHash('md5').update(x).digest('hex');
const quote = x => "'" + x.replaceAll("'", "''") + "'";
const ids = "'suzanne-vermeer','fantasy-om-mee-te-beginnen','na-project-hail-mary'";
export function readingGuidesPatch(rollback=false,target='production') {
 if(!['production','test'].includes(target))throw Error('Unknown metrics target');
 const baseline=target==='production'?production:synthetic;
 const changes=baseline.map(item=>{
  const definition=item.definition, body=definition.slice(definition.indexOf('$function$')+10,definition.lastIndexOf('$function$'));
  const signature=/FUNCTION ([^(]+\([^\n]+\))/.exec(definition)[1].replace(/p_event_id uuid, p_event text, p_dimensions jsonb/,'uuid,text,jsonb').replace('p jsonb','jsonb');
  let next=body;
  const replace=(before,after)=>{if(next.split(before).length!==2)throw Error('Missing/ambiguous metrics fragment '+item.proname);next=next.replace(before,after);};
  if(item.proname==='valid_context')replace("(p->>'source'='facebook' and p->>'medium'='organic_social' and p->>'campaign'='dystopie_202610')", "(p->>'medium'='organic_social' and ((p->>'source'='facebook' and p->>'campaign'='dystopie_202610') or (p->>'source' in ('facebook','instagram') and p->>'campaign'='leesroutes_202611')))" );
  else {
   replace("'editorial_list_opened',", "'editorial_list_opened','reading_guide_opened',");
   if(item.proname==='record_event'){
    replace("('book_card_opened','editorial_list_opened')", "('book_card_opened','editorial_list_opened','reading_guide_opened')");
    replace("('dystopie-vanaf-1990','other')", "('dystopie-vanaf-1990','other',"+ids+")");
    replace("if p_dimensions ? 'list_id'", "if p_event='reading_guide_opened' and (p_dimensions->>'locale' is distinct from 'nl' or p_dimensions->>'list_id' is null or p_dimensions->>'list_id' not in ("+ids+")) then raise exception 'invalid guide' using errcode='22023';end if;\n if p_dimensions ? 'list_id'");
   }
  }
  return {signature,before:rollback?next:body,after:rollback?body:next};
 });
 return `-- Fixed reading-guide dimensions within PR51; no table, trigger, scheduler, ACL or retention changes.
begin;
set local lock_timeout='1s';
set local statement_timeout='5s';
do $patch$
declare r record; target oid; body text; definition text;
begin
 if current_setting('lumiscore.metrics.release_target',true) is distinct from '${target==='test'?'hlvujbrmfdlrfxdjwsmb':'qvplwejffhjvxaypmjut'}' then raise exception 'WRONG_METRICS_TARGET';end if;
 for r in select * from (values
${changes.map(c=>' ('+[c.signature,hash(c.before),hash(c.after),c.before,c.after].map(quote).join(',')+')').join(',\n')}
 ) as changes(signature,before_hash,after_hash,before_body,after_body) loop
  target:=to_regprocedure(r.signature);select prosrc into body from pg_proc where oid=target;
  if target is null then raise exception 'MISSING_METRICS_FUNCTION %',r.signature;end if;
  if md5(body)=r.after_hash then continue;end if;
  if md5(body)<>r.before_hash then raise exception 'UNEXPECTED_METRICS_BASELINE %',r.signature;end if;
  definition:=pg_get_functiondef(target);
  execute replace(definition,r.before_body,r.after_body);
  select prosrc into body from pg_proc where oid=target;
  if md5(body)<>r.after_hash then raise exception 'UNEXPECTED_METRICS_RESULT';end if;
 end loop;
end $patch$;
commit;
`;
}
