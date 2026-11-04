// Two individually adjudicated scope conflicts. No inferred absence of a Dutch translation.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
import {loadCases} from './nl-scale-case-store.mjs';
import {loadReviews} from './nl-scale-reviews.mjs';
const cases=loadCases().cases,reviews=loadReviews(),file=new URL('final-research-decisions.json',ROOT),final=readJson(file);
const readings=[
 [77,'Dutch ISBN9789024515868 is bibliographically bound to Books of blood Vol.I–VI, LondonSphere1984–1985, while selected sourceWorkOL457864W identifies VolumeOne. A technically valid ISBN/cover cannot prove equality of these content scopes. Do not attach this collected Dutch edition to volumeone or merge six original volumes.','Obtain exact Dutch contents and identify/reuse the correct collected-content Work; existing volume-one source remains separate.'],
 [132,'SourceOL1456894W collapses a complete-works publication series into one edition with39distinct ISBNs. Individually inspected KB records identify different works, including Een lent van vaerzen1884, Noodlot1890, Extaze1892 and Williswinde1895, and include later ebook records. This is not one homogeneous book or one Dutch printedition. Selecting an arbitrary ISBN would create a wrong Work/edition identity.','Resolve each actual volume against its existing Work; do not add or merge the complete series as one book.']
];
for(const[n,reason,nextAction]of readings){const c=cases.find(c=>c.caseNumber===n),r=reviews.get(c.candidateId);if(!r||r.text)throw Error('Unexpected reviewed dossier');
 const d={candidateId:c.candidateId,caseNumber:n,status:'identity_conflict',importApproved:false,stream:'identity_scope_review',reviewedAt:'2026-11-02T19:11:00.000Z',reason,nextAction,noDutchEditionClaim:false,operationalOutcome:'excluded_from_import',evidence:{contentReview:r.reference,content:c.contentSources.map(s=>({url:s.sourceUrl,sha256:s.sourceSha256})),editions:c.editionReviews.map(e=>({key:e.editionKey,isbns:e.isbn13,libraryRecords:e.kbRecords.map(k=>({uri:k.uri,titles:k.titles,originals:k.originals,sourceReferences:k.sources}))})),bindingSHA256:createHash('sha256').update(JSON.stringify(c)).digest('hex')},remaining:[nextAction],testApplied:false,hostedAccepted:false,releaseOffered:false};
 const old=final.decisions.find(x=>x.candidateId===d.candidateId);if(old&&JSON.stringify(old)!==JSON.stringify(d))throw Error('Explicit amendment required');if(!old)final.decisions.push(d);
}
fs.writeFileSync(file,JSON.stringify(final,null,2)+'\n');console.log({individuallyResearchedConflicts:2,newImportActions:0});
