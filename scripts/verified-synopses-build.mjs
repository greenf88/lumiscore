// Offline only: reuse the guarded catalogue renderer. Never executes remote SQL.
import fs from'node:fs';import{createHash}from'node:crypto';import{renderImport,renderRollback}from'./catalog-release-sql.mjs';
const dir=new URL('../catalog/verified-synopses-20261107/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,dir),'utf8'));
const review=read('summary-review.json'),prod=read('production-before.json'),test=read('test-before.json'),columns=read('test-parent-schema.json');
const typed=(t,r)=>Object.fromEntries(columns.filter(c=>c.table_name===t).map(c=>[c.column_name,r[c.column_name]??null]));
const quote=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb",batch=review.batch,stamp=review.reviewedAt;
const mapping=prod.works.map((w,i)=>({productionWorkId:w.id,testWorkId:991880001+i,testEditionId:991890001+i,testAuthorId:w.author_id===340?987339006:991900001+i}));
const fixture={summary:{batch:batch+'-fixtures',target:'hlvujbrmfdlrfxdjwsmb',state:'review_only',testOnly:true},bindings:[],actions:[],editionBindings:[],retainedDescriptions:[]};
for(const m of mapping){const w=prod.works.find(w=>w.id===m.productionWorkId),a=prod.authors.find(a=>a.id===w.author_id),e=prod.editions.find(e=>e.work_id===w.id);
 if(!test.authors.some(a=>a.id===m.testAuthorId))fixture.actions.push({relation:'authors',ref:'fa'+m.testAuthorId,key:{id:m.testAuthorId},before:null,after:typed('authors',{...a,id:m.testAuthorId})});
 fixture.actions.push({relation:'works',ref:'fw'+m.testWorkId,key:{id:m.testWorkId},before:null,after:typed('works',{...w,id:m.testWorkId,author_id:m.testAuthorId})});
 fixture.actions.push({relation:'editions',ref:'fe'+m.testEditionId,key:{id:m.testEditionId},before:null,after:typed('editions',{...e,id:m.testEditionId,work_id:m.testWorkId})});
}
const after=(item,wid,aid)=>({work_id:wid,language:item.language,bound_author_id:aid,text:item.summary.text,source_type:item.summary.sourceType,source_name:item.summary.sourceName,source_url:item.summary.sourceUrl,evidence:[{url:item.summary.sourceUrl,checkedAt:stamp,facts:item.sourceFacts},{url:'https://openlibrary.org/books/'+item.expectedEdition.open_library_edition_id+'.json',checkedAt:stamp,facts:['Exact ISBN/title/language and bibliographic identity reviewed; synopsis is an original Work-level text, not an edition-language inference.']}],provenance:'original_source_reviewed_summary',review_status:'approved',reviewed_at:stamp,review_batch:batch});
const fixtureState={works:fixture.actions.filter(a=>a.relation==='works').map(a=>a.after),authors:[...test.authors,...fixture.actions.filter(a=>a.relation==='authors').map(a=>a.after)],editions:fixture.actions.filter(a=>a.relation==='editions').map(a=>a.after),descriptions:[],metadata:[]};
const plans={fixture};for(const target of['production','test']){
 const isTest=target==='test',p={summary:{batch:batch+(isTest?'-test':''),target:isTest?'hlvujbrmfdlrfxdjwsmb':'qvplwejffhjvxaypmjut',state:'review_only',newDescriptions:9,externalWorkIdentifierCorrections:1,newWorks:0,newEditions:0,netDutchAvailability:0},bindings:[],actions:[],editionBindings:[],retainedDescriptions:[]};
 for(const item of review.items){const m=mapping.find(m=>m.productionWorkId===item.workId),w=isTest?fixtureState.works.find(w=>w.id===m.testWorkId):item.expectedWork,a=isTest?fixtureState.authors.find(a=>a.id===m.testAuthorId):item.expectedAuthor,e=isTest?fixtureState.editions.find(e=>e.id===m.testEditionId):item.expectedEdition;
 p.bindings.push({work:w,author:a});p.editionBindings.push(e);
 if(item.workId===8856)p.actions.unshift({relation:'works',ref:'canonical-library-work',key:{id:w.id},before:w,after:{...w,open_library_id:'OL3741471W'}});
 p.actions.push({relation:'catalog_work_descriptions',ref:'summary-'+item.workId,key:{work_id:w.id,language:item.language},before:null,after:after(item,w.id,a.id)});
 }plans[target]=p;
}
const guard=p=>[
 "do $parents$ declare b jsonb;a jsonb;begin",
 "for b in select value from jsonb_array_elements("+quote(p.editionBindings??[])+") loop",
 "select to_jsonb(t) into a from public.editions t where id=(b->>'id')::bigint;",
 "if a is distinct from b then raise exception 'Exact edition drift; stop';end if;end loop;",
 ...(p.summary.target==='hlvujbrmfdlrfxdjwsmb'?[
 "for b in select value from jsonb_array_elements("+quote(test.authors)+") loop",
 "select to_jsonb(t) into a from public.authors t where id=(b->>'id')::bigint;if a is distinct from b then raise exception 'Shared test author drift; stop';end if;end loop;"]:[]),
 "end;$parents$;\n"].join('\n');
for(const[target,p]of Object.entries(plans)){
 const scope=[
 "do $receipt_scope$ declare receipt jsonb;r jsonb;a jsonb;expected jsonb;begin",
 "receipt:=nullif(current_setting('lumiscore.catalog_release_receipt',true),'')::jsonb;",
 "if receipt->>'project' is distinct from '"+p.summary.target+"' or receipt->>'batch' is distinct from '"+p.summary.batch+"' or jsonb_array_length(receipt->'rows') is distinct from "+p.actions.length+" then raise exception 'Exact first committed receipt required';end if;",
 "for r in select value from jsonb_array_elements(receipt->'rows') loop",
 "a:=("+quote(p.actions)+")->((r->>'seq')::integer-1);",
 "if a is null or r->>'relation' is distinct from a->>'relation' or r->'key' is distinct from a->'key' or r->'before_row' is distinct from a->'before' then raise exception 'Receipt outside exact reviewed scope';end if;",
 "execute format('select to_jsonb(jsonb_populate_record(null::public.%I,$1))',a->>'relation') into expected using a->'after';",
 "if r->'after_row' is distinct from expected then raise exception 'Receipt content differs from proposal';end if;end loop;",
 "if (select count(distinct value->>'seq') from jsonb_array_elements(receipt->'rows'))<>"+p.actions.length+" then raise exception 'Duplicate receipt sequence';end if;",
 "end;$receipt_scope$;\n"].join('\n');
 const wrap=s=>s.replace(/(create temporary table catalog_release_receipt|do \$undo\$)/,guard(p)+'$1').replace('do $undo$',scope+'do $undo$');
 for(const[n,s]of Object.entries({[target+'-plan.json']:JSON.stringify(p,null,2)+'\n',[target+'-apply.sql']:wrap(renderImport(p,{indexed:true})),[target+'-dry-run.sql']:wrap(renderImport(p,{indexed:true,dryRun:true})),[target+'-restore.sql']:wrap(renderRollback(p,{indexed:true}))}))fs.writeFileSync(new URL(n,dir),s);
}
fs.writeFileSync(new URL('fixture-state.json',dir),JSON.stringify(fixtureState,null,2)+'\n');
fs.writeFileSync(new URL('fixture-map.json',dir),JSON.stringify(mapping,null,2)+'\n');
const names=['summary-review.json','identity-review.json','source-identity-evidence.json','production-before.json','test-before.json','test-parent-schema.json','fixture-state.json','fixture-map.json',...Object.keys(plans).flatMap(t=>['plan.json','apply.sql','dry-run.sql','restore.sql'].map(n=>t+'-'+n))];
fs.writeFileSync(new URL('release-hashes.json',dir),JSON.stringify({batch,productionActions:plans.production.actions.length,testActions:plans.test.actions.length,testFixtureRecords:fixture.actions.length,newWorks:0,newEditions:0,newSummaries:{nl:1,en:8},netDutchAvailability:0,sha256:Object.fromEntries(names.map(n=>[n,createHash('sha256').update(fs.readFileSync(new URL(n,dir))).digest('hex')]))},null,2)+'\n');
console.log(JSON.stringify({productionActions:plans.production.actions.length,testActions:plans.test.actions.length,fixtureRecords:fixture.actions.length,mapping}));

