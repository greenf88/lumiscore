// Offline renderer: reuse PR61's reviewed CAS/receipt/foreign-key rollback.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {renderImport,renderRollback} from './catalog-release-sql.mjs';
const root=new URL('../catalog/edition-recovery-20261031/',import.meta.url);
const read=n=>JSON.parse(fs.readFileSync(new URL(n,root)));
const reviews=read('reviewed-editions.json'),summaries=read('reviewed-summaries.json');
const cardProof=fs.existsSync(new URL('card-cover-http.json',root))?read('card-cover-http.json'):[];
const production=read('production-public-snapshot.json'),test=read('test-before.json');
const sha=x=>createHash('sha256').update(x).digest('hex');
const isbn10=s=>{const body=s.slice(3,12),n=(11-[...body].reduce((a,d,i)=>a+Number(d)*(10-i),0)%11)%11;return body+(n===10?'X':n);};
function plan(snapshot,target){
 const actions=[],bindings=[];
 const workFor=id=>{const original=production.works.find(w=>w.id===id),w=snapshot.works.find(w=>w.open_library_id===original.open_library_id);if(!w)throw Error('Missing existing Work '+id);return w;};
 for(const w of snapshot.works)bindings.push({work:w,author:snapshot.authors.find(a=>a.id===w.author_id)});
 for(const e of reviews.editions){
  const w=workFor(e.workId),a=snapshot.authors.find(a=>a.id===w.author_id);
  if(a.name!==e.author)throw Error('Author identity mismatch');
  const existing=snapshot.editions.filter(d=>d.isbn_13===e.isbn);
  if(existing.length>1||existing.some(d=>d.work_id!==w.id||d.title!==e.title||d.language!==e.language))throw Error('Existing edition conflict '+e.isbn);
  if(!existing.length)actions.push({relation:'editions',ref:'edition:'+e.isbn,key:{isbn_13:e.isbn},before:null,after:{work_id:w.id,title:e.title,isbn_13:e.isbn,isbn_10:null,language:e.language,publisher:e.publisher,open_library_edition_id:e.olid??null},origin:'reviewed:'+e.isbn});
  metadata(e,w,existing[0]?.id??'@edition:'+e.isbn);
 }
 function metadata(e,w,editionId){
  const old=snapshot.metadata?.find(m=>m.edition_id===editionId);
  if(old)throw Error('Review existing metadata, never overwrite');
  const evidence=[{url:e.source,isbn:e.isbn,checkedAt:reviews.checkedAt,facts:e.identity,format:e.format,language:e.language}];
  if(e.corroboration||e.independentEvidence)evidence.push({url:e.corroboration??e.independentEvidence,role:'Independent exact-edition identity/language corroboration',checkedAt:reviews.checkedAt});
  const card=cardProof.find(c=>c.isbn===e.isbn&&c.status===200&&c.file);
  if(card)evidence.push({url:card.source,role:'Same edition thumbnail actually embedded by registry',coverUrl:card.url,sha256:card.sha256,checkedAt:card.checkedAt});
  actions.push({relation:'catalog_edition_metadata',key:{edition_id:editionId},before:null,after:{edition_id:editionId,work_id:w.id,bound_author_id:w.author_id,bound_title:e.title,bound_language:e.language,bound_isbn13:e.isbn,format:e.format,cover_url:e.cover,card_cover_url:card?.url??null,evidence_url:e.source,evidence,review_status:'approved',reviewed_at:'2026-10-31T00:00:00+00:00',review_batch:'dystopia-dune-editions-20261031'},origin:'reviewed-cover:'+e.isbn});
 }
 const c=reviews.existingCover,w=workFor(c.workId),ed=snapshot.editions.find(e=>e.work_id===w.id&&e.isbn_13===c.isbn);
 if(!ed||ed.title!==c.title||ed.language!==c.language)throw Error('Existing Ketters identity changed');
 metadata(c,w,ed.id);
 for(const s of summaries){const w=workFor(s.workId);for(const language of ['nl','en']){
  if(!s[language]||snapshot.descriptions?.some(d=>d.work_id===w.id&&d.language===language))continue;
  actions.push({relation:'catalog_work_descriptions',key:{work_id:w.id,language},before:null,after:{work_id:w.id,language,bound_author_id:w.author_id,text:s[language],source_type:s.source.includes('metadata.isbn.nl')?'official_catalog':'official_publisher',source_name:s.source.includes('metadata.isbn.nl')?'Bureau ISBN':s.source.includes('penguinrandomhouse.com')?'Penguin Random House':s.source.includes('lannoo')?'Lannoo / Unieboek Spectrum':s.source.includes('pelckmans')?'Pelckmans':'A.W. Bruna',source_url:s.source,evidence:[{url:s.source,checkedAt:'2026-10-31',role:'Work-specific content facts, independently written summary. Description language is NOT edition-language evidence.'}],provenance:'original_source_reviewed_summary',review_status:'approved',reviewed_at:'2026-10-31T00:00:00+00:00',review_batch:'dystopia-dune-editions-20261031'},origin:'summary:'+s.workId+':'+language});
 }}
 return {summary:{target,batch:'dystopia-dune-editions-20261031',actions:actions.length,newWorks:0,newEditions:actions.filter(a=>a.relation==='editions').length,coverBindings:12,texts:actions.filter(a=>a.relation==='catalog_work_descriptions').length},bindings,actions};
}
function importSql(p,dryRun=false){
 // Guard all equivalent identifiers, including null-ISBN13 legacy rows. Replay
 // must also refuse duplicates that appeared after the initial preflight.
 const guard=`do $identities$ begin\n${reviews.editions.map(e=>` if (select count(*) from public.editions where regexp_replace(coalesce(isbn_13,''),'[-[:space:]]','','g')='${e.isbn}' or upper(regexp_replace(coalesce(isbn_10,''),'[-[:space:]]','','g'))='${isbn10(e.isbn)}')>1 then raise exception 'Duplicate ISBN identity ${e.isbn}';end if;`).join('\n')}\nend;$identities$;\n`;
 return renderImport(p,{dryRun,canary:p.summary.target==='hlvujbrmfdlrfxdjwsmb'}).replace('create temporary table catalog_release_receipt',guard+'create temporary table catalog_release_receipt');
}
for(const [label,snapshot,target] of [['production',production,'qvplwejffhjvxaypmjut'],['test',test,'hlvujbrmfdlrfxdjwsmb']]){
 const p=plan(snapshot,target);fs.writeFileSync(new URL(label+'-plan.json',root),JSON.stringify(p,null,2)+'\n');
 fs.writeFileSync(new URL(label+'-import.sql',root),importSql(p));fs.writeFileSync(new URL(label+'-dry-run.sql',root),importSql(p,true));fs.writeFileSync(new URL(label+'-rollback.sql',root),renderRollback(p));console.log(JSON.stringify({environment:label,...p.summary}));
}
const files=['reviewed-editions.json','reviewed-summaries.json',...['production','test'].flatMap(p=>[p+'-plan.json',p+'-import.sql',p+'-dry-run.sql',p+'-rollback.sql'])];
fs.writeFileSync(new URL('hashes.json',root),JSON.stringify(Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(new URL(f,root)))])),null,2)+'\n');
