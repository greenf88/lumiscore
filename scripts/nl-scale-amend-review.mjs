// Bind explicitly written additional-source readings to immutable first reviews.
import fs from 'node:fs';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
import {loadCases} from './nl-scale-case-store.mjs';
import {loadReviews,reviewHash,applyAmendments} from './nl-scale-reviews.mjs';
const [source,target]=process.argv.slice(2);
if(!/^content-additional-source-readings-\d{3}\.json$/.test(source??'')||!/^content-amendment-\d{3}\.json$/.test(target??''))throw Error('Explicit input and next amendment filename required');
const file=new URL(target,ROOT);if(fs.existsSync(file))throw Error('No amendment overwrite');
const input=readJson(new URL(source,ROOT)),cases=loadCases().cases,reviews=loadReviews();
const entries=input.entries.map(x=>{
 const c=cases.find(c=>c.caseNumber===x.caseNumber),before=reviews.get(c?.candidateId);
 if(!before||!x.sources?.length||!x.note?.trim())throw Error('Reviewed identity, sources and note required');
 const{sources,...review}=x;
 return{candidateId:c.candidateId,supersedes:{reference:before.reference,entrySha256:reviewHash(before)},reason:'Individually read additional substantive source resolves content gap; edition, identity and presentation approval remain separate.',review:{...review,contentStatus:'reviewed_original_draft',additionalSources:sources,reviewedOn:input.reviewedOn}};
});
applyAmendments(reviews,entries.map(a=>({...a,reference:target})));
fs.writeFileSync(file,JSON.stringify({reviewedOn:input.reviewedOn,scope:input.scope,entries},null,2)+'\n');console.log({amendments:entries.length});
