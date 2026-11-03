import{createHash}from'node:crypto';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
/** Title equality is a candidate match, never permission to merge identities. */
export function reviewedUnrelatedTitleMatches(preflight,reviews,env){
 const matches=[...preflight.title_matches,...preflight.edition_title_matches];
 for(const match of matches){
  const row=match.row,workId=match.relation==='works'?row.id:row.work_id;
  const review=reviews?.find(r=>r.environment===env&&r.relation===match.relation&&r.id===row.id);
  if(!review||review.rowSha256!==digest(row)||review.workId!==workId||!Number.isInteger(review.workAuthorId)||!review.reason||!review.sourceUrl?.startsWith('https://')||preflight.author_corpora.some(w=>w.id===workId)||preflight.authors.some(a=>a.id===review.workAuthorId)||(match.relation==='works'&&row.author_id!==review.workAuthorId))throw Error('Unresolved current title identity collision');
 }
 return true;
}
