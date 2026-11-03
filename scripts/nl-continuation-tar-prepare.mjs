import fs from'node:fs';import{ROOT,CACHE,PRIOR,hash}from'./nl-continuation-bootstrap.mjs';
const numbers=process.argv.slice(2).map(Number);if(!numbers.length||numbers.length>25||numbers.some(n=>!Number.isSafeInteger(n)))throw Error('1..25 exact cases');
const cases=fs.readFileSync(new URL('open-cases.jsonl',CACHE),'utf8').trim().split('\n').map(JSON.parse);
const targets=numbers.map(n=>{const c=cases.find(c=>c.caseNumber===n),e=c?.editionReviews[0];if(!e||Math.floor(e.coverIds[0]/1000000)!==6)throw Error('Group6 only: '+n);return{caseNumber:n,candidateId:c.candidateId,editionKey:e.editionKey,isbn13:e.isbn13,title:e.title,coverId:e.coverIds[0],sourceEvidence:c.identityChecks.map(x=>x.sourceRecordSha256),notImportApproval:true};});
fs.writeFileSync(new URL('cover-large-bulk-request-001.json',ROOT),JSON.stringify({targets},null,2)+'\n');
const source=new URL('scripts/nl-scale-large-cover-bulk.mjs',PRIOR),raw=fs.readFileSync(source,'utf8');
const code=raw.replace("import{ROOT,readJson}from'./nl-scale-snapshot.mjs';","import{ROOT,CACHE}from'./nl-continuation-bootstrap.mjs';const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));")
 .replace("from'./nl-scale-large-cover-index.mjs'","from'../../lumiscore-nl-expansion-scale-20261102/scripts/nl-scale-large-cover-index.mjs'")
 .replace("new URL('../.research-cache/nl-scale-20261102/covers/',import.meta.url)","new URL('archive-covers/',CACHE)")
 .replaceAll('LumiScore-CatalogReview/20261102','LumiScore-CatalogReview/20261103');
fs.writeFileSync(new URL('nl-continuation-cover-tar.mjs',new URL('./',import.meta.url)),code);
const cache=new URL('archive-covers/',CACHE),old=new URL('.research-cache/nl-scale-20261102/covers/',PRIOR);fs.mkdirSync(cache,{recursive:true});
for(const n of fs.readdirSync(old).filter(n=>n.startsWith('l_covers_0006')&&(n.endsWith('.index')||n.endsWith('-new-metadata.json'))))if(!fs.existsSync(new URL(n,cache)))fs.copyFileSync(new URL(n,old),new URL(n,cache));
// Reader expects prior transport history; no mutation or new request for old outcomes.
const history=new URL('cover-archive-v2-readback.json',ROOT);if(!fs.existsSync(history))throw Error('Run archive preparation first');
fs.writeFileSync(new URL('tar-reader-provenance.json',ROOT),JSON.stringify({sourceSha256:hash(raw),readerSha256:hash(code),changes:['Retargeted output/cache, no parked writes','Explicit target manifest, existing bounded group6 reader','Model-identified dated UA'],targets:targets.length},null,2)+'\n');
console.log({targets:targets.length,networkRequests:0});
