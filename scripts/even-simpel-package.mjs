import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../catalog/even-simpel-20261107/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,root))),write=(n,x)=>fs.writeFileSync(new URL(n,root),typeof x==='string'?x:JSON.stringify(x,null,2)+'\n');
// Extend the established receipt/CAS/FK renderer only for these two existing
// public catalogue relations. No runtime, schema, grants or shared importer edit.
const source=fs.readFileSync(new URL('./catalog-release-sql.mjs',import.meta.url),'utf8')
 .replace("'catalog_edition_metadata'];","'catalog_edition_metadata','catalog_work_title_aliases','work_catalog_categories'];")
 .replace("catalog_edition_metadata:['edition_id']","catalog_edition_metadata:['edition_id'],catalog_work_title_aliases:['work_id','title'],work_catalog_categories:['work_id','category_id']")
 .replaceAll("'catalog_work_descriptions','catalog_edition_metadata')","'catalog_work_descriptions','catalog_edition_metadata','catalog_work_title_aliases','work_catalog_categories')")
 .replaceAll('public.catalog_edition_metadata in share row exclusive mode','public.catalog_edition_metadata,public.catalog_work_title_aliases,public.work_catalog_categories in share row exclusive mode')
 .replace("else array['edition_id'] end","when 'catalog_work_title_aliases' then array['work_id','title'] when 'work_catalog_categories' then array['work_id','category_id'] else array['edition_id'] end");
