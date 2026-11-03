// Read immutable PR71 research; never regenerate or modify the parked package.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export const PRIOR=new URL('../../lumiscore-nl-expansion-scale-20261102/',import.meta.url);
export const ROOT=new URL('../catalog/nl-continuation-20261103/',import.meta.url);
export const CACHE=new URL('../.research-cache/nl-continuation-20261103/',import.meta.url);
export const hash=x=>createHash('sha256').update(x).digest('hex');
const read=url=>JSON.parse(fs.readFileSync(url,'utf8'));
if(process.argv[1]?.endsWith('nl-continuation-bootstrap.mjs')){
const priorHead=execFileSync('git',['rev-parse','HEAD'],{cwd:PRIOR,encoding:'utf8'}).trim();
if(priorHead!=='c7f6e10dc11aab87a9d0f9cbb9545a73342bf1f6')throw Error('Parked PR71 changed');
const releasePath=new URL('catalog/nl-scale-20261102/release/release-hashes.json',PRIOR);
if(hash(fs.readFileSync(releasePath))!=='d566be5fbde74b3c32517d03785ad4542297531662cf2160a0721f9f1eec1692')throw Error('Parked manifest drift');
const {loadCases}=await import(new URL('scripts/nl-scale-case-store.mjs',PRIOR));
const {loadReviews}=await import(new URL('scripts/nl-scale-reviews.mjs',PRIOR));
const all=loadCases().cases,reviews=loadReviews();
const decisions=read(new URL('catalog/nl-scale-20261102/final-research-decisions.json',PRIOR)).decisions;
const completed=new Set(decisions.map(x=>x.candidateId));
const release=read(new URL('catalog/nl-scale-20261102/release/production-plan.json',PRIOR));
const remaining=all.filter(x=>!completed.has(x.candidateId));
fs.mkdirSync(ROOT,{recursive:true});fs.mkdirSync(CACHE,{recursive:true});
const rows=remaining.map(c=>({...c,priorContentReview:reviews.get(c.candidateId)??null}));
const raw=rows.map(x=>JSON.stringify(x)).join('\n')+'\n';
const cacheFile=new URL('open-cases.jsonl',CACHE);
if(fs.existsSync(cacheFile)&&fs.readFileSync(cacheFile,'utf8')!==raw)throw Error('Immutable resume selection changed');
fs.writeFileSync(cacheFile,raw);
const info={createdAt:new Date().toISOString(),scope:'New research only. PR71 unchanged, no production writes.',baseApplicationSha:'9c74ecaa48f7a35830f713eed3528d46ba0466ad',parkedPr:71,parkedHead:priorHead,parkedManifestSha256:hash(fs.readFileSync(releasePath)),priorFinalDecisions:decisions.length,remainingSourceRows:rows.length,remainingSourceSha256:hash(raw),sourceSelection:loadCases().manifests,priorCompletionCounts:Object.fromEntries([...new Set(decisions.map(d=>d.status))].map(s=>[s,decisions.filter(d=>d.status===s).length])),priorReleaseActions:release.actions.length,priorReleaseRefsSha256:hash(JSON.stringify(release.actions.map(a=>({relation:a.relation,key:a.key})))),logicalDuplicateRule:'Retain both source identities in the register; do not double-count the known Geuzenboek duplicate/replacement. Determine exact linkage before final logical totals.',publishedNetThisContinuation:0};
if(!fs.existsSync(new URL('resume-manifest.json',ROOT)))fs.writeFileSync(new URL('resume-manifest.json',ROOT),JSON.stringify(info,null,2)+'\n');
if(process.argv[1]?.endsWith('nl-continuation-bootstrap.mjs'))console.log(JSON.stringify({...info,open:rows.map(c=>({case:c.caseNumber,id:c.candidateId,title:c.title,author:c.author,currentNl:c.currentNlAvailable,review:c.priorContentReview?.contentStatus,remaining:c.priorContentReview?.note,editions:c.editionReviews.length,pop:c.popularitySignals.slice(0,2)}))},null,2));
}
