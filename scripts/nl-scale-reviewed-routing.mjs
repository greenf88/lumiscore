// Research routing only: never merges, reparents or modifies an existing Work.
export function reviewedExistingCase(cases,item,identityReviews,work,author){
 const c=cases.find(c=>c.caseNumber===item.caseNumber);
 if(!c||!work||!author)throw Error('Exact existing Work/source case required');
 if(c.workId===item.workId)return c;
 const r=identityReviews.find(r=>r.candidateId===c.candidateId&&r.status==='use_existing_work_identity'&&r.resolvedWorkId===item.workId);
 if(c.workId!==null||item.existingIdentityResolution!=='identity-reviewed-decisions.json#'+c.candidateId||!r?.reason||!r.evidence?.length||r.currentSourceWorkId!==work.open_library_id||!c.sourceAuthors.some(a=>a.key.split('/').at(-1)===author.open_library_id))throw Error('Unresolved existing-identity routing; no new Work or merge allowed');
 return c;
}