const {renderImport,renderRollback}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const data=read('reviewed-book.json'),lit=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
for(const env of ['test','production']){
 const baseline=read(env+'-before.json'),test=env==='test',aid=baseline.author.id,wid=test?990710001:'@book',eid=test?990720001:'@edition',batch=data.batch+(test?'-test':''),identity=data.identity;
 const plan={summary:{batch,target:test?'hlvujbrmfdlrfxdjwsmb':'qvplwejffhjvxaypmjut',actions:9,newWorks:1,newAuthors:0,newDutchEditions:1,newNlSummaries:1,coverBindings:1,titleAliases:4,categories:1,netDutchAvailability:1,productionExecuted:false},bindings:[],authorCorpora:[{author_id:aid,rows:baseline.corpus}],actions:[]};
 const add=(relation,ref,key,after)=>plan.actions.push({relation,ref,key,before:null,after});
 add('works','book',test?{id:wid}:{native_identity_key:identity.nativeIdentityKey},{...(test?{id:wid}:{}),title:identity.originalTitle,author_id:aid,first_publish_year:2026,open_library_id:null,cover_id:null,source_type:'lumiscore_native',work_type:null,native_identity_key:identity.nativeIdentityKey});
 add('editions','edition',test?{id:eid}:{isbn_13:identity.isbn13},{...(test?{id:eid}:{}),work_id:wid,title:identity.dutchTitle,language:'nld',isbn_13:identity.isbn13,isbn_10:null,open_library_edition_id:null,publisher:identity.publisher});
 const evidence=[...data.evidence,{type:'explicit_contributor_roles',credits:identity.additionalCredits,limitation:'One primary author in existing schema; additional credits retained, no combined author or identity merge.'},{type:'cover_front_review',...data.cover},{type:'classification',category:identity.category,work_type:null,tasteInventory:'Not added; practical cookbook is not fiction.'}];
 add('catalog_edition_metadata','cover',{edition_id:eid},{edition_id:eid,work_id:wid,bound_author_id:aid,bound_title:identity.dutchTitle,bound_language:'nld',bound_isbn13:identity.isbn13,format:'hardcover',cover_url:data.cover.url,card_cover_url:data.cover.url,evidence_url:data.cover.source,evidence,review_status:'approved',reviewed_at:data.reviewedAt,review_batch:batch});
 add('catalog_work_descriptions','summary',{work_id:wid,language:'nl'},{work_id:wid,language:'nl',bound_author_id:aid,text:data.summary,source_type:'official_publisher',source_name:data.sourceName,source_url:data.source,evidence,provenance:'original_source_reviewed_summary',review_status:'approved',reviewed_at:data.reviewedAt,review_batch:batch});
 for(const [i,title] of data.aliases.entries())add('catalog_work_title_aliases','alias'+i,{work_id:wid,title},{work_id:wid,title});
 add('work_catalog_categories','category',{work_id:wid,category_id:identity.category},{work_id:wid,category_id:identity.category});
 const guard=`do $parent$ declare actual jsonb;begin select to_jsonb(a) into actual from public.authors a where id=${aid};if actual is distinct from ${lit(baseline.author)} then raise exception 'Existing author changed; stop';end if;if not exists(select 1 from public.catalog_categories where id='nonfiction_cooking_food') then raise exception 'Expected cookbook category missing';end if;end;$parent$;\n`;
 const wrapper=s=>s.replace(/(create temporary table catalog_release_receipt|do \$undo\$)/,guard+'$1').replace('on commit drop;','on commit drop;\nalter table catalog_release_receipt enable row level security;');
 // Bind a restore receipt to the exact proposed rows before the generic CAS/FK undo.
 const scope=`do $scope$ declare receipt jsonb;r jsonb;a jsonb;expected jsonb;k jsonb;kv record;ids jsonb:='{}';normalized jsonb;begin receipt:=nullif(current_setting('lumiscore.catalog_release_receipt',true),'')::jsonb;
 if jsonb_array_length(receipt->'rows') is distinct from 9 or (select count(distinct value->>'seq') from jsonb_array_elements(receipt->'rows'))<>9 then raise exception 'Exact first committed receipt required';end if;
 for r in select value from jsonb_array_elements(receipt->'rows') order by (value->>'seq')::int loop
 a:=(${lit(plan.actions)})->((r->>'seq')::int-1);expected:=a->'after';k:=a->'key';
 for kv in select * from jsonb_each(expected) loop if jsonb_typeof(kv.value)='string' and left(kv.value#>>'{}',1)='@' then if not ids?substring(kv.value#>>'{}',2) then raise exception 'Unresolved receipt parent';end if;expected:=jsonb_set(expected,array[kv.key],ids->substring(kv.value#>>'{}',2));end if;end loop;
 for kv in select * from jsonb_each(k) loop if jsonb_typeof(kv.value)='string' and left(kv.value#>>'{}',1)='@' then k:=jsonb_set(k,array[kv.key],ids->substring(kv.value#>>'{}',2));end if;end loop;
 execute format('select to_jsonb(jsonb_populate_record(null::public.%I,$1))',a->>'relation') into normalized using expected;select jsonb_object_agg(key,normalized->key) into expected from jsonb_each(expected);
 if a is null or r->>'relation' is distinct from a->>'relation' or r->'key' is distinct from k or r->'before_row'<>'null'::jsonb or not(r->'after_row' @> expected) then raise exception 'Receipt outside exact Even simpel scope';end if;
 if r->'after_row'?'id' then ids:=jsonb_set(ids,array[a->>'ref'],r->'after_row'->'id');end if;end loop;end;$scope$;\n`;
 write(env+'-plan.json',plan);write(env+'-apply.sql',wrapper(renderImport(plan,{indexed:true})));write(env+'-dry-run.sql',wrapper(renderImport(plan,{indexed:true,dryRun:true})));write(env+'-restore.sql',wrapper(renderRollback(plan,{indexed:true})).replace('do $undo$',scope+'do $undo$'));
}
const files=['reviewed-book.json',...['production','test'].flatMap(e=>['before.json','plan.json','apply.sql','dry-run.sql','restore.sql'].map(n=>e+'-'+n))];write('release-hashes.json',{batch:data.batch,actions:9,rendererSha256:createHash('sha256').update(source).digest('hex'),sha256:Object.fromEntries(files.map(n=>[n,createHash('sha256').update(fs.readFileSync(new URL(n,root))).digest('hex')]))});
console.log('Prepared9 catalog actions per environment. No database execution.');
