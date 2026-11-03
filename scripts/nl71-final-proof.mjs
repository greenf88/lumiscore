import fs from 'node:fs';
import crypto from 'node:crypto';
const base='catalog/nl-scale-20261102/', out=base+'release/final-decision/';
fs.mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(fs.readFileSync(base+p));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(base+p)).digest('hex');
const acceptance=read('release/hosted-acceptance.json'), dossiers=read('release/dossiers.json');
const index=read('test-execution-evidence-index.json');
const retained=new Map(), hashIssues=[], files=[];
for(const batch of index.subbatches){
  for(const [file,hash] of Object.entries(batch.proofFiles)) {
    const path=`subbatches/${batch.number}/${file}`;
    if(sha(path)!==hash)hashIssues.push(path);
  }
  const keys=Object.keys(batch.proofFiles);
  if(keys.includes('test-fixture-full-readback.json')){
    const path=`subbatches/${batch.number}/test-fixture-full-readback.json`, rb=read(path).readback;
    for(const relation of ['works','editions','authors'])for(const r of rb?.[relation]??[])
      if(!retained.has(relation+':'+r.id))retained.set(relation+':'+r.id,{relation,expected:r,receipt:path});
  }
  // Existing shared test fixtures are bindings, not new import actions.
  for(const file of ['test-fixture-plan.json','test-plan.json'])if(keys.includes(file)){
    const path=`subbatches/${batch.number}/${file}`;
    for(const binding of read(path).bindings??[])for(const [name,r] of Object.entries(binding)){
      const relation=name==='work'?'works':name==='edition'?'editions':name==='author'?'authors':null;
      if(relation&&r?.id&&!retained.has(relation+':'+r.id))retained.set(relation+':'+r.id,{relation,expected:r,receipt:path});
    }
  }
  for(const group of ['fixture','content']) {
    const candidates=group==='fixture'
      ? ['test-fixture-restored-committed-receipt.json','test-fixture-restored-receipt.json','test-fixture-first-committed-receipt.json']
      : ['test-restored-committed-receipt.json','test-restored-receipt.json','test-first-committed-receipt.json'];
    const file=candidates.find(f=>keys.includes(f)); if(!file)continue;
    const path=`subbatches/${batch.number}/${file}`;const data=read(path);const receipt=data.receipt??data;
    if(!Array.isArray(receipt.rows))throw Error(path+' no rows');files.push({path,sha256:sha(path)});
    for(const row of receipt.rows){
      const r=row.after_row; if(!r)continue;
      const key=row.relation==='catalog_work_descriptions'?`${r.work_id}:${r.language}`:row.relation==='catalog_edition_metadata'?r.edition_id:r.id;
      retained.set(row.relation+':'+key,{relation:row.relation,expected:r,receipt:path});
    }
  }
}
if(hashIssues.length)throw Error(JSON.stringify(hashIssues));
const wids=new Set(acceptance.rows.map(r=>r.testWorkId)), eids=new Set(acceptance.rows.map(r=>r.testEditionId));
const wanted=[...retained.values()].filter(r=>r.relation==='works'?wids.has(r.expected.id):r.relation==='editions'?eids.has(r.expected.id):r.relation==='catalog_work_descriptions'?wids.has(r.expected.work_id)&&r.expected.language==='nl':r.relation==='catalog_edition_metadata'?eids.has(r.expected.edition_id):false);
const counts={};for(const r of wanted)counts[r.relation]=(counts[r.relation]??0)+1;
for(const name of ['works','editions','catalog_work_descriptions','catalog_edition_metadata'])if(counts[name]!==498)throw Error(name+' missing '+counts[name]);
const queries=[];
for(const relation of Object.keys(counts)){
  const rows=wanted.filter(r=>r.relation===relation); let chunks=[], chunk=[];
  for(const row of rows){if(JSON.stringify(chunk).length>90000){chunks.push(chunk);chunk=[];}chunk.push(row);}if(chunk.length)chunks.push(chunk);
  for(const [j,part] of chunks.entries()){
    const key=relation==='catalog_work_descriptions'?'work_id':relation==='catalog_edition_metadata'?'edition_id':'id';
    const data=JSON.stringify(part.map(r=>({id:r.expected[key],expected:r.expected}))).replaceAll("'","''");
    const sql=`-- READ ONLY; hlvujbrmfdlrfxdjwsmb; compare retained exact receipt values, including sources/evidence.\nwith wanted as(select * from jsonb_to_recordset('${data}'::jsonb) x(id bigint,expected jsonb)), checks as(select x.id,coalesce(to_jsonb(t) @> x.expected,false) ok from wanted x left join public.${relation} t on t.${key}=x.id${relation==='catalog_work_descriptions'?" and t.language='nl'":''}) select clock_timestamp() as checked_at,'${relation}' as relation,${j} as chunk,count(*) as checked,count(*) filter(where not ok) as failures,coalesce(jsonb_agg(id) filter(where not ok),'[]'::jsonb) as issues from checks;`;
    const file=`retained-${relation}-${j}.sql`;fs.writeFileSync(out+file,sql);queries.push({file,rows:part.length,sha256:crypto.createHash('sha256').update(sql).digest('hex')});
  }
}
fs.writeFileSync(out+'retained-receipt-index.json',JSON.stringify({purpose:'Fresh read-only comparison to the final committed restored receipts; subset matches every explicit receipt field, including nested provenance, not defaults absent from receipts. SQL chunks are reproducibly generated by scripts/nl71-final-proof.mjs; their duplicate source contents are not versioned.',counts,proofIndexSha256:sha('test-execution-evidence-index.json'),validatedProofFileHashes:index.subbatches.reduce((n,b)=>n+Object.keys(b.proofFiles).length,0),receipts:files,queries},null,2)+'\n');
const placeholders=acceptance.rows.filter(r=>r.documentedPlaceholder).map(r=>{
  const d=dossiers.decisions.find(d=>d.candidateId===r.candidateId);const m=d.evidence?.missingCover;
  if(!m?.attempts?.length)throw Error('No attempts '+r.candidateId);
  return {candidateId:r.candidateId,testWorkId:r.testWorkId,editionId:r.testEditionId,title:r.title,isbn:r.isbn,classification:'no_verified_cover_available_for_import',sourceDelivery:'recorded_bulk_delivery_or_parser_failure; permanence_unknown',wrongIdentityProven:false,structurallyBrokenImageProven:false,temporaryOutageProven:false,attempts:m.attempts,sourceNote:m.note,existingDossierCheckedAt:m.checkedAt,applicationObservedAt:r.detailAt,decision:'retain_neutral_placeholder; no unverified cover binding; not a repaired cover'};
});
const exclusions=read('release/exclusions.json').exclusions.map(r=>({...r,classification:r.workId===6044?'wrong_book_identity_unresolved':'paired_card_detail_delivery_unproven',decision:'retain_exclusion; do not execute its two actions',structuralFailureProven:false,temporaryFailureProven:false}));
fs.writeFileSync(out+'cover-case-decisions.json',JSON.stringify({placeholders:placeholders.length,decodedReviewed:414,excluded:3,rule:'A missing bulk asset is not proof that no provider has a cover, or proof of transient versus permanent outage. No new bulk requests. Existing source attempts retained individually.',rows:placeholders,exclusions,largeAssetsEvidence:'../performance-and-cover-limitations.json',largeAssetLimitation:'Archived source bytes are not measured browser L/M transfers. Correct but large assets remain a performance limitation, not wrong identity or placeholder.'},null,2)+'\n');
console.log(JSON.stringify({counts,queries:queries.length,placeholderCases:placeholders.length,validatedHashes:index.subbatches.reduce((n,b)=>n+Object.keys(b.proofFiles).length,0)}));
