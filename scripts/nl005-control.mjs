// Resumable catalogue research and PR65 closure. No database client or writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const base=new URL('../',import.meta.url), root=new URL('catalog/nl-research-005-20261101/',base);
const oldRoot=new URL('../lumiscore-nl-batch002-20261031/',base);
const inventoryRoot=new URL('../lumiscore-nl-availability-20261031/catalog/nl-availability-20261031/',base);
const integrityRoot=new URL('../lumiscore-catalog-integrity-20261030/catalog/integrity-repair-20261030/',base);
const read=(p,r=base)=>JSON.parse(fs.readFileSync(new URL(p,r),'utf8'));
const hash=x=>createHash('sha256').update(x).digest('hex');
const write=(n,v)=>{fs.mkdirSync(new URL('.',new URL(n,root)),{recursive:true});fs.writeFileSync(new URL(n,root),JSON.stringify(v,null,2)+'\n');};
const sorted=x=>Array.isArray(x)?x.map(sorted):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])):x;
const eq=(a,b)=>JSON.stringify(sorted(a))===JSON.stringify(sorted(b));
const mode=process.argv[2];
if(mode==='close-pr65'){
 const current=read('pr65-closure/current-public-snapshot.json',root),counts=read('pr65-closure/current-counts.json',root),before=read('outputs/pr65-production-20261101/inventory-protected-before.json',oldRoot),index=read('catalog/nl-release-079-20261101/production-import-index.json');
 const receipts=index.batches.map((b,i)=>read('outputs/pr65-production-20261101/batch'+String(i+1).padStart(2,'0')+'-first-commit-receipt.json',oldRoot));
 const checks=receipts.flatMap(r=>r.rows.map(a=>{const group={editions:'editions',catalog_edition_metadata:'metadata',catalog_work_descriptions:'descriptions'}[a.relation],rows=current[group].filter(x=>Object.entries(a.key).every(([k,v])=>x[k]===v));return{batch:r.batch,seq:a.seq,relation:a.relation,equal:rows.length===1&&eq(rows[0],a.after_row)};}));
 assert.equal(checks.length,235);assert(checks.every(c=>c.equal));assert.equal(counts.confirmedNlWorks-before.confirmedNlWorks,79);
 const actionCounts=receipts.flatMap(r=>r.rows).reduce((a,r)=>{const key=r.relation+(r.before_row?'_update':'_insert');a[key]=(a[key]??0)+1;return a;},{});
 write('pr65-closure/closure.json',{checkedAt:current.at,approvedHead:'e291bf16bbc46cca91db11160a6e44d4df14b37f',mainAndProductionSha:'77d68bda6a73deab86fef6530065b4009ef6b004',deployment:'dpl_3XRGxXkiHbMLgYzsffBonGN3kQE2',sources:['GitHub merged PR65 and remote main','Vercel Ready production deployment and alias','Supabase production read-only exact row comparison against first committed receipts'],actions:checks.length,actionCounts,uniqueWorks:79,newWorks:0,extraDutchWorks:counts.confirmedNlWorks-before.confirmedNlWorks,nlBefore:before.confirmedNlWorks,nlAfter:counts.confirmedNlWorks,baselineNlWorks:2649,cumulativeSinceFixedBaseline:counts.confirmedNlWorks-2649,currentRowsStillEqual:true,checks,receiptHashes:receipts.map((r,i)=>({batch:r.batch,sha256:hash(fs.readFileSync(new URL('outputs/pr65-production-20261101/batch'+String(i+1).padStart(2,'0')+'-first-commit-receipt.json',oldRoot)))})),noNewProductionWrites:true});
 console.log(JSON.stringify({actions:checks.length,actionCounts,nlBefore:before.confirmedNlWorks,nlAfter:counts.confirmedNlWorks,net:79}));
}else if(mode==='select'){
 if(fs.existsSync(new URL('frozen100.json',root)))throw Error('Selection frozen; resume, do not reseed');
 const cumulative=fs.readFileSync(new URL('catalog/nl-research-004-20261101/cumulative-register.jsonl',base),'utf8').trim().split(/\r?\n/u).map(JSON.parse),snapshot=read('production-public-snapshot.json',inventoryRoot),review=read('whole-catalog-edition-source-review.json',integrityRoot);
 const seo=read('catalog/nl-research-004-20261101/seo-catalog-readiness.json'),seoIds=new Set(seo.rows.map(r=>r.workId));
 const follow=new Set([3015,1543,26,1600,1609,2144,2863,2931,1596,6234,6079,4970,4963,3301,2732,185,151,189,166,2216,2674,2710,65,2716]);
 const editorial=new Set(read('lib/catalog/editorial-campaigns-20261028.json').lists.flatMap(l=>l.workIds.map(Number)));
 const eligible=cumulative.filter(r=>!r.closedInBoundedSourceReview).map(r=>{const work=snapshot.works.find(w=>w.id===r.workId);assert(work);const collections=snapshot.collectionLinks.filter(l=>l.work_id===r.workId).map(l=>snapshot.collections.find(c=>c.id===l.collection_id)?.slug);return{candidateId:String(r.workId),workId:r.workId,originalTitle:work.title,authorId:work.author_id,author:snapshot.authors.find(a=>a.id===work.author_id)?.name,work,retainedEditionEvidence:review.filter(s=>s.workId===r.workId),priority:seoIds.has(r.workId)?0:follow.has(r.workId)?1:collections.length?2:editorial.has(r.workId)?3:4,reason:seoIds.has(r.workId)?'unclosed_SEO_destination':follow.has(r.workId)?'older_live_placeholder_or_loading_observation':collections.length?'public_collection':editorial.has(r.workId)?'public_editorial_list':'next_unclosed_inventory_identity',collections,notYetInvestigated:true,noAbsenceInference:true};}).sort((a,b)=>a.priority-b.priority||a.workId-b.workId);
 const rows=eligible.slice(0,100);assert.equal(rows.length,100);assert.equal(new Set(rows.map(r=>r.workId)).size,100);
 const previous=new Set(cumulative.filter(r=>r.closedInBoundedSourceReview).map(r=>r.workId));assert(!rows.some(r=>previous.has(r.workId)));
 write('frozen100.json',{selectedAt:new Date().toISOString(),baseSha:'77d68bda6a73deab86fef6530065b4009ef6b004',inventoryReferenceAt:snapshot.at,previousExistingDossiers:previous.size,previousNewCandidatesSeparately:10,selectionNotCompletion:true,rows});
 const ids=[...new Set([...rows.map(r=>r.workId),...seoIds])].join(',');
 const q=`select jsonb_build_object('project','qvplwejffhjvxaypmjut','at',statement_timestamp(),'works',(select jsonb_agg(to_jsonb(w) order by id) from public.works w where id in(${ids})),'authors',(select jsonb_agg(to_jsonb(a) order by id) from public.authors a where id in(select author_id from public.works where id in(${ids}))),'editions',(select jsonb_agg(to_jsonb(e) order by id) from public.editions e where work_id in(${ids})),'metadata',(select coalesce(jsonb_agg(to_jsonb(m) order by edition_id),'[]') from public.catalog_edition_metadata m where work_id in(${ids})),'descriptions',(select coalesce(jsonb_agg(to_jsonb(d) order by work_id,language),'[]') from public.catalog_work_descriptions d where work_id in(${ids}))) as snapshot;`;
 fs.writeFileSync(new URL('production-readonly.sql',root),q+'\n');
 console.log(rows.map(r=>[r.workId,r.priority,r.originalTitle,r.author,r.retainedEditionEvidence.filter(e=>e.sourceLanguage==='nld').map(e=>e.isbn).join('|')].join('\t')).join('\n'));
}else throw Error('Use close-pr65/select');
