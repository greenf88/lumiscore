import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const q=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
function assertAliasPlan(plan){
 const ids={qvplwejffhjvxaypmjut:[1435,1499],hlvujbrmfdlrfxdjwsmb:[962100006,962200008]}[plan.project];
 if(!ids||plan.work.id!==ids[0]||plan.edition.id!==ids[1]||plan.edition.work_id!==ids[0]||plan.title!=='The Seven Sisters'||plan.edition.isbn_13!=='9789401609371'||plan.edition.language!=='nld')throw Error('Unreviewed alias scope');
}
export function renderAliasImport(plan,{dryRun=false}={}){
 const {project,work,edition}=plan;
 assertAliasPlan(plan);
 return `-- Target ${project}. Source-bound title alias ONLY. Execute core17 corrections first.
begin;set local lock_timeout='3s';set local statement_timeout='10s';
select id from public.works where id=${work.id} for update;
select id from public.editions where id=${edition.id} for update;
do $guard$ begin
 if (select to_jsonb(w) from public.works w where id=${work.id}) is distinct from ${q(work)} then raise exception 'Alias Work identity drift';end if;
 if (select to_jsonb(e) from public.editions e where id=${edition.id}) is distinct from ${q(edition)} then raise exception 'Alias edition drift or core import missing';end if;
end;$guard$;
with inserted as (insert into public.catalog_work_title_aliases(work_id,title)
 values(${work.id},'The Seven Sisters') on conflict do nothing returning *)
select jsonb_build_object('target','${project}','batch','pr63-seven-sisters-alias',
 'changes',coalesce((select jsonb_agg(to_jsonb(i)) from inserted i),'[]'::jsonb)) as receipt;
${dryRun?'rollback':'commit'};
`;
}
export function renderAliasRollback(plan){
 assertAliasPlan(plan);
 return `-- Target ${plan.project}; use ONLY this alias import's FIRST nonempty COMMIT receipt.
-- Set app.pr63_alias_receipt to that exact saved JSON before executing; absent/empty receipt refuses deletion.
begin;set local lock_timeout='3s';set local statement_timeout='10s';
select id from public.works where id=${plan.work.id} for update;
select id from public.editions where id=${plan.edition.id} for update;
do $guard$ declare r jsonb:=current_setting('app.pr63_alias_receipt',true)::jsonb;begin
 if r is null or r->>'target' is distinct from '${plan.project}' or r->>'batch' is distinct from 'pr63-seven-sisters-alias'
 or r->'changes' is distinct from '[{"work_id":${plan.work.id},"title":"The Seven Sisters"}]'::jsonb then raise exception 'Exact own alias receipt required';end if;
 if (select to_jsonb(w) from public.works w where id=${plan.work.id}) is distinct from ${q(plan.work)} then raise exception 'Later Work change; preserve';end if;
 if (select to_jsonb(e) from public.editions e where id=${plan.edition.id}) is distinct from ${q(plan.edition)} then raise exception 'Later edition change; preserve';end if;
 if not exists(select 1 from public.catalog_work_title_aliases where work_id=${plan.work.id} and title='The Seven Sisters') then raise exception 'Alias absent or changed; stop';end if;
end;$guard$;
delete from public.catalog_work_title_aliases where work_id=${plan.work.id} and title='The Seven Sisters' returning *;
commit;
`;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=new URL('../catalog/hebban-priority-20261031/',import.meta.url);
 const prod=JSON.parse(fs.readFileSync(new URL('production-public-snapshot.json',root)));
 const test=JSON.parse(fs.readFileSync(new URL('test-fixture-plan.json',root)));
 const production={project:'qvplwejffhjvxaypmjut',work:prod.works.find(w=>w.id===1435),edition:{...prod.editions.find(e=>e.id===1499),language:'nld'},title:'The Seven Sisters'};
 const fixture={project:'hlvujbrmfdlrfxdjwsmb',work:test.actions.find(a=>a.relation==='works'&&a.after.id===962100006).after,edition:{...test.actions.find(a=>a.relation==='editions'&&a.after.id===962200008).after,language:'nld'},title:'The Seven Sisters'};
 const hashes={};
 for(const [name,plan] of [['production',production],['test',fixture]])for(const [suffix,data] of [['plan.json',JSON.stringify(plan,null,2)+'\n'],['import.sql',renderAliasImport(plan)],['dry-run.sql',renderAliasImport(plan,{dryRun:true})],['rollback.sql',renderAliasRollback(plan)]]){
  const file=`seven-sisters-alias-${name}-${suffix}`;fs.writeFileSync(new URL(file,root),data);hashes[file]=createHash('sha256').update(data).digest('hex');
 }
 fs.writeFileSync(new URL('seven-sisters-alias-hashes.json',root),JSON.stringify(hashes,null,2)+'\n');
 console.log(JSON.stringify(hashes));
}
