// Local proposal generation only. Existing receipt renderer; no DB/remote mutation client.
import fs from 'node:fs';
import{createHash}from'node:crypto';
import{renderImport,renderRollback}from'./catalog-release-sql.mjs';
const root=new URL('../catalog/nl-followup-002-20261031/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,root)));
const next=process.argv.includes('--next100'),prefix=next?'next100-':'';
const baseline=read(prefix+'production-before.json'),dossiers=read(next?'next100-reviewed.json':'dossiers.json').dossiers,covers=read(prefix+'cover-proof.json');
const reviewedAt='2026-10-31T19:31:00Z',batch=next?'nl-followup-003-20261031':'nl-followup-002-20261031';
const approved=dossiers.filter(d=>d.status==='approved_local_proposal');
const isbn10=isbn=>{if(!/^978\d{10}$/.test(isbn))throw Error('ISBN13 cannot convert');const s=isbn.slice(3,12),n=(11-[...s].reduce((a,c,i)=>a+Number(c)*(10-i),0)%11)%11;return s+(n===10?'X':n);};
const plan={summary:{batch,target:'qvplwejffhjvxaypmjut',state:'review_only_not_executed',baselineAt:baseline.at,approvedDossiers:approved.length,blockedDossiers:dossiers.length-approved.length,newWorks:0,newEditions:approved.filter(d=>!d.existingEditionId).length,languageCorrections:approved.filter(d=>d.existingEditionId).length,newMetadata:approved.length,newNlSummaries:approved.filter(d=>d.summary.decision==='new_original_nl').length,retainedNlSummaries:approved.filter(d=>d.summary.decision==='retain_existing_approved_nl').length,proposedExtraDutchWorks:approved.length,actualExtraDutchWorks:0,productionWrites:0,hostedTestWrites:0},bindings:[],authorCorpora:[],actions:[]};
for(const d of approved){
 const work=baseline.works.find(w=>w.id===d.workId),author=baseline.authors.find(a=>a.id===d.authorId),cover=covers.find(c=>c.workId===d.workId);
 if(!work||work.author_id!==author?.id||cover.status!==200||!cover.visualIdentity.startsWith('manual_'))throw Error('Missing identity/cover review');
 if(d.summary.decision==='retain_existing_approved_nl'&&!baseline.descriptions.some(x=>x.work_id===d.workId&&x.language==='nl'&&x.review_status==='approved'))throw Error('Retained summary missing');
 plan.bindings.push({work,author});
 const old=d.existingEditionId?baseline.editions.find(e=>e.id===d.existingEditionId):null;
 if(old&&(old.work_id!==d.workId||old.isbn_13!==d.isbn13||old.title!==d.dutchTitle||old.language!==null))throw Error('Exact NULL-language edition expected');
 const edition=old?{...old,language:'nld'}:{work_id:d.workId,title:d.dutchTitle,isbn_13:d.isbn13,isbn_10:null,language:'nld',publisher:d.publisher,open_library_edition_id:null};
 const evidence=d.sources.map(s=>({url:s.url,checkedAt:s.checkedAt??'2026-10-31',fact:s.role,...(s.accessNote?{accessNote:s.accessNote}:{})}));
 evidence.push({url:cover.url,checkedAt:cover.at,http:cover.status,sha256:cover.sha256,bytes:cover.bytes,fact:cover.visualFinding});
 if(d.conflict)evidence.push({conflict:d.conflict});
 const common={review_status:'approved',reviewed_at:reviewedAt,review_batch:batch,evidence};
 plan.actions.push({relation:'editions',ref:'edition:'+d.isbn13,key:old?{id:old.id}:{isbn_13:d.isbn13},before:old,after:edition});
 const editionId=old?old.id:'@edition:'+d.isbn13;
 plan.actions.push({relation:'catalog_edition_metadata',ref:'metadata:'+d.isbn13,key:{edition_id:editionId},before:null,after:{...common,edition_id:editionId,work_id:d.workId,bound_author_id:d.authorId,bound_title:d.dutchTitle,bound_language:'nld',bound_isbn13:d.isbn13,format:d.format,cover_url:cover.url,card_cover_url:cover.card?.url??null,evidence_url:d.sources[0].url}});
 if(d.summary.decision==='new_original_nl')plan.actions.push({relation:'catalog_work_descriptions',ref:'description:'+d.workId+':nl',key:{work_id:d.workId,language:'nl'},before:null,after:{...common,work_id:d.workId,language:'nl',bound_author_id:d.authorId,text:d.summary.text,source_type:d.summary.sourceUrl.includes('penguinrandomhouse')?'official_publisher':'official_catalog',source_name:d.summary.sourceUrl.includes('penguinrandomhouse')?'Penguin Random House':d.summary.sourceUrl.includes('bibliotheek.nl')?'Bibliotheek.nl':d.summary.sourceUrl.includes('nbdbiblion.nl')?'NBD Biblion':'Bureau ISBN',source_url:d.summary.sourceUrl,provenance:'original_source_reviewed_summary'}});
}
const eq=approved.map(d=>({work_id:d.workId,isbn13:d.isbn13,isbn10:isbn10(d.isbn13)}));
const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
// Equivalence safety supplements the unchanged shared renderer. ISBN10-only rows require review.
const preflight=`do $preflight$ declare x jsonb;a jsonb;expected jsonb;begin
 for x in select value from jsonb_array_elements(${literal(eq)}) loop
  if exists(select 1 from public.editions e where (regexp_replace(coalesce(e.isbn_13,''),'[-[:space:]]','','g')=x->>'isbn13' or upper(regexp_replace(coalesce(e.isbn_10,''),'[-[:space:]]','','g'))=x->>'isbn10') and not(e.work_id=(x->>'work_id')::bigint and e.isbn_13=x->>'isbn13')) then raise exception 'ISBN13/10 equivalent collision; stop for identity review';end if;
 end loop;
 select coalesce(jsonb_agg(to_jsonb(e) order by id),'[]') into a from public.editions e where work_id=any(array[${approved.map(d=>d.workId)}]) ${next?'':"and not(e.isbn_13=any(array["+approved.map(d=>"'"+d.isbn13+"'")+"]) and e.isbn_13 is not null)"};
 expected:=${literal(baseline.editions.filter(e=>approved.some(d=>d.workId===e.work_id)).sort((a,b)=>a.id-b.id))};
 if a is distinct from expected ${next?'and a is distinct from '+literal(baseline.editions.filter(e=>approved.some(d=>d.workId===e.work_id)).map(e=>({...e,language:'nld'})).sort((a,b)=>a.id-b.id)):''} then raise exception 'Existing edition corpus drift; repeat read-only preflight';end if;
 for x in select value from jsonb_array_elements(${literal(baseline.descriptions.filter(s=>approved.some(d=>d.workId===s.work_id)&&s.language==='nl'))}) loop
  select to_jsonb(t) into a from public.catalog_work_descriptions t where work_id=(x->>'work_id')::bigint and language='nl';
  if a is distinct from x then raise exception 'Approved retained Dutch summary drift';end if;
 end loop;
end;$preflight$;\n`;
const wrap=sql=>sql.replace('create temporary table catalog_release_receipt',preflight+'create temporary table catalog_release_receipt');
const files={[prefix+'production-plan.json']:JSON.stringify(plan,null,2)+'\n',[prefix+'production-import.sql']:wrap(renderImport(plan)),[prefix+'production-dry-run.sql']:wrap(renderImport(plan,{dryRun:true})),[prefix+'production-rollback.sql']:renderRollback(plan)};
for(const[n,s]of Object.entries(files))fs.writeFileSync(new URL(n,root),s);
fs.writeFileSync(new URL(prefix+'import-hashes.json',root),JSON.stringify(Object.fromEntries(Object.entries(files).map(([n,s])=>[n,createHash('sha256').update(s).digest('hex')])),null,2)+'\n');
console.log(JSON.stringify({...plan.summary,actions:plan.actions.length,isbnEquivalence:eq}));
