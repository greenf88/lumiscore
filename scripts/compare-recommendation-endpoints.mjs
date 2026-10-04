// Public, read-only recommendation computation with synthetic anonymous answers.
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { TASTE_TEST_QUESTIONS } from '../lib/taste-test/config.ts';
const samples=[];
for(const origin of ['https://lumisco.re','http://localhost:3015']) for(let repeat=1;repeat<=3;repeat++) {
  const start=performance.now();
  const response=await fetch(`${origin}/api/recommendations/guest`,{method:'POST',
    headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({answers:Object.fromEntries(TASTE_TEST_QUESTIONS.map(q=>[q.key,'left'])),locale:'en',limit:20}),
    signal:AbortSignal.timeout(30000)});
  const headersMs=performance.now()-start,body=await response.text(),data=JSON.parse(body);
  assert.equal(response.status,200);const ids=data.recommendations.map(r=>r.book.workId);
  assert.equal(ids.length,20);assert.equal(new Set(ids).size,20);
  samples.push({origin,repeat,headersMs:Math.round(headersMs),completeMs:Math.round(performance.now()-start),
    decodedBytes:Buffer.byteLength(body),workIds:ids,cacheControl:response.headers.get('cache-control')});
}
assert.ok(samples.every(s=>s.cacheControl.includes('private')&&s.cacheControl.includes('no-store')));
const production=samples.filter(s=>s.origin==='https://lumisco.re'),local=samples.filter(s=>s.origin.includes('localhost'));
const equivalent=local.every(s=>JSON.stringify(s.workIds)===JSON.stringify(production[0].workIds));
const report={at:new Date().toISOString(),syntheticAnonymousAnswers:true,productionWrites:0,samples,equivalent,
  limitation:'Functional order comparison only. Production versus local dev is not a controlled latency comparison; private results uncached, internal public cache unknown.'};
await mkdir('outputs/performance-review',{recursive:true});await writeFile('outputs/performance-review/endpoints.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));assert.equal(equivalent,true,'Actual endpoint ranking differs; review before release.');
