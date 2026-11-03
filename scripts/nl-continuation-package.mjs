// Explicit reviewed subset only. No network/database client, no parked-file mutation.
import fs from'node:fs';import{ROOT,hash}from'./nl-continuation-bootstrap.mjs';
import{renderImport,renderRollback}from'./catalog-release-sql.mjs';
import{selectStrictEdition}from'../lib/books/strict-edition.ts';
import{safePublicSource}from'../lib/books/stored-presentation.ts';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,ROOT),'utf8'));
const selection=read('preflight-selection.json'),prod=read('production-preflight-current.json').data,test=read('test-preflight-expanded.json').data;
const dir=new URL('batch-001/',ROOT);fs.mkdirSync(dir,{recursive:true});
const frozen=new URL('selection.json',dir);if(fs.existsSync(frozen)&&JSON.stringify(JSON.parse(fs.readFileSync(frozen)).cases)!==JSON.stringify(selection.cases))throw Error('Frozen batch selection differs');
if(!fs.existsSync(frozen))fs.writeFileSync(frozen,JSON.stringify(selection,null,2)+'\n');
if(test.project!=='hlvujbrmfdlrfxdjwsmb'||prod.project!=='qvplwejffhjvxaypmjut'||test.reserved_works||test.reserved_editions||test.reserved_authors)throw Error('Project/range preflight mismatch');
const reviewed=selection.cases.map(n=>read('reviewed-'+String(n).padStart(3,'0')+'.json'));
const isbn10=isbn=>{if(!/^978\d{10}$/.test(isbn))return null;const p=isbn.slice(3,12),check=(11-[...p].reduce((n,c,i)=>n+Number(c)*(10-i),0)%11)%11;return p+(check===10?'X':check);};
function assertIsbn(isbn){if(!/^97[89]\d{10}$/.test(isbn)||[...isbn].reduce((n,c,i)=>n+Number(c)*(i%2?3:1),0)%10)throw Error('Bad ISBN');}
const priorPlan=read('parked-pr71-action-keys.json');
const existingIds=new Set(reviewed.map(r=>r.workId).filter(Number.isInteger));
const collisions=priorPlan.actions.filter(a=>existingIds.has(a.after?.work_id)||a.relation==='works'&&existingIds.has(a.after?.id)||reviewed.some(r=>a.relation==='editions'&&(a.after.isbn_13===r.edition.isbn13||a.after.open_library_edition_id===r.edition.sourceKey)));
if(collisions.length)throw Error('PR71 overlap requires separate review');
for(const r of reviewed){assertIsbn(r.edition.isbn13);if(!r.status.startsWith('approved_')||!r.summary?.text||!r.cover?.sha256||!['paperback','hardcover'].includes(r.edition.format)||!safePublicSource(r.presentationSource))throw Error('Incomplete dossier '+r.caseNumber);const c=read(r.cover.receipt);if(c.sha256!==r.cover.sha256)throw Error('Cover receipt drift');}
const clockFile=new URL('compilation.json',dir);if(!fs.existsSync(clockFile))fs.writeFileSync(clockFile,JSON.stringify({compiledAt:new Date().toISOString(),meaning:'Compilation after all included source reviews; not a claimed exact per-source reading time'},null,2)+'\n');
const reviewedAt=JSON.parse(fs.readFileSync(clockFile,'utf8')).compiledAt,batch='nl-continuation-20261103-001';
function evidence(r){return[{type:'exact_edition_and_work_identity',reference:'reviewed-'+String(r.caseNumber).padStart(3,'0')+'.json',sources:r.sources,decision:r.identityDecision,additionalCredits:r.proposedWork?.additionalCredits??[]},{type:'original_substantive_source_review',source:r.presentationSource,provenance:r.summary.provenance,reference:r.summary.reference??null},{type:'exact_edition_front_review',receipt:r.cover.receipt,sha256:r.cover.sha256,bytes:r.cover.bytes,review:r.cover.visualReview,limitation:'Front/source binding; no barcode claim, hosted loading not yet proven'}];}
function finalWork(r,w){if(!r.workCorrections)return w;const c=r.workCorrections;if(w.title!==c.beforeTitle||w.first_publish_year!==c.beforeFirstPublishYear)throw Error('Reviewed Work correction drift');return{...w,title:c.afterTitle,first_publish_year:c.afterFirstPublishYear};}
function correctedEdition(r,e){const change=r.existingEditionCorrections?.find(c=>c.id===e.id);if(!change)return e;if(e.isbn_13!==change.expectedIsbn13||e.language!==change.beforeLanguage||e.title!==change.beforeTitle)throw Error('Existing correction drift');return{...e,title:change.afterTitle,language:change.afterLanguage};}
function write(name,plan){const files={[name+'-plan.json']:JSON.stringify(plan,null,2)+'\n',[name+'-import.sql']:renderImport(plan,{canary:name==='test'}),[name+'-dry-run.sql']:renderImport(plan,{dryRun:true,canary:name==='test'}),[name+'-rollback.sql']:renderRollback(plan)};for(const[n,b]of Object.entries(files))fs.writeFileSync(new URL(n,dir),b);return Object.fromEntries(Object.entries(files).map(([n,b])=>[n,hash(b)]));}
const packages={};
for(const env of['production','test']){
 const actions=[],bindings=[],authorCorpora=[],presentations=[],newAuthorRefs=new Map(),testAuthorRefs=new Map();let aid=0,eid=0;
 const action=(ref,relation,key,before,after)=>{actions.push({ref,relation,key,before,after});return'@'+ref;};
 function authorFor(r,p){
  if(env==='production'&&p){return p.id;}
  const person=p??r.proposedWork.primaryAuthor,key=p?.open_library_id??person.sourceAuthorKey,name=p?.name??person.name;
  if(!key){
   if(env!=='test'||!p||test.authors.some(a=>a.name===name))throw Error('Native author needs separate identity review');
   const nativeKey='production-author:'+p.id;if(newAuthorRefs.has(nativeKey))return newAuthorRefs.get(nativeKey);
   const id=998300000+(++aid),ref=action('a'+aid,'authors',{id},null,{id,name,open_library_id:null});newAuthorRefs.set(nativeKey,ref);return ref;
  }
  const existing=(env==='production'?prod:test).authors.filter(a=>a.open_library_id===key);
  if(existing.length>1)throw Error('Ambiguous author');if(existing.length){if(env==='test')testAuthorRefs.set(existing[0].id,existing[0]);return existing[0].id;}
  if(newAuthorRefs.has(key))return newAuthorRefs.get(key);
  const ref=action('a'+(++aid),'authors',{open_library_id:key},null,{...(env==='test'?{id:998300000+aid}:{}),name,open_library_id:key});newAuthorRefs.set(key,ref);return ref;
 }
 for(const r of reviewed){
  const n=r.caseNumber,existing=r.workId?prod.works.find(w=>w.id===r.workId):null,p=existing?prod.authors.find(a=>a.id===existing.author_id):r.proposedWork.primaryAuthor.existingId?prod.authors.find(a=>a.id===r.proposedWork.primaryAuthor.existingId):null;
  if(r.workId&&!existing||existing&&!p)throw Error('Missing bound production identity');
  if(!existing&&prod.works.some(w=>w.open_library_id===r.proposedWork.sourceWorkKey))throw Error('Existing source Work needs reviewed routing');
  const author=authorFor(r,p),e=r.edition;let work,workRef;
  if(env==='production'&&existing){bindings.push({work:existing,author:p});work=finalWork(r,existing);workRef=existing.id;if(JSON.stringify(work)!==JSON.stringify(existing))action('wfix'+n,'works',{id:existing.id},existing,work);}
  else{
   if(env==='test'&&test.works.some(w=>w.open_library_id&&(w.open_library_id===existing?.open_library_id||w.open_library_id===r.proposedWork?.sourceWorkKey)))throw Error('Existing test mirror requires explicit reuse review');
   work=existing?finalWork(r,existing):{title:r.proposedWork.originalTitle,first_publish_year:r.proposedWork.originalYear,open_library_id:r.proposedWork.sourceWorkKey,cover_id:null,source_type:'open_library',work_type:r.proposedWork.type};
   work={...(env==='test'?{id:998100000+n}:{}),title:work.title,author_id:author,first_publish_year:work.first_publish_year,open_library_id:work.open_library_id,cover_id:work.cover_id??null,source_type:work.source_type??null,work_type:work.work_type??null,native_identity_key:existing?'nlcontinuation:mirror001:'+existing.id:'nlcontinuation:20261103:'+r.candidateId};
   workRef=action('w'+n,'works',{native_identity_key:work.native_identity_key},null,work);
  }
  if(env==='production'&&p&&r.proposedWork&&!authorCorpora.some(a=>a.author_id===p.id))authorCorpora.push({author_id:p.id,rows:prod.author_corpora.filter(w=>w.author_id===p.id)});
  const old=prod.editions.filter(x=>x.work_id===existing?.id),same=old.filter(x=>x.open_library_edition_id===e.sourceKey||x.isbn_13===e.isbn13);
  const completion=r.isbnCompletion;
  if(same.length>1||same.length===1&&same[0].isbn_13!==e.isbn13&&!(completion&&same[0].id===completion.id&&same[0].isbn_13===completion.beforeIsbn13&&same[0].isbn_10===completion.beforeIsbn10&&completion.afterIsbn13===e.isbn13&&isbn10(e.isbn13)===completion.beforeIsbn10))throw Error('Edition collision '+n);
  let chosen,editionRef;const choices=[];
  for(const source of old){let current=correctedEdition(r,source);if(source.id===same[0]?.id){if(e.id&&source.id!==e.id)throw Error('Edition ID drift');current={...current,...(completion?{isbn_13:completion.afterIsbn13}:{}),...(source.publisher?{}:{publisher:e.publisher})};}
   if(env==='production'){choices.push(current);if(JSON.stringify(current)!==JSON.stringify(source))action('efix'+source.id,'editions',{id:source.id},source,current);if(source.id===same[0]?.id){chosen=current;editionRef=current.id;}}
   else{const row={id:998200000+(++eid),work_id:workRef,open_library_edition_id:current.open_library_edition_id,isbn_10:current.isbn_10,isbn_13:current.isbn_13,language:current.language,publisher:current.publisher,title:current.title,publish_date:null,cover_id:null};const ref=action('em'+eid,'editions',{open_library_edition_id:row.open_library_edition_id},null,row);choices.push({...row,work_id:work.id});if(source.id===same[0]?.id){chosen=row;editionRef=ref;}}
  }
  if(!same.length){const row={...(env==='test'?{id:998200000+(++eid),publish_date:null,cover_id:null}:{}),work_id:workRef,open_library_edition_id:e.sourceKey,isbn_10:isbn10(e.isbn13),isbn_13:e.isbn13,language:'dut',publisher:e.publisher,title:e.title};editionRef=action('e'+n,'editions',{open_library_edition_id:e.sourceKey},null,row);chosen=row;choices.push({...row,id:row.id??10000000+n,work_id:work.id??existing?.id});}
  if(!chosen||!editionRef)throw Error('No chosen exact edition');
  const selected=selectStrictEdition(choices,'nl',work.title);if(selected?.open_library_edition_id!==e.sourceKey)throw Error('Application chooses another edition for '+n+': '+selected?.open_library_edition_id);
  if(env==='production'&&(prod.descriptions.some(d=>d.work_id===workRef&&d.language==='nl')||prod.metadata.some(d=>d.edition_id===editionRef)))throw Error('Do not overwrite reviewed presentation');
  const ev=evidence(r);action('d'+n,'catalog_work_descriptions',{work_id:workRef,language:'nl'},null,{work_id:workRef,language:'nl',bound_author_id:author,text:r.summary.text,source_type:'official_catalog',source_name:'Gecontroleerde boek- en catalogusbronnen',source_url:r.presentationSource,evidence:ev,provenance:'original_source_reviewed_summary',review_status:'approved',reviewed_at:reviewedAt,review_batch:batch});
  action('m'+n,'catalog_edition_metadata',{edition_id:editionRef},null,{edition_id:editionRef,work_id:workRef,bound_author_id:author,bound_title:chosen.title,bound_language:chosen.language,bound_isbn13:chosen.isbn_13,format:e.format,cover_url:`https://covers.openlibrary.org/b/id/${r.cover.id}-L.jpg?default=false`,card_cover_url:`https://covers.openlibrary.org/b/id/${r.cover.id}-M.jpg?default=false`,evidence_url:r.sources.find(s=>s.url.includes('data.bibliotheken.nl'))?.url??r.sources[0].url,evidence:ev,review_status:'approved',reviewed_at:reviewedAt,review_batch:batch});
  presentations.push({caseNumber:n,candidateId:r.candidateId,productionWorkId:existing?.id??null,testWorkId:env==='test'?work.id:null,workReference:workRef,editionReference:editionRef,title:chosen.title,sourceEdition:e.sourceKey,isbn13:e.isbn13,source:r.presentationSource,summary:r.summary.text,cover:r.cover,netDutch:r.netNewDutchAvailability});
 }
 if(env==='test')for(const [id]of testAuthorRefs)authorCorpora.push({author_id:id,rows:test.author_corpora.filter(w=>w.author_id===id)});
 const summary={batch:batch+(env==='test'?'-test':''),target:env==='test'?'hlvujbrmfdlrfxdjwsmb':'qvplwejffhjvxaypmjut',scope:env==='test'?'OWNED EXACT PRESENTATION MIRRORS. Pre-existing shared authors read-only; mirrors are NOT production additions.':'REVIEW PROPOSAL ONLY. NO PRODUCTION EXECUTION.',presentations:presentations.length,actions:actions.length,newWorks:env==='test'?0:reviewed.filter(r=>!r.workId).length,ownedTestMirrors:env==='test'?reviewed.length:0,newDutchEditions:env==='test'?0:actions.filter(a=>a.relation==='editions'&&!a.before).length,newDutchSummaries:reviewed.length,newCoverBindings:reviewed.length,netDutchAvailability:env==='test'?0:reviewed.reduce((n,r)=>n+r.netNewDutchAvailability,0),relations:Object.fromEntries([...new Set(actions.map(a=>a.relation))].map(t=>[t,actions.filter(a=>a.relation===t).length]))};
 const plan={summary,bindings,authorCorpora,actions};packages[env]={summary,files:write(env,plan)};fs.writeFileSync(new URL(env+'-presentations.json',dir),JSON.stringify(presentations,null,2)+'\n');
}
fs.writeFileSync(new URL('package-hashes.json',dir),JSON.stringify({state:'LOCAL_REVIEW_ONLY_HOSTED_UNPROVEN',baseApplicationSha:'9c74ecaa48f7a35830f713eed3528d46ba0466ad',parkedPr71OverlapActions:collisions.length,packages},null,2)+'\n');
console.log(JSON.stringify(packages,null,2));
