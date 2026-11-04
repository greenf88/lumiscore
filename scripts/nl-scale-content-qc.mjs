// Bounded local QC over cached source readings. Flags are not factual approval.
import fs from 'node:fs';
import{ROOT}from'./nl-scale-snapshot.mjs';
import{loadCases}from'./nl-scale-case-store.mjs';
import{loadReviews}from'./nl-scale-reviews.mjs';
const tokenize=s=>s.toLocaleLowerCase('nl').normalize('NFKD').replace(/\p{M}/gu,'').match(/[\p{L}\p{N}]+/gu)??[];
function longestRun(a,b){let previous=new Uint16Array(b.length+1),longest=0;for(const x of a){const next=new Uint16Array(b.length+1);for(let j=0;j<b.length;j++)if(x===b[j]){next[j+1]=previous[j]+1;longest=Math.max(longest,next[j+1]);}previous=next;}return longest;}
const cases=loadCases().cases,find=new Map(cases.map(c=>[c.candidateId,c]));
const results=[];
for(const r of loadReviews().values()){
 if(!r.text)continue;
 const tokens=tokenize(r.text),c=find.get(r.candidateId),sources=c.contentSources.filter(s=>s.text);
 const overlap=sources.map(s=>({source:s.sourceUrl,sourceSha256:s.sourceSha256,longestConsecutiveSharedTokens:longestRun(tokens,tokenize(s.text))}));
 const flags=[];
 const words=r.text.trim().split(/\s+/).length;
 if(words<50||words>105)flags.push('length');
 if(/[<>]|https?:\/\/|\b(?:tijdelijk niet geladen|beschrijving ontbreekt|ignore previous|download pdf|free ebook)\b/i.test(r.text))flags.push('unusable_or_injected_text');
 if(overlap.some(x=>x.longestConsecutiveSharedTokens>=12))flags.push('extended_source_wording_review_required');
 const nl=tokens.filter(t=>new Set(['de','het','een','van','en','zijn','haar','hun','die','dat','met','voor','naar','niet','wordt','ze']).has(t)).length;
 const en=tokens.filter(t=>new Set(['the','and','of','his','her','their','with','from','that','which','into','are']).has(t)).length;
 if(nl<5||en>nl)flags.push('language_review_required');
 results.push({candidateId:r.candidateId,reference:r.reference,words,sourceOverlap:overlap,dutchFunctionWordSignals:nl,englishFunctionWordSignals:en,flags,status:flags.length?'manual_qc_review_required':'automated_checks_passed_not_factual_approval'});
}
const result={checkedAt:new Date().toISOString(),method:'Local word/HTML/placeholder/source-overlap/language-signal checks on existing cached original summaries. No source bodies exported. A pass is not identity, originality or factual approval; review additional-source wording separately.',drafts:results.length,flagged:results.filter(x=>x.flags.length).length,results};
fs.writeFileSync(new URL('content-qc-current.json',ROOT),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({drafts:result.drafts,flagged:result.flagged,flags:results.filter(x=>x.flags.length).map(x=>({candidateId:x.candidateId,flags:x.flags,overlap:x.sourceOverlap.map(o=>o.longestConsecutiveSharedTokens)}))}));
