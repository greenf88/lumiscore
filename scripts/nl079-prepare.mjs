// Offline preparation only; prints a read-only preflight query. No DB client.
import fs from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const root=new URL('../catalog/nl-release-079-20261101/',import.meta.url);fs.mkdirSync(root,{recursive:true});
const read=(p)=>JSON.parse(fs.readFileSync(new URL('../catalog/'+p,import.meta.url)));
const sources=[{directory:'nl-followup-002-20261031/',file:'production-plan.json'},{directory:'nl-followup-002-20261031/',file:'next100-production-plan.json'},...read('nl-followup-008-20261031/completed-batches.json').batches.map(b=>({directory:'nl-followup-008-20261031/'+b.directory,file:'production-plan.json',hashes:b.hashes}))];
for(const s of sources){s.plan=read(s.directory+s.file);s.planHash=createHash('sha256').update(fs.readFileSync(new URL('../catalog/'+s.directory+s.file,import.meta.url))).digest('hex');if(s.hashes)assert.equal(s.planHash,s.hashes[s.file]);}
const plans=sources.map(s=>s.plan),actions=plans.flatMap(p=>p.actions),bindings=plans.flatMap(p=>p.bindings),ids=[...new Set(bindings.map(b=>b.work.id))];
assert.equal(ids.length,79);assert.equal(actions.length,235);assert.equal(bindings.length,79);assert.equal(new Set(actions.filter(a=>a.relation==='editions').map(a=>a.after.isbn_13)).size,79);
const published=new Set(read('nl100-completion-20261031/batches.json').batches.flatMap(b=>b.workIds)),reference=read('nl100-hosted-20261031/reference-scopes.json');
assert(ids.every(id=>!published.has(id)));for(const p of reference.references)assert(ids.every(id=>!p.workIds.includes(id)));
const list=ids.join(','),isbns=actions.filter(a=>a.relation==='editions').map(a=>({workId:a.after.work_id,isbn13:a.after.isbn_13,isbn10:a.after.isbn_10??null})),quoted=JSON.stringify(isbns).replaceAll("'","''");
const sourceReferences=sources.map(source=>{const {plan,...reference}=source;void plan;return reference;});
const summary={project:'qvplwejffhjvxaypmjut',releaseBase:'0bd394bf8f1812f790d9d6ad5a1a760cc96e8c2f',historicalNlBaseline:2649,existingGroups:{older:8,completedCohort:71,overlap:0},uniqueWorks:79,actions:235,newWorks:0,newAuthors:0,newEditions:actions.filter(a=>a.relation==='editions'&&a.before===null).length,languageCorrections:actions.filter(a=>a.relation==='editions'&&a.before!==null).length,newNlSummaries:actions.filter(a=>a.relation==='catalog_work_descriptions').length,newMetadata:actions.filter(a=>a.relation==='catalog_edition_metadata').length,expectedExtraNlWorks:79,excludedConflicts:7,excludedInsufficientEvidence:22,sources:sourceReferences};
fs.writeFileSync(new URL('source-manifest.json',root),JSON.stringify(summary,null,2)+'\n');
const sql=`select jsonb_build_object('project','qvplwejffhjvxaypmjut','at',statement_timestamp(),
'works',(select jsonb_agg(to_jsonb(w) order by id) from public.works w where id in(${list})),
'authors',(select jsonb_agg(to_jsonb(a) order by id) from public.authors a where id in(select author_id from public.works where id in(${list}))),
'editions',(select jsonb_agg(to_jsonb(e) order by id) from public.editions e where work_id in(${list})),
'metadata',(select coalesce(jsonb_agg(to_jsonb(m) order by edition_id),'[]') from public.catalog_edition_metadata m where work_id in(${list})),
'descriptions',(select coalesce(jsonb_agg(to_jsonb(d) order by work_id,language),'[]') from public.catalog_work_descriptions d where work_id in(${list})),
'isbnMatches',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]') from public.editions e where exists(select1 from jsonb_array_elements('${quoted}'::jsonb) c where regexp_replace(coalesce(e.isbn_13,''),'[-[:space:]]','','g')=c->>'isbn13' or upper(regexp_replace(coalesce(e.isbn_10,''),'[-[:space:]]','','g'))=c->>'isbn10'))
) as snapshot;`.replace('select1','select 1');
fs.writeFileSync(new URL('production-preflight.sql',root),sql);console.log(sql);
