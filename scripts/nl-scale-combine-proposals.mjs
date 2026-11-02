// One draft production proposal: bind references and deduplicate shared new authors.
// No execution. Subbatch SQL must not be blindly concatenated against one baseline.
import fs from 'node:fs';import{createHash}from'node:crypto';
import{ROOT,readJson}from'./nl-scale-snapshot.mjs';
import{renderImport,renderRollback}from'./nl-scale-release-sql.mjs';
const dir=new URL('subbatches/',ROOT),numbers=fs.readdirSync(dir).filter(n=>/^\d{3}$/.test(n)).sort(),actions=[],authorRefs=new Map(),bindings=new Map(),corpora=new Map();
const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const totals={newWorks:0,newDutchEditions:0,newDutchSummaries:0,newCoverBindings:0,netDutchAvailability:0};
let rawActions=0;
for(const n of numbers){const p=readJson(new URL(n+'/production-plan.json',dir)),refs=new Map(p.actions.map(a=>[a.ref,'b'+n+'_'+a.ref]));if(p.summary.target!=='qvplwejffhjvxaypmjut')throw Error('Unexpected target');rawActions+=p.actions.length;
 for(const a of p.actions.filter(a=>a.relation==='authors'&&a.before===null)){
  const key=a.after.open_library_id,old=authorRefs.get(key);if(!key)throw Error('Unbound new-author identity');
  if(old){if(stable(old.after)!==stable(a.after))throw Error('Conflicting shared author');refs.set(a.ref,old.ref);}else authorRefs.set(key,{after:a.after,ref:refs.get(a.ref)});
 }
 const replace=x=>Array.isArray(x)?x.map(replace):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,replace(v)])):typeof x==='string'&&x.startsWith('@')?(refs.has(x.slice(1))?'@'+refs.get(x.slice(1)):(()=>{throw Error('Unbound local reference');})()):x;
 for(const a of p.actions){const ref=refs.get(a.ref);if(actions.some(x=>x.ref===ref)){if(a.relation!=='authors')throw Error('Unreviewed duplicate action');continue;}actions.push({...a,ref,key:replace(a.key),before:replace(a.before),after:replace(a.after)});}
 for(const b of p.bindings){const old=bindings.get(b.work.id);if(old&&stable(old)!==stable(b))throw Error('Work baseline differs between subproposals');bindings.set(b.work.id,b);}
 for(const c of p.authorCorpora??[]){const old=corpora.get(c.author_id);if(old&&stable(old)!==stable(c))throw Error('Author corpus baseline differs');corpora.set(c.author_id,c);}
 for(const k of Object.keys(totals))totals[k]+=p.summary[k]??0;
}
const keys=actions.map(a=>a.relation+'|'+stable(a.key));if(new Set(keys).size!==keys.length)throw Error('Duplicate data action');
const plan={summary:{batch:'nl-scale-20261102-combined-draft',target:'qvplwejffhjvxaypmjut',scope:'DRAFT REVIEW PROPOSAL ONLY; not approved or production executed',subbatches:numbers,actions:actions.length,rawSubproposalActions:rawActions,deduplicatedSharedAuthors:rawActions-actions.length,...totals},bindings:[...bindings.values()],authorCorpora:[...corpora.values()],actions};
const out=new URL('combined-draft/',ROOT);fs.mkdirSync(out,{recursive:true});
const files={'production-plan.json':JSON.stringify(plan,null,2)+'\n','production-import.sql':renderImport(plan),'production-dry-run.sql':renderImport(plan,{dryRun:true}),'production-rollback.sql':renderRollback(plan)};
for(const[n,b]of Object.entries(files))fs.writeFileSync(new URL(n,out),b);
fs.writeFileSync(new URL('hashes.json',out),JSON.stringify(Object.fromEntries(Object.entries(files).map(([n,b])=>[n,createHash('sha256').update(b).digest('hex')])),null,2)+'\n');console.log(JSON.stringify(plan.summary));
