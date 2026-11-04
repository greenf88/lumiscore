// Offline, review-only generation. No credentials, network client or DB execution.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {renderImport,renderRollback} from './catalog-release-sql.mjs';
const root=new URL('../catalog/description-recovery-20261104/',import.meta.url);
const read=n=>JSON.parse(fs.readFileSync(new URL(n,root),'utf8'));
const data=read('four-summaries.json'),prod=read('production-before.json'),test=read('test-before.json');
const schema=read('test-parent-schema.json');
const testRow=(table,row)=>Object.fromEntries(schema.filter(c=>c.table_name===table).map(c=>[c.column_name,row[c.column_name]??null]));
const cleanWork=w=>Object.fromEntries(Object.entries(w).filter(([k])=>k!=='author'));
const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const map={6272:[988110001,988210001,930300040],1995:[988110002,988210002,924300125],1824:[987110006,987210011,987310001],8783:[988110003,988210003,988310001]};
const plans={};
for(const target of ['production','test']){
 const isTest=target==='test';
 const plan={summary:{batch:data.batch+(isTest?'-test':''),target:isTest?'hlvujbrmfdlrfxdjwsmb':'qvplwejffhjvxaypmjut',state:'review_only',productionActions:isTest?0:4,newSummaries:{nl:1,en:3},netDutchAvailability:0},bindings:[],authorCorpora:[],actions:[],editionBindings:[],retainedDescriptions:isTest?test.descriptions:prod.descriptions};
 if(isTest){const author=prod.works.find(w=>w.id===8783).author;
  plan.actions.push({relation:'authors',ref:'test-author',key:{id:988310001},before:null,after:testRow('authors',{...author,id:988310001})});}
 for(const item of data.items){
  const pw=prod.works.find(w=>w.id===item.workId),pe=prod.editions.find(e=>e.id===item.editionId);
  if(!pw||!pe||pe.work_id!==pw.id||pe.isbn_13!==item.expectedEdition.isbn_13)throw Error('Snapshot identity mismatch');
  const [wid,eid,aid]=isTest?map[item.workId]:[pw.id,pe.id,pw.author_id];
  const existing=isTest?test.works.find(w=>w.id===wid):undefined;
  const work=existing??(isTest?testRow('works',{...cleanWork(pw),id:wid,author_id:aid}):cleanWork(pw));
  const author=isTest?test.authors.find(a=>a.id===aid):pw.author;
  if(!isTest||existing){if(!author)throw Error('Missing parent');plan.bindings.push({work,author});}
  if(isTest&&!existing){
   if(test.works.some(w=>w.id===wid||w.open_library_id===pw.open_library_id))throw Error('Test Work collision');
   plan.actions.push({relation:'works',ref:'test-work-'+wid,key:{id:wid},before:null,after:work});
   plan.actions.push({relation:'editions',ref:'test-edition-'+eid,key:{id:eid},before:null,after:testRow('editions',{...pe,id:eid,work_id:wid})});
  }else{const edition=isTest?test.editions.find(e=>e.id===eid):pe;if(!edition)throw Error('Missing edition');plan.editionBindings.push(edition);}
  if((isTest?test:prod).descriptions.some(d=>d.work_id===wid&&d.language===item.language))throw Error('Already-present summary requires explicit review');
  plan.actions.push({relation:'catalog_work_descriptions',ref:'description-'+wid+'-'+item.language,key:{work_id:wid,language:item.language},before:null,after:{...item.after,work_id:wid,bound_author_id:aid}});
 }
 // Full current parents are locked by the shared renderer. Exact editions and
 // existing approved texts are additionally CAS-checked, including on recovery.
 const retainedAuthors=isTest?test.authors:plan.bindings.map(b=>b.author);
 const guard=`do $parents$ declare b jsonb;a jsonb;begin\nfor b in select value from jsonb_array_elements(${literal(retainedAuthors)}) loop\nselect to_jsonb(t) into a from public.authors t where id=(b->>'id')::bigint;\nif a is distinct from b then raise exception 'Retained author drift; stop';end if;end loop;\nfor b in select value from jsonb_array_elements(${literal(plan.editionBindings)}) loop\nselect to_jsonb(e) into a from public.editions e where id=(b->>'id')::bigint;\nif a is distinct from b then raise exception 'Exact edition drift; stop';end if;end loop;\nfor b in select value from jsonb_array_elements(${literal(plan.retainedDescriptions)}) loop\nselect to_jsonb(d) into a from public.catalog_work_descriptions d where work_id=(b->>'work_id')::bigint and language=b->>'language';\nif a is distinct from b then raise exception 'Retained summary drift; stop';end if;end loop;\nend;$parents$;\n`;
 const scope=`do $receipt_scope$ declare receipt jsonb;r jsonb;a jsonb;expected jsonb;begin\nreceipt:=nullif(current_setting('lumiscore.catalog_release_receipt',true),'')::jsonb;\nif receipt->>'project' is distinct from '${plan.summary.target}' or receipt->>'batch' is distinct from '${plan.summary.batch}' or jsonb_array_length(receipt->'rows') is distinct from ${plan.actions.length} then raise exception 'Exact first committed receipt required';end if;\nfor r in select value from jsonb_array_elements(receipt->'rows') loop\na:=(${literal(plan.actions)})->((r->>'seq')::integer-1);\nif a is null or r->>'relation' is distinct from a->>'relation' or r->'key' is distinct from a->'key' or r->'before_row' is distinct from 'null'::jsonb then raise exception 'Receipt outside reviewed action scope';end if;\nexecute format('select to_jsonb(jsonb_populate_record(null::public.%I,$1))',a->>'relation') into expected using a->'after';\nif r->'after_row' is distinct from expected then raise exception 'Receipt differs from reviewed proposal';end if;\nend loop;\nif (select count(distinct value->>'seq') from jsonb_array_elements(receipt->'rows'))<>${plan.actions.length} then raise exception 'Duplicate receipt sequence';end if;\nend;$receipt_scope$;\n`;
 const wrap=s=>s.replace(/(create temporary table catalog_release_receipt|do \$undo\$)/,guard+'$1').replace('do $undo$',scope+'do $undo$');
 for(const [name,s] of Object.entries({[target+'-plan.json']:JSON.stringify(plan,null,2)+'\n',[target+'-apply.sql']:wrap(renderImport(plan,{indexed:true})),[target+'-dry-run.sql']:wrap(renderImport(plan,{indexed:true,dryRun:true})),[target+'-restore.sql']:wrap(renderRollback(plan,{indexed:true}))}))fs.writeFileSync(new URL(name,root),s);
 plans[target]={actions:plan.actions.length,summaries:4,testFixtures:plan.actions.length-4};
}
const names=['four-summaries.json','production-before.json','test-before.json','test-parent-schema.json',...['production','test'].flatMap(t=>['plan.json','apply.sql','dry-run.sql','restore.sql'].map(x=>t+'-'+x))];
fs.writeFileSync(new URL('release-hashes.json',root),JSON.stringify({batch:data.batch,scope:plans,sha256:Object.fromEntries(names.map(n=>[n,createHash('sha256').update(fs.readFileSync(new URL(n,root))).digest('hex')]))},null,2)+'\n');
console.log(JSON.stringify(plans));
