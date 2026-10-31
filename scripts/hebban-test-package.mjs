import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {renderImport,renderRollback} from './catalog-release-sql.mjs';
const root=new URL('../catalog/hebban-priority-20261031/',import.meta.url),source=new URL('../../../outputs/hebban-priority-20261031/',import.meta.url);
fs.mkdirSync(root,{recursive:true});
const read=(n,base=root)=>JSON.parse(fs.readFileSync(new URL(n,base),'utf8'));
const write=(n,v)=>fs.writeFileSync(new URL(n,root),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
// Retain the already-reviewed public proposal byte-for-byte, not another import.
if(fs.existsSync(source)){
 for(const n of ['reviewed-changes.json','production-public-snapshot.json','existing-approved-descriptions.json','production-plan.json','production-import.sql','production-dry-run.sql','production-rollback.sql','hashes.json','cover-http.json','card-cover-http.json','local-validation.json','live-readonly-proof.json'])fs.copyFileSync(new URL(n,source),new URL(n,root));
 fs.copyFileSync(new URL('REVIEW.txt',source),new URL('ORIGINAL-RESEARCH.txt',root));
 fs.mkdirSync(new URL('sources/',root),{recursive:true});
 for(const f of fs.readdirSync(new URL('sources/',source))){const data=read('sources/'+f,source);delete data.header;write('sources/'+f,data);}
}
const review=read('reviewed-changes.json'),production=read('production-public-snapshot.json'),prodPlan=read('production-plan.json');
const before=JSON.parse(fs.readFileSync(new URL('../catalog/nl-availability-20261031/test-before-public.json',import.meta.url),'utf8'));
const testRow=(table,row)=>Object.fromEntries(Object.keys(before[table][0]).map(key=>[key,row[key]??null]));
const norm=s=>String(s??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const workMap=new Map(),authorMap=new Map(),editionMap=new Map(),fixtures=[],bindings=[];
let nw=962100001,na=962300001,ne=962200001;
for(const p of review.priorities){const w=production.works.find(w=>w.id===p.workId),a=production.authors.find(a=>a.id===w.author_id);
 const matches=before.works.filter(t=>t.open_library_id&&t.open_library_id===w.open_library_id||t.native_identity_key&&t.native_identity_key===w.native_identity_key||before.editions.some(e=>e.work_id===t.id&&production.editions.some(pe=>pe.work_id===w.id&&pe.isbn_13===e.isbn_13&&e.isbn_13)));
 if(matches.length>1)throw Error('Ambiguous test Work '+w.id);
 if(matches.length){const t=matches[0];if(norm(before.authors.find(a=>a.id===t.author_id)?.name)!==norm(a.name))throw Error('Author conflict');workMap.set(w.id,t.id);authorMap.set(a.id,t.author_id);continue;}
 // Other same-author books are not the same Work. Explicit fixture IDs, no production users.
 let ta=before.authors.find(t=>t.open_library_id&&t.open_library_id===a.open_library_id||norm(t.name)===norm(a.name));
 if(!ta&&!authorMap.has(a.id)){if(before.authors.some(x=>x.id===na))throw Error('Author ID collision');ta=testRow('authors',{...a,id:na++});fixtures.push({relation:'authors',ref:'test-author:'+a.id,key:{id:ta.id},before:null,after:ta});authorMap.set(a.id,ta.id);}else if(ta)authorMap.set(a.id,ta.id);
 if(before.works.some(x=>x.id===nw))throw Error('Work ID collision');const tw=testRow('works',{...w,id:nw++,author_id:authorMap.get(a.id)});workMap.set(w.id,tw.id);fixtures.push({relation:'works',ref:'test-work:'+w.id,key:{id:tw.id},before:null,after:tw});
 for(const e of production.editions.filter(e=>e.work_id===w.id)){if(before.editions.some(x=>x.id===ne||x.isbn_13&&x.isbn_13===e.isbn_13||x.open_library_edition_id&&x.open_library_edition_id===e.open_library_edition_id))throw Error('Edition collision');const te=testRow('editions',{...e,id:ne++,work_id:tw.id});editionMap.set(e.id,te.id);fixtures.push({relation:'editions',ref:'fixture-edition:'+e.id,key:{id:te.id},before:null,after:te});}
}
for(const b of prodPlan.bindings){const tw=before.works.find(w=>w.id===workMap.get(b.work.id));if(tw)bindings.push({work:tw,author:before.authors.find(a=>a.id===tw.author_id)});}
const mapValue=(k,v)=>k==='work_id'?workMap.get(v)??v:k==='bound_author_id'||k==='author_id'?authorMap.get(v)??v:k==='edition_id'||k==='id'&&editionMap.has(v)?editionMap.get(v)??v:v;
const changes=prodPlan.actions.map(a=>{const transform=r=>r&&Object.fromEntries(Object.entries(r).map(([k,v])=>[k,mapValue(k,v)]));return {...a,key:transform(a.key),before:transform(a.before),after:transform(a.after)};});
const plan={summary:{target:'hlvujbrmfdlrfxdjwsmb',batch:'hebban-priority-test-20261031',actions:changes.length,fixtureActions:fixtures.length,reviewedProductionActions:changes.length},bindings,actions:changes};
const fixturePlan={summary:{target:'hlvujbrmfdlrfxdjwsmb',batch:'hebban-priority-fixtures-20261031',actions:fixtures.length},bindings:[],actions:fixtures};
// Separate receipts: restore the seventeen corrections first, then own fixtures.
// Replaying fixture pre-correction rows AFTER correction is deliberately refused.
write('test-fixture-plan.json',fixturePlan);write('test-fixture-import.sql',renderImport(fixturePlan));write('test-fixture-rollback.sql',renderRollback(fixturePlan));
write('test-plan.json',plan);write('test-import.sql',renderImport(plan));write('test-dry-run.sql',renderImport(plan,{dryRun:true}));write('test-rollback.sql',renderRollback(plan));
write('test-mapping.json',{workMap:Object.fromEntries(workMap),authorMap:Object.fromEntries(authorMap),editionMap:Object.fromEntries(editionMap),fixtureActions:fixtures.length,productionChanges:changes.length,productionNewWorks:0});
write('test-hashes.json',Object.fromEntries(['test-plan.json','test-import.sql','test-dry-run.sql','test-rollback.sql'].map(f=>[f,createHash('sha256').update(fs.readFileSync(new URL(f,root))).digest('hex')])));
console.log(JSON.stringify({summary:plan.summary,mapping:Object.fromEntries(workMap)}));
