import fs from 'node:fs';import{ROOT,CACHE,PRIOR}from'./nl-continuation-bootstrap.mjs';
const args=process.argv.slice(2),next=args.find(a=>a.startsWith('--next='));
const ids=next?JSON.parse(fs.readFileSync(new URL('queue.json',ROOT),'utf8')).cases.filter(c=>!fs.existsSync(new URL('reviewed-'+String(c.case).padStart(3,'0')+'.json',ROOT))).slice(0,Number(next.split('=')[1])).map(c=>c.case):args.map(Number);if(!ids.length||ids.length>40||ids.some(n=>!Number.isSafeInteger(n)))throw Error('1..40 explicit dossiers required');
const cases=fs.readFileSync(new URL('open-cases.jsonl',CACHE),'utf8').trim().split('\n').map(JSON.parse);
const targets=ids.flatMap(n=>{const c=cases.find(c=>c.caseNumber===n);if(!c)throw Error('Unknown '+n);const e=c.editionReviews[0];if(!e?.coverIds.length)return[];return[{caseNumber:n,candidateId:c.candidateId,editionKey:e.editionKey,isbn13:e.isbn13,title:e.title,coverId:e.coverIds[0],sourceEvidence:c.identityChecks.map(i=>i.sourceRecordSha256),semanticStatus:'not_yet_visually_reviewed'}];});
fs.writeFileSync(new URL('cover-archive-request.json',ROOT),JSON.stringify({preparedAt:new Date().toISOString(),targets},null,2)+'\n');
const priorCache=new URL('.research-cache/nl-scale-20261102/covers/',PRIOR),out=new URL('archive-covers/',CACHE);fs.mkdirSync(out,{recursive:true});
for(const t of targets){for(const suffix of ['.jpg','-large.jpg']){const from=new URL(t.coverId+suffix,priorCache),to=new URL(t.coverId+suffix,out);if(fs.existsSync(from)&&!fs.existsSync(to))fs.copyFileSync(from,to);}}
console.log(JSON.stringify({prepared:targets.length,coverIds:targets.map(t=>t.coverId)}));
