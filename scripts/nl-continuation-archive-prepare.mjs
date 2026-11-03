// Retarget the pinned, previously reviewed archive reader to NEW local outputs.
// No writes into the parked worktree; source failures are carried forward.
import fs from 'node:fs';
import {ROOT,CACHE,PRIOR,hash} from './nl-continuation-bootstrap.mjs';
const source=new URL('scripts/nl-scale-cover-archive.mjs',PRIOR),raw=fs.readFileSync(source,'utf8');
let code=raw.replace("import {ROOT,readJson} from './nl-scale-snapshot.mjs';","import {ROOT,CACHE} from './nl-continuation-bootstrap.mjs';\nconst readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));")
 .replace("from './nl-scale-zip-directory.mjs'","from '../../lumiscore-nl-expansion-scale-20261102/scripts/nl-scale-zip-directory.mjs'")
 .replace("import {loadReviews} from './nl-scale-reviews.mjs';\nimport {loadCases} from './nl-scale-case-store.mjs';",'')
 .replace("const cache=new URL('../.research-cache/nl-scale-20261102/covers/',import.meta.url);","const cache=new URL('archive-covers/',CACHE);");
const start=code.indexOf('const {cases}=loadCases();'),end=code.indexOf('if(targets.length>1500');
if(start<0||end<start)throw Error('Pinned reader layout changed');
code=code.slice(0,start)+"const targets=readJson(new URL('cover-archive-request.json',ROOT)).targets;\n"+code.slice(end);
code=code.replace("targets.length>1500","targets.length>40").replace('LumiScore-public-catalogue-review/20261102 (+https://lumisco.re)','LumiScore-CatalogReview/20261103 (OpenAI Codex GPT-6; +https://lumisco.re)');
// Global access stops, including prior executions, prohibit further source calls.
code=code.replace('let last=0;',"if(receipts.some(r=>r.status==='access_stop'))throw Error('Recorded access stop; no further requests');\nlet last=0;")
 .replace("if(error.message.startsWith('ACCESS_STOP'))throw error;","if(error.message.startsWith('ACCESS_STOP')){receipts.push({status:'access_stop',url,error:error.message,checkedAt:new Date().toISOString()});fs.writeFileSync(receiptFile,JSON.stringify(receipts,null,2)+'\\n');throw error;}");
const output=new URL('nl-continuation-cover-archive.mjs',new URL('./',import.meta.url));
if(fs.existsSync(output)&&fs.readFileSync(output,'utf8')!==code)throw Error('Generated reader drift');
fs.writeFileSync(output,code);
const cache=new URL('archive-covers/',CACHE);fs.mkdirSync(cache,{recursive:true});
const priorCache=new URL('.research-cache/nl-scale-20261102/covers/',PRIOR);
for(const n of fs.readdirSync(priorCache).filter(n=>/-metadata\.json$|-directory\.json$/.test(n)))if(!fs.existsSync(new URL(n,cache)))fs.copyFileSync(new URL(n,priorCache),new URL(n,cache));
const priorReceipts=JSON.parse(fs.readFileSync(new URL('catalog/nl-scale-20261102/cover-archive-v2-readback.json',PRIOR),'utf8'));
const inherited=new URL('cover-archive-readback.json',ROOT);if(!fs.existsSync(inherited))fs.writeFileSync(inherited,JSON.stringify(priorReceipts,null,2)+'\n');
fs.writeFileSync(new URL('archive-reader-provenance.json',ROOT),JSON.stringify({source:'PR71/scripts/nl-scale-cover-archive.mjs',sourceSha256:hash(raw),generatedSha256:hash(code),changes:['New output/cache paths only','Explicit maximum40 target manifest instead of all reviewed drafts','Model-identified User Agent','Persistent access stop'],sameChecks:['Exact ZIP member','CRC32 and SHA256','Bounded206 reads','No retry of inherited HTTP failures','No whole-archive download','No automatic semantic approval']},null,2)+'\n');
console.log(JSON.stringify({readerReady:true,networkRequests:0,inheritedReceipts:priorReceipts.length}));
