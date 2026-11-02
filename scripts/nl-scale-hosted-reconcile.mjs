// Reconcile actual browser observations; a planned URL or HTTP200 is not acceptance.
import fs from'node:fs';import{ROOT,readJson}from'./nl-scale-snapshot.mjs';
const targets=readJson(new URL('hosted-acceptance-targets.json',ROOT));
const details=readJson(new URL('hosted-detail-readback-v2.json',ROOT));
const cards=readJson(new URL('hosted-card-observations.json',ROOT));
const searches=readJson(new URL('hosted-search-observations.json',ROOT));
for(const p of[details,cards,searches])if(p.deployment!==targets.deployment||p.applicationBase!==targets.applicationBase)throw Error('Mixed deployment/application evidence');
const decisions=readJson(new URL('final-research-decisions.json',ROOT)).decisions;
const norm=s=>String(s??'').normalize('NFKC').trim();
const rows=targets.targets.map(t=>{
 const d=details.details.findLast(d=>d.work===t.testWorkId&&d.edition===t.expectedEditionId&&d.titleCorrect&&d.isbnVisible&&d.summaryVisible&&d.sourceCorrect&&d.coverLoaded);
 const c=cards.observations.findLast(c=>c.work===t.testWorkId&&c.edition===t.expectedEditionId&&c.titleCorrect&&c.scoreParity&&c.coverLoaded&&c.actualClickThrough&&c.detailTitleMatches&&c.backNavigationMatches);
 const find=q=>searches.observations.findLast(s=>s.work===t.testWorkId&&s.edition===t.expectedEditionId&&norm(s.query)===norm(q)&&s.found&&s.titleCorrect&&s.scoreParity);
 const nl=find(t.title),original=find(t.originalTitle),ds=decisions.filter(d=>d.importApproved&&d.edition.isbn13===t.isbn);
 if(ds.length!==1)throw Error('Ambiguous approved dossier/edition mapping '+t.testWorkId);
 const checks={exactDetailAndIsbn:Boolean(d),visibleDutchSummaryAndSource:Boolean(d),loadedDetailCover:Boolean(d),loadedCardCover:Boolean(c),emptyPublicScoreParity:Boolean(c),actualClickAndReturn:Boolean(c),dutchTitleSearch:Boolean(nl),originalTitleSearch:Boolean(original)};
 return{candidateId:ds[0].candidateId,testWorkId:t.testWorkId,testEditionId:t.expectedEditionId,batch:t.batch,title:t.title,isbn:t.isbn,checks,accepted:Object.values(checks).every(Boolean),detailAt:d?.checkedAt??null,cardAt:c?.at??null,searchAt:[nl?.at??null,original?.at??null],limitation:'Own test Works have no reliable public score; this proves empty-state parity only. Positive-score unit tests and unchanged shared public-score source are separate evidence.'};
});
const proof={checkedAt:new Date().toISOString(),deployment:targets.deployment,testedCommit:targets.testedCommit,applicationBase:targets.applicationBase,testProject:'hlvujbrmfdlrfxdjwsmb',productionWrites:0,total:rows.length,accepted:rows.filter(r=>r.accepted).length,remaining:rows.filter(r=>!r.accepted).length,scope:'Exact proposed Dutch editions; representative cross-language/theme/device routes recorded separately. Not production acceptance.',rows};
fs.writeFileSync(new URL('hosted-acceptance-matrix.json',ROOT),JSON.stringify(proof,null,2)+'\n');
if(process.argv.includes('--write'))for(const batch of new Set(rows.map(r=>r.batch))){const path=new URL('subbatches/'+batch+'/execution-status.json',ROOT),s=readJson(path);const accepted=rows.filter(r=>r.batch===batch&&r.accepted).map(r=>r.candidateId);if(accepted.some(id=>!s.candidateIds.includes(id)))throw Error('Wrong execution ownership');s.hostedAcceptedCandidateIds=accepted;s.testedApplicationSha=targets.applicationBase;s.testedDeployment=targets.deployment;s.browserAcceptanceReference='hosted-acceptance-matrix.json';fs.writeFileSync(path,JSON.stringify(s,null,2)+'\n');}
console.log(JSON.stringify({targets:proof.total,accepted:proof.accepted,remaining:proof.remaining,missingByCheck:Object.fromEntries(Object.keys(rows[0].checks).map(k=>[k,rows.filter(r=>!r.checks[k]).length]))}));
