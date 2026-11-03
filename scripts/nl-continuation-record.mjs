// Materialize human/source-reviewed decisions; never auto-approve source texts.
import fs from 'node:fs';
import {ROOT,CACHE} from './nl-continuation-bootstrap.mjs';
const rows=fs.readFileSync(new URL('open-cases.jsonl',CACHE),'utf8').trim().split('\n').map(JSON.parse);
export function record(number,review){
 const c=rows.find(c=>c.caseNumber===number);if(!c)throw Error('Unknown case');
 const selected=c.editionReviews.find(e=>!e.problems.length)??c.editionReviews[0];
 const result={caseNumber:number,candidateId:c.candidateId,reviewedOn:'2026-11-03',workId:c.currentWork?.id??null,newWork:!c.currentWork,netNewDutchAvailability:c.currentNlAvailable?0:1,...review,testApplied:false,published:false};
 if(review.edition===undefined&&selected)result.edition={id:selected.currentMatches[0]?.id??null,sourceKey:selected.editionKey.replace('/books/',''),title:selected.title,isbn13:selected.isbn13[0],language:'nl',format:selected.format.toLowerCase(),publisher:selected.publisher[0]};
 if(review.reusePriorSummary){if(!c.priorContentReview?.text)throw Error('No prior original summary');result.summary={language:'nl',provenance:'prior_original_source_reviewed_summary',reference:c.priorContentReview.reference,text:c.priorContentReview.text};delete result.reusePriorSummary;}
 if(result.summary?.text){const count=result.summary.text.trim().split(/\s+/).length;if(count<50||count>105)throw Error('Summary word count '+count);}
 if(review.coverId){const name=review.coverReceipt??'cover-'+review.coverId+'.json';if(!/^cover-(normal-)?\d+\.json$/.test(name))throw Error('Named exact cover receipt required');const receipt=JSON.parse(fs.readFileSync(new URL(name,ROOT),'utf8'));if(!receipt.sha256)throw Error('Successful transport receipt required before attaching visual decision');result.cover={id:review.coverId,receipt:name,sha256:receipt.sha256,bytes:receipt.bytes,visualReview:review.visualReview};delete result.coverId;delete result.visualReview;delete result.coverReceipt;}
 result.remaining??=['Current full-row/duplicate preflight','Local import/recovery validation','Test import and exact hosted acceptance'];
 fs.writeFileSync(new URL('reviewed-'+String(number).padStart(3,'0')+'.json',ROOT),JSON.stringify(result,null,2)+'\n');
 return result;
}
