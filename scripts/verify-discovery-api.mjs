// Explicit read-only application verification. Guest ratings never write public scores.
import assert from 'node:assert/strict';
const base=process.argv[2];
if(!base || !/^https?:\/\//.test(base))throw Error('Pass the exact preview or production origin');
const origin=new URL(base).origin;
for(const [q,locale]of [['Duin','nl'],['Frank Herbert','nl'],['Dune','en'],['zzxqvnomatchingtitle9341','nl']]){
 const response=await fetch(`${origin}/api/catalog/search?q=${encodeURIComponent(q)}&locale=${locale}`);
 assert.equal(response.status,200);const {results}=await response.json();assert.ok(Array.isArray(results));
 assert.ok(results.every(x=>!('editionCoverUrls'in x)&&x.workId&&x.title&&x.strictEditionLanguage===locale));
 if(q.startsWith('zz'))assert.equal(results.length,0);else assert.ok(results.length>0);
 console.log({check:'search',locale,query:q,count:results.length,first:results[0]?.title});
}
const ids=['1','3','4','5','6','7','8','9','10','11'];
const post=(ratings,locale='nl',extra={})=>fetch(`${origin}/api/taste-test/guest-result`,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...extra},body:JSON.stringify({ratings,locale,excluded:[]})});
const patterns=[ids.map((workId,i)=>({workId,rating:[0,4,5,6,7,9].includes(i)?9:3})),ids.map((workId,i)=>({workId,rating:[0,4,5,6,7,9].includes(i)?3:9}))];
const outcomes=[];
for(const [i,ratings]of patterns.entries()){
 const response=await post(ratings);assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
 const result=await response.json();assert.equal(result.profile.ratingCount,10);
 assert.ok(result.recommendations.length>=3&&result.recommendations.length<=5);
 for(const x of result.recommendations){assert.ok(!ids.includes(x.book.workId));assert.equal(x.book.strictEditionLanguage,'nl');assert.equal(x.book.match,null);assert.equal(x.matchScore,null);assert.ok(x.explanation.includes(x.book.title));}
 outcomes.push(result.recommendations.map(x=>x.book.workId));console.log({check:'guest-result',pattern:i,books:result.recommendations.map(x=>({id:x.book.workId,title:x.book.title,reason:x.explanation}))});
}
assert.notDeepEqual(outcomes[0],outcomes[1]);
assert.equal((await post(patterns[0].slice(1))).status,400);
assert.equal((await post(Array(10).fill(patterns[0][0]))).status,400);
assert.equal((await post(patterns[0],'nl',{Origin:'https://invalid.example'})).status,403);
console.log({check:'validation',passed:true});
