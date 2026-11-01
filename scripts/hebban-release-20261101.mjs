// Offline preparation of the existing Hebban package; no database client or credentials.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {exactRollback} from './pr64-test-sql.mjs';
const base='catalog/hebban-priority-20261031/',dir=base+'release-20261101/';
const read=n=>JSON.parse(fs.readFileSync(n,'utf8'));
const q=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const allowed={
 qvplwejffhjvxaypmjut:[[1435,1499,'The Seven Sisters'],[1440,1504,"Sarah's Key"],[10231,10420,'Das achte Leben (Für Brilka)'],[10232,10421,'Tout le bleu du ciel']],
 hlvujbrmfdlrfxdjwsmb:[[962100006,962200008,'The Seven Sisters'],[962100005,962200007,"Sarah's Key"],[930100049,930200049,'Das achte Leben (Für Brilka)'],[930100051,930200051,'Tout le bleu du ciel']]
};
export function assertAliases(p){
 assert.equal(p.batch,'pr63-reviewed-original-title-aliases-20261101');
 assert.ok(allowed[p.project]);assert.equal(p.aliases.length,4);
 for(const [i,a]of p.aliases.entries()){
  const [id,edition,title]=allowed[p.project][i];
  assert.equal(a.work.id,id);assert.equal(a.edition.id,edition);
  assert.equal(a.edition.work_id,id);assert.equal(a.title,title);
  assert.ok(['nld','dut','nl'].includes(a.edition.language));
 }
}
const rows=p=>p.aliases.map(a=>({work_id:a.work.id,title:a.title})).sort((a,b)=>a.work_id-b.work_id||a.title.localeCompare(b.title));
const parentGuards=p=>p.aliases.map(a=>`
 select id from public.works where id=${a.work.id} for update;
 select id from public.editions where id=${a.edition.id} for update;
 do $parent$ begin
 if(select to_jsonb(w)from public.works w where id=${a.work.id})is distinct from ${q(a.work)} then raise exception 'Alias Work identity changed';end if;
 if(select to_jsonb(e)from public.editions e where id=${a.edition.id})is distinct from ${q(a.edition)} then raise exception 'Alias exact edition changed or core17 missing';end if;
 end;$parent$;
`).join('');
export function aliasImport(p,{dryRun=false}={}){
 assertAliases(p);
 return `-- Exact target ${p.project}; four source-reviewed aliases, no Work merge or language eligibility change.
begin;set local lock_timeout='3s';set local statement_timeout='15s';
lock table public.catalog_work_title_aliases in share row exclusive mode;
${parentGuards(p)}
create temporary table pr63_alias_receipt(work_id bigint,title text)on commit drop;
do $aliases$ declare expected jsonb:=${q(rows(p))};actual jsonb;n integer;begin
 select count(*)into n from public.catalog_work_title_aliases a where exists(select 1 from jsonb_array_elements(expected)x where a.work_id=(x->>'work_id')::bigint and a.title=x->>'title');
 if n not in(0,4)then raise exception 'Partial alias state; review instead of filling silently';end if;
 if n=0 then
 insert into public.catalog_work_title_aliases(work_id,title)select (x->>'work_id')::bigint,x->>'title'from jsonb_array_elements(expected)x;
 insert into pr63_alias_receipt select (x->>'work_id')::bigint,x->>'title'from jsonb_array_elements(expected)x;
 end if;
end;$aliases$;
select jsonb_build_object('project','${p.project}','batch','${p.batch}','changes',coalesce(jsonb_agg(to_jsonb(r)order by work_id,title),'[]'))receipt from pr63_alias_receipt r;
${dryRun?'rollback':'commit'};
`;
}
export function aliasRollback(p){
 assertAliases(p);
 return `-- Only this exact alias batch's FIRST nonempty committed receipt; never a replay/dry-run.
begin;set local lock_timeout='3s';set local statement_timeout='15s';
lock table public.catalog_work_title_aliases in share row exclusive mode;
${parentGuards(p)}
do $guard$ declare r jsonb:=nullif(current_setting('app.pr63_current_alias_receipt',true),'')::jsonb;actual jsonb;begin
 if r->>'project' is distinct from '${p.project}' or r->>'batch' is distinct from '${p.batch}' or r->'changes' is distinct from ${q(rows(p))} then raise exception 'Exact first committed four-alias receipt required';end if;
 select jsonb_agg(to_jsonb(a)order by work_id,title)into actual from public.catalog_work_title_aliases a where exists(select 1 from jsonb_array_elements(r->'changes')x where a.work_id=(x->>'work_id')::bigint and a.title=x->>'title');
 if actual is distinct from r->'changes'then raise exception 'Alias absent or changed; preserve';end if;
end;$guard$;
delete from public.catalog_work_title_aliases a where exists(select 1 from jsonb_array_elements(current_setting('app.pr63_current_alias_receipt')::jsonb->'changes')x where a.work_id=(x->>'work_id')::bigint and a.title=x->>'title');
commit;
`;
}
const body=s=>s.replace(/^([\s\S]*?)begin;/,'').replace(/commit;\s*$/,'');
export function composeRecovery(corePlan,coreReceipt,aliasPlan,aliasReceipt,{historical=false}={}){
 assert.equal(corePlan.summary.target,'hlvujbrmfdlrfxdjwsmb');
 assert.equal(corePlan.actions.length,17);assert.equal(coreReceipt.project,corePlan.summary.target);
 assert.equal(coreReceipt.batch,corePlan.summary.batch);assert.equal(coreReceipt.rows.length,17);
 const aliasSql=historical?fs.readFileSync(base+'seven-sisters-alias-test-rollback.sql','utf8'):aliasRollback(aliasPlan);
 const setting=historical?'app.pr63_alias_receipt':'app.pr63_current_alias_receipt';
 return `-- TEST ONLY hlvujbrmfdlrfxdjwsmb. One transaction, only own Hebban alias(es)+17 correction receipt rows.
begin;set local lock_timeout='3s';set local statement_timeout='30s';
select set_config('${setting}',${q(aliasReceipt)}::text,true);
select set_config('lumiscore.catalog_release_receipt',${q(coreReceipt)}::text,true);
${body(aliasSql)}
${body(exactRollback(corePlan))}
commit;
select 'pr63_scoped_committed_recovery_complete' result,statement_timestamp()completed_at;
`;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const write=(n,s)=>fs.writeFileSync(dir+n,s);
 for(const target of ['production','test']){
  const p=read(dir+'aliases-'+target+'-plan.json');
  for(const [suffix,s]of [['import.sql',aliasImport(p)],['dry-run.sql',aliasImport(p,{dryRun:true})],['rollback.sql',aliasRollback(p)]])write('aliases-'+target+'-'+suffix,s);
 }
 write('historical-test-committed-undo.sql',composeRecovery(read(base+'test-plan.json'),read(base+'test-first-committed-receipt.json'),null,read(base+'seven-sisters-alias-test-receipt.json').firstCommittedReceipt,{historical:true}));
 console.log(JSON.stringify({target:'hlvujbrmfdlrfxdjwsmb',historicalUndoRows:18,newProposalActions:21,hashes:Object.fromEntries(fs.readdirSync(dir).filter(n=>n.endsWith('.sql')).map(n=>[n,createHash('sha256').update(fs.readFileSync(dir+n)).digest('hex')]))}));
}
