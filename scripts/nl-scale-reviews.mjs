// Preserve first readings and apply only explicitly bound, evidence-backed revisions.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
export const reviewHash=r=>createHash('sha256').update(JSON.stringify(r)).digest('hex');
export function applyAmendments(reviews,amendments){
 const out=new Map(reviews);
 for(const a of amendments){
  const before=out.get(a.candidateId);
  if(!before||a.supersedes?.entrySha256!==reviewHash(before)||a.supersedes?.reference!==before.reference)throw Error('Stale or unbound review amendment '+a.candidateId);
  if(!a.reason?.trim()||!a.review?.facts?.length||!a.review.additionalSources?.length)throw Error('Substantive amendment evidence required');
  const r=a.review;if(r.text&&(r.text.trim().split(/\s+/).length<50||r.text.trim().split(/\s+/).length>105||/[<>]/.test(r.text)))throw Error('Invalid amended draft');
  if(r.contentStatus!=='reviewed_original_draft'||!r.text)throw Error('Explicit original content draft required');
  out.set(a.candidateId,{...before,...r,candidateId:a.candidateId,reference:a.reference,previousReference:before.reference});
 }
 return out;
}
export function loadReviews(root=ROOT){
 const base=new Map();
 for(const file of fs.readdirSync(root).filter(f=>/^content-review-\d+\.json$/.test(f)).sort())for(const r of readJson(new URL(file,root)).entries){
  if(base.has(r.candidateId))throw Error('Duplicate first reading');base.set(r.candidateId,{...r,reference:file});
 }
 const amendments=fs.readdirSync(root).filter(f=>/^content-amendment-\d+\.json$/.test(f)).sort().flatMap(file=>readJson(new URL(file,root)).entries.map(a=>({...a,reference:file})));
 return applyAmendments(base,amendments);
}
