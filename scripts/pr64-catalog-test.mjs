// Render exact TEST mappings after seed readback; never alters production proposals.
import fs from'node:fs';import{createHash}from'node:crypto';import{renderImport}from'./catalog-release-sql.mjs';import{exactRollback}from'./pr64-test-sql.mjs';
const root=new URL('../catalog/pr64-dashboard-test-20261031/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,root))),write=(n,x)=>fs.writeFileSync(new URL(n,root),typeof x==='string'?x:JSON.stringify(x,null,2)+'\n');
const m=read('execution-manifest.json'),seed=read('seed-committed-readback.json'),baseline=read('../nl100-hosted-20261031/dashboard-test-before.json'),work=id=>Number(m.workMap[id]),author=id=>Number(m.authorMap[id]),edition=id=>Number(m.editionMap[id]);
const actual={works:[...baseline.works,...seed.works],authors:[...baseline.authors,...seed.authors],editions:[...baseline.editions,...seed.editions]};
const paths=['../nl-followup-002-20261031/production-plan.json','../nl-followup-002-20261031/next100-production-plan.json',...read('../nl100-completion-20261031/batches.json').batches.map(b=>'../nl100-completion-20261031/'+b.directory+'production-plan.json')];
let next=969200061;const index=[];
for(const path of paths){const source=read(path),plan={summary:{batch:'pr64-test-'+source.summary.batch,target:m.project,sourceBatch:source.summary.batch},bindings:source.bindings.map(b=>({work:actual.works.find(w=>w.id===work(b.work.id)),author:actual.authors.find(a=>a.id===author(b.author.id))})),actions:[]};
 if(plan.bindings.some(b=>!b.work||!b.author||b.work.author_id!==b.author.id))throw Error('Unmapped test binding');
 for(const sourceAction of source.actions){const a=structuredClone(sourceAction);if(a.after.work_id)a.after.work_id=work(a.after.work_id);if(a.key.work_id)a.key.work_id=work(a.key.work_id);if(a.after.bound_author_id)a.after.bound_author_id=author(a.after.bound_author_id);
  if(a.relation==='editions'&&a.before){const before=actual.editions.find(e=>e.id===edition(a.before.id));if(!before||['title','language','isbn_13','isbn_10','open_library_edition_id'].some(k=>before[k]!==a.before[k]))throw Error('Current test baseline edition identity differs '+a.ref);a.key={id:before.id};a.before=before;a.after={...before,title:a.after.title,language:a.after.language};}
  else if(a.relation==='editions'){a.after.id=next++;}
  else if(a.relation==='catalog_edition_metadata'&&typeof a.after.edition_id==='number'){a.after.edition_id=edition(a.after.edition_id);a.key.edition_id=edition(a.key.edition_id);}
  if(a.relation==='catalog_work_descriptions'&&baseline.descriptions.some(d=>d.work_id===a.after.work_id&&d.language===a.after.language))throw Error('Never replace an existing good test summary');
  plan.actions.push(a);
 }
 const dir=plan.summary.batch+'/';fs.mkdirSync(new URL(dir,root),{recursive:true});const files={'plan.json':JSON.stringify(plan,null,2)+'\n','import.sql':renderImport(plan,{canary:true}),'dry-run.sql':renderImport(plan,{canary:true,dryRun:true}),'rollback.sql':exactRollback(plan)};for(const[n,s]of Object.entries(files))write(dir+n,s);index.push({directory:dir,batch:plan.summary.batch,actions:plan.actions.length,source:path,hashes:Object.fromEntries(Object.entries(files).map(([n,s])=>[n,createHash('sha256').update(s).digest('hex')]))});
}
if(index.reduce((n,b)=>n+b.actions,0)!==262||next!==969200121)throw Error('Unexpected exact262scope');write('catalog-batches.json',{project:m.project,batches:index,totalActions:262,newEditionIdRange:[969200061,969200120],productionWrites:0});console.log(JSON.stringify(index.map(b=>({batch:b.batch,actions:b.actions}))));
