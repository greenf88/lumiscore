// One explicit exact-edition image, not an unbounded cover scan. No retries.
import fs from'node:fs/promises';
import{ROOT,CACHE,hash}from'./nl-continuation-bootstrap.mjs';
const [caseText,coverText]=process.argv.slice(2),caseNumber=Number(caseText),coverId=Number(coverText);
const cases=(await fs.readFile(new URL('open-cases.jsonl',CACHE),'utf8')).trim().split('\n').map(JSON.parse),c=cases.find(c=>c.caseNumber===caseNumber);
const e=c?.editionReviews.find(e=>e.coverIds.includes(coverId));if(!e||!e.isbn13.length)throw Error('Exact cached edition/cover binding required');
const path=new URL('cover-'+coverId+'.json',ROOT);let previousAttempt;
try{previousAttempt=JSON.parse(await fs.readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(previousAttempt&&(!process.argv.includes('--network-now-authorized')||previousAttempt.error!=='fetch failed'||previousAttempt.status))throw Error('Already attempted; inspect saved result, no retry');
const url=`https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`,start=Date.now();
let result={caseNumber,candidateId:c.candidateId,editionKey:e.editionKey,isbn13:e.isbn13,url,startedAt:new Date().toISOString(),...(previousAttempt?{previousAttempt,accessChange:'Explicitly authorized network execution; first sandbox fetch failed before an HTTP response. Separate public header probe returned200.'}:{})};
try{
 const r=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{'User-Agent':'LumiScore-exact-edition-review/20261103 (OpenAI Codex GPT-6; +https://lumisco.re)'}});
 result.status=r.status;result.contentType=r.headers.get('content-type');result.finalUrl=r.url;
 if(!r.ok){await r.body?.cancel();throw Error(([401,403,429].includes(r.status)?'ACCESS_STOP ':'HTTP ')+r.status);}
 const chunks=[];let bytes=0;for await(const chunk of r.body){bytes+=chunk.length;if(bytes>1000000)throw Error('Bounded image size exceeded1MB');chunks.push(chunk);}
 const raw=Buffer.concat(chunks);if(raw[0]!==255||raw[1]!==216)throw Error('Not JPEG');
 await fs.mkdir(new URL('covers/',CACHE),{recursive:true});await fs.writeFile(new URL('covers/'+coverId+'-L.jpg',CACHE),raw);
 result={...result,bytes,sha256:hash(raw),path:'.research-cache/nl-continuation-20261103/covers/'+coverId+'-L.jpg',decodeAndIdentityPending:true};
}catch(e){result.error=e.message;result.noRetry=true;}
result.finishedAt=new Date().toISOString();result.elapsedMs=Date.now()-start;
await fs.writeFile(path,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
