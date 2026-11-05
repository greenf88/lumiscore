// Offline data-only package. Reuses the established CAS/FK/receipt importer.
import fs from 'node:fs';import{createHash}from'node:crypto';
import{renderImport,renderRollback}from'./catalog-release-sql.mjs';
const root=new URL('../catalog/popular-three-20261105/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,root))),write=(n,x)=>fs.writeFileSync(new URL(n,root),typeof x==='string'?x:JSON.stringify(x,null,2)+'\n');
const data=read('reviewed-books.json'),prod=read('production-author-corpora.json'),test=read('test-author-corpora.json');
const lit=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
for(const target of['production','test']){
 const isTest=target==='test',snapshot=isTest?test:prod;
 const plan={summary:{batch:data.batch+(isTest?'-test':''),target:isTest?'hlvujbrmfdlrfxdjwsmb':'qvplwejffhjvxaypmjut',state:'review_only',newWorks:3,editions:4,descriptions:3,coverBindings:4,netDutchAvailability:3,productionActions:isTest?0:14},bindings:[],authorCorpora:[],actions:[]};
 const authors=snapshot.filter(r=>r.kind==='authors').map(r=>r.data);
 if(isTest)plan.actions.push({relation:'authors',ref:'mollick',key:{id:989310001},before:null,after:{id:989310001,name:'Ethan Mollick',open_library_id:'OL8037927A'}});
 for(const item of data.items){
  const aid=isTest?item.testAuthorId:item.productionAuthorId;
  plan.authorCorpora.push({author_id:aid,rows:snapshot.filter(r=>r.kind==='works'&&r.data.author_id===aid).map(r=>r.data).sort((a,b)=>a.id-b.id)});
  const wid=isTest?item.testWorkId:'@'+item.key;
  const work={...(isTest?{id:wid}:{}),title:item.originalTitle,author_id:aid,first_publish_year:item.year,open_library_id:null,cover_id:null,source_type:'lumiscore_native',work_type:item.workType,native_identity_key:(isTest?'test:':'')+item.nativeIdentityKey};
  plan.actions.push({relation:'works',ref:item.key,key:isTest?{id:wid}:{native_identity_key:work.native_identity_key},before:null,after:work});
  for(const e of item.editions){
   const eid=isTest?e.testEditionId:'@isbn'+e.isbn;
   plan.actions.push({relation:'editions',ref:'isbn'+e.isbn,key:isTest?{id:eid}:{isbn_13:e.isbn},before:null,after:{...(isTest?{id:eid}:{}),work_id:wid,title:item.title,language:'nld',isbn_13:e.isbn,isbn_10:null,open_library_edition_id:null,publisher:e.publisher}});
   plan.actions.push({relation:'catalog_edition_metadata',ref:'cover'+e.isbn,key:{edition_id:eid},before:null,after:{edition_id:eid,work_id:wid,bound_author_id:aid,bound_title:item.title,bound_language:'nld',bound_isbn13:e.isbn,format:e.format,cover_url:e.cover,card_cover_url:e.cover,evidence_url:e.source,evidence:[...item.evidence,{url:e.cover,checkedAt:'2026-11-05',facts:[e.coverDecision],bytes:e.bytes}],review_status:'approved',reviewed_at:data.reviewedAt,review_batch:plan.summary.batch}});
  }
  plan.actions.push({relation:'catalog_work_descriptions',ref:'summary'+item.key,key:{work_id:wid,language:'nl'},before:null,after:{work_id:wid,language:'nl',bound_author_id:aid,text:item.summary,source_type:'official_publisher',source_name:item.sourceName,source_url:item.source,evidence:item.evidence,provenance:'original_source_reviewed_summary',review_status:'approved',reviewed_at:data.reviewedAt,review_batch:plan.summary.batch}});
 }
 const guard=`do $parents$ declare b jsonb;a jsonb;begin for b in select value from jsonb_array_elements(${lit(authors)}) loop select to_jsonb(t) into a from public.authors t where id=(b->>'id')::bigint; if a is distinct from b then raise exception 'Existing author drift; stop';end if;end loop;end;$parents$;\n`;
 const scope=`do $scope$ declare receipt jsonb;r jsonb;a jsonb;expected jsonb;normalized jsonb;expectedkey jsonb;kv record;ids jsonb:='{}';begin receipt:=nullif(current_setting('lumiscore.catalog_release_receipt',true),'')::jsonb;
 if receipt->>'project' is distinct from '${plan.summary.target}' or receipt->>'batch' is distinct from '${plan.summary.batch}' or jsonb_array_length(receipt->'rows') is distinct from ${plan.actions.length} then raise exception 'Exact first committed receipt required';end if;
 for r in select value from jsonb_array_elements(receipt->'rows') order by (value->>'seq')::int loop
 a:=(${lit(plan.actions)})->((r->>'seq')::int-1);expected:=a->'after';expectedkey:=a->'key';
 for kv in select * from jsonb_each(expected) loop if jsonb_typeof(kv.value)='string' and left(kv.value#>>'{}',1)='@' then if not ids ? substring(kv.value#>>'{}',2) then raise exception 'Unresolved scoped parent';end if;expected:=jsonb_set(expected,array[kv.key],ids->substring(kv.value#>>'{}',2));end if;end loop;
 for kv in select * from jsonb_each(expectedkey) loop if jsonb_typeof(kv.value)='string' and left(kv.value#>>'{}',1)='@' then expectedkey:=jsonb_set(expectedkey,array[kv.key],ids->substring(kv.value#>>'{}',2));end if;end loop;
 execute format('select to_jsonb(jsonb_populate_record(null::public.%I,$1))',a->>'relation') into normalized using expected;
 select jsonb_object_agg(key,normalized->key) into expected from jsonb_each(expected);
 if a is null or r->>'relation' is distinct from a->>'relation' or r->'key' is distinct from expectedkey or r->'before_row'<>'null'::jsonb or not (r->'after_row' @> expected) then raise exception 'Receipt outside exact reviewed scope';end if;
 if r->'after_row' ? 'id' then ids:=jsonb_set(ids,array[a->>'ref'],r->'after_row'->'id');end if;end loop;
 if (select count(distinct value->>'seq') from jsonb_array_elements(receipt->'rows'))<>${plan.actions.length} then raise exception 'Duplicate receipt sequence';end if;end;$scope$;\n`;
 // Explicit RLS even on the session-local ON COMMIT DROP receipt. No public
 // relation, grants, policies or lasting schema changes are introduced.
 const wrap=s=>s.replace('on commit drop;','on commit drop;\nalter table catalog_release_receipt enable row level security;').replace(/(create temporary table catalog_release_receipt|do \$undo\$)/,guard+'$1').replace('do $undo$',scope+'do $undo$');
 write(target+'-plan.json',plan);write(target+'-apply.sql',wrap(renderImport(plan,{indexed:true})));write(target+'-dry-run.sql',wrap(renderImport(plan,{indexed:true,dryRun:true})));write(target+'-restore.sql',wrap(renderRollback(plan,{indexed:true})));
}
const names=['reviewed-books.json','production-before.json','production-author-corpora.json','test-before.json','test-author-corpora.json','production-schema.json','test-schema.json',...['production','test'].flatMap(t=>['plan.json','apply.sql','dry-run.sql','restore.sql'].map(n=>t+'-'+n))];
write('release-hashes.json',{batch:data.batch,productionActions:14,testActions:15,sha256:Object.fromEntries(names.map(n=>[n,createHash('sha256').update(fs.readFileSync(new URL(n,root))).digest('hex')]))});
console.log('Prepared 14 production / 15 test actions. No database execution.');
