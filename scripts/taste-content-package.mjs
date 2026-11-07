import fs from'node:fs';import{createHash}from'node:crypto';import{tasteContentPredicateSql}from'../lib/taste-test/content-policy.ts';
const dir=new URL('../catalog/even-simpel-20261107/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,dir))),write=(n,s)=>fs.writeFileSync(new URL(n,dir),s);
const hash=s=>createHash('sha256').update(s).digest('hex');
// An explicitly authenticated, read-only private approval reader. Inventory stays
// private: no SELECT/schema grants, service key or user-data read is introduced.
// All caller ownership remains in the existing state/round/search functions.
const helper=`create or replace function taste_private.content_eligible_v1(p_work_id bigint,p_language text) returns boolean language plpgsql stable security definer set search_path='' as $policy$\ndeclare eligible boolean;begin\nif auth.uid() is null then return false;end if;\n${tasteContentPredicateSql()} into eligible;\nif not eligible then return false;end if;\n-- Preserve a pre-existing stricter reviewed inventory; never fall back on errors.\nif to_regprocedure('taste_private.inventory_current_v1(bigint,text)') is not null then\n execute 'select taste_private.inventory_current_v1($1,$2)' into eligible using p_work_id,p_language;\nend if;return coalesce(eligible,false);end;\n$policy$;\nrevoke all on function taste_private.content_eligible_v1(bigint,text) from public,anon,service_role;\ngrant execute on function taste_private.content_eligible_v1(bigint,text) to authenticated;\n`;
const publicHelpers=`create or replace function public.taste_rating_allowed(p_work_id bigint,p_language text) returns boolean language sql stable security invoker set search_path='' as $allowed$ select taste_private.content_eligible_v1(p_work_id,p_language); $allowed$;
revoke all on function public.taste_rating_allowed(bigint,text) from public,anon,service_role;grant execute on function public.taste_rating_allowed(bigint,text) to authenticated;
create or replace function public.taste_rating_candidates(p_query text,p_language text) returns table(work_id bigint) language sql stable security invoker set search_path='' as $candidates$
 with current_round as(select r.* from public.taste_rating_rounds r where r.user_id=(select auth.uid()) order by r.round_number desc limit 1)
 select w.id from current_round r cross join public.works w join public.authors a on a.id=w.author_id
 where r.completed_at is null and p_language in('nl','en') and length(trim(p_query)) between 2 and 100
   and taste_private.content_eligible_v1(w.id,r.language) and taste_private.content_eligible_v1(w.id,p_language)
   and exists(select 1 from public.editions e where e.work_id=w.id and (e.title ilike '%'||replace(replace(replace(p_query,'\\','\\\\'),'%','\\%'),'_','\\_')||'%' or a.name ilike '%'||replace(replace(replace(p_query,'\\','\\\\'),'%','\\%'),'_','\\_')||'%'))
   and not exists(select 1 from public.ratings x where x.user_id=r.user_id and x.work_id=w.id)
   and not exists(select 1 from public.taste_rating_offers x where x.user_id=r.user_id and x.work_id=w.id
     and (x.round_id=r.id or x.decision<>'skipped' or not coalesce((to_jsonb(r)->>'revisit_prior_skips')::boolean,false)))
 order by w.id limit 20; $candidates$;
revoke all on function public.taste_rating_candidates(text,text) from public,anon,service_role;grant execute on function public.taste_rating_candidates(text,text) to authenticated;\n`;
function once(s,from,to){if(s.split(from).length!==2)throw Error('Unexpected function anchor '+from);return s.replace(from,to);}
function patchAdvance(s){
 s=once(s,"  if p_action in ('rate','skip') then",`  -- Retire only an ineligible pending offer; keep history, all ratings and counters.
  -- GET is read-only; explicit resume/extend/start/choose performs this transition.
  if p_action in ('start','resume','extend','choose') and r.completed_at is null then
    update public.taste_rating_offers set decision='skipped',decided_at=now()
      where round_id=r.id and user_id=uid and decision='offered'
        and not taste_private.content_eligible_v1(work_id,r.language);
  end if;
  if p_action in ('rate','skip') then`);
 s=once(s,"    if p_action='rate' then",`    if p_action='rate' then
      if not taste_private.content_eligible_v1(p_work_id,r.language) then raise exception 'Book no longer taste eligible; resume' using errcode='22023';end if;`);
 s=once(s,"  elsif p_action='choose' then",`  elsif p_action='choose' then
    if not taste_private.content_eligible_v1(p_work_id,r.language) then raise exception 'Choose an eligible book' using errcode='22023';end if;`);
 // Insert before the unchanged ordering. Do not change rank terms or tie breaks.
 s=once(s,'    order by\n',"      and taste_private.content_eligible_v1(w.id,r.language)\n    order by\n");
 return s;
}
function patchState(s){let count=0;s=s.replace(/o\.decision='offered'/g,x=>{count++;return x+' and taste_private.content_eligible_v1(o.work_id,r.language)';});if(count!==2)throw Error('Unexpected state anchors '+count);return s;}
const patches={};
for(const env of['production','test']){
 const before=read('taste-'+env+'-before.json'),advance=before.functions.find(f=>f.name===(env==='production'?'advance_round_v2':'advance_round_v3')),
 state=before.functions.find(f=>f.name==='taste_rating_state'),changes=[{...advance,after:patchAdvance(advance.definition)},{...state,after:patchState(state.definition)}];
 patches[env]=changes;
 const guard=changes.map(f=>`if encode(sha256(convert_to(pg_get_functiondef('${f.schema}.${f.name}(${f.identity_args.replace(/\b\w+\s+(?=(?:text|uuid|bigint|integer))/g,'')})'::regprocedure),'UTF8')),'hex') not in ('${hash(f.definition)}','${hash(f.after)}') then raise exception 'Function drift: ${f.name}';end if;`).join('\n');
 const sql=`-- Exact ${env} target ${env==='production'?'qvplwejffhjvxaypmjut':'hlvujbrmfdlrfxdjwsmb'}. No catalogue, auth or rating data writes.\nbegin;set local lock_timeout='3s';set local statement_timeout='30s';\ndo $guard$ begin\n${guard}\nend;$guard$;\n${helper}\n${changes.map(f=>f.after+';').join('\n')}\n${publicHelpers}\ncommit;\n`;
 write('taste-'+env+'-install.sql',sql);write('taste-'+env+'-restore.sql',`-- Restore only after code rollback; guards for the exact installed body required.\nbegin;\ndo $guard$ begin\n${changes.map(f=>`if pg_get_functiondef('${f.schema}.${f.name}(${f.identity_args.replace(/\b\w+\s+(?=(?:text|uuid|bigint|integer))/g,'')})'::regprocedure) is distinct from ${"'"+f.after.replaceAll("'","''")+"'"} then raise exception 'Later function change; recovery refused';end if;`).join('\n')}\nend;$guard$;\n${changes.map(f=>f.definition+';').join('\n')}\ndrop function public.taste_rating_candidates(text,text);drop function public.taste_rating_allowed(bigint,text);drop function taste_private.content_eligible_v1(bigint,text);\ncommit;\n`);
 write('taste-'+env+'-changed-functions.json',JSON.stringify(changes.map(f=>({name:f.name,beforeSha256:hash(f.definition),afterSha256:hash(f.after),acl:f.acl})),null,2)+'\n');
}
const sig=f=>`${f.schema}.${f.name}(${f.identity_args.replace(/\b\w+\s+(?=(?:text|uuid|bigint|integer))/g,'')})`;
const change=f=>`if encode(sha256(convert_to(pg_get_functiondef('${sig(f)}'::regprocedure),'UTF8')),'hex') not in ('${hash(f.definition)}','${hash(f.after)}') then raise exception 'Function drift: ${f.name}';end if;\nexecute $definition$${f.after};$definition$;`;
const wrapper=read('taste-test-before.json').functions.find(f=>f.name==='advance_round_v2');
const prototypes=[...read('taste-test-helper-prototype.json'),...read('taste-helper-reviewed-previous.json')];
const newBodies=[['taste_private.content_eligible_v1(bigint,text)','content_eligible_v1',helper.match(/as \$policy\$([\s\S]*?)\$policy\$/)[1]],['public.taste_rating_allowed(bigint,text)','taste_rating_allowed',publicHelpers.match(/as \$allowed\$([\s\S]*?)\$allowed\$/)[1]],['public.taste_rating_candidates(text,text)','taste_rating_candidates',publicHelpers.match(/as \$candidates\$([\s\S]*?)\$candidates\$/)[1]]];
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const helperGuard=`do $helpers$ declare body text;begin\n${newBodies.map(([signature,name,body])=>`select prosrc into body from pg_proc where oid=to_regprocedure('${signature}');if body is not null and body is distinct from ${quote(body)} ${prototypes.filter(p=>p.proname===name).map(p=>'and body is distinct from '+quote(p.prosrc)).join(' ')} then raise exception 'Unreviewed helper drift: ${name}';end if;`).join('\n')}\nend;$helpers$;`;
const restoreHelperGuard=`do $helper_restore$ declare current_body text;current_definer boolean;current_acl text;begin\n${newBodies.map(([signature,name,body])=>`select prosrc,prosecdef,proacl::text into current_body,current_definer,current_acl from pg_proc where oid=to_regprocedure('${signature}');if current_body is distinct from ${quote(body)} or current_definer is distinct from ${name==='content_eligible_v1'} or current_acl is distinct from '{postgres=X/postgres,authenticated=X/postgres}' then raise exception 'Later helper body or permissions change; recovery refused';end if;`).join('\n')}\nend;$helper_restore$;`;
for(const env of['production','test']){const path=new URL('taste-'+env+'-restore.sql',dir),body=fs.readFileSync(path,'utf8');fs.writeFileSync(path,body.replace('begin;\n','begin;\n'+restoreHelperGuard+'\n'));}
const universal=`-- Same guarded migration for existing legacy production and stricter isolated test.\n-- No table, rating, account, history, catalogue or configuration mutations.\nbegin;set local lock_timeout='3s';set local statement_timeout='30s';
${helperGuard}
${helper}
do $upgrade$ begin
if to_regprocedure('taste_private.advance_round_v3(text,uuid,bigint,integer,text,integer)') is null then
 ${change(patches.production[0])}
else
 if encode(sha256(convert_to(pg_get_functiondef('taste_private.advance_round_v2(text,uuid,bigint,integer,text,integer)'::regprocedure),'UTF8')),'hex')<>'${hash(wrapper.definition)}' then raise exception 'Unexpected inventory wrapper; stop';end if;
 ${change(patches.test[0])}
end if;
${change(patches.production[1])}
end;$upgrade$;
${publicHelpers}
commit;\n`;
write('taste-install.sql',universal);
const migrationNames=fs.readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(n=>n.endsWith('_taste_content_guard.sql'));if(migrationNames.length!==1)throw Error('One CLI-generated final migration required');fs.writeFileSync(new URL('../supabase/migrations/'+migrationNames[0],import.meta.url),universal);
write('taste-policy-predicate.sql',tasteContentPredicateSql()+';\n');console.log('Prepared exact legacy production and inventory-backed test variants; no DB execution.');
