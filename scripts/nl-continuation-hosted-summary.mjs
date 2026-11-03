// Consolidate real observations; never erase initial image failures or assume HTTP success.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {ROOT} from './nl-continuation-bootstrap.mjs';
const dir=new URL('batch-001/',ROOT),read=n=>JSON.parse(fs.readFileSync(new URL(n,dir),'utf8'));
const presentations=read('test-presentations.json');
const raw=read('hosted-acceptance-in-progress.json').rows;
const covers=read('hosted-cover-followup.json'),reload=read('hosted-reload-cover-followup.json'),description=read('hosted-description-followup.json');
assert.equal(raw.length,35);assert.equal(new Set(raw.map(x=>x.caseNumber)).size,35);
const rows=raw.map(r=>{const p=presentations.find(p=>p.caseNumber===r.caseNumber);assert.ok(p);const checks={...r.checks},evidence=[];
 const c=covers.find(x=>x.caseNumber===r.caseNumber);if(c){if(c.cardLoaded){checks.cardCover=true;evidence.push('hosted-cover-followup.json/card');}if(c.detailLoaded){checks.detailCover=true;evidence.push('hosted-cover-followup.json/detail');}}
 const l=reload.find(x=>x.caseNumber===r.caseNumber);if(l?.passed){checks.reloadCover=true;evidence.push('hosted-reload-cover-followup.json');}
 if(r.caseNumber===description.caseNumber&&description.passed){checks.description=true;checks.reloadDescription=true;evidence.push('hosted-description-followup.json: real existing ReadMore expanded before and after reload');}
 return{caseNumber:p.caseNumber,productionWorkId:p.productionWorkId,testWorkId:p.testWorkId,title:p.title,isbn13:p.isbn13,coverId:p.cover.id,source:p.source,checks,accepted:Object.values(checks).every(Boolean),followupEvidence:evidence,initialObservationRetained:true};});
const n=rows.filter(x=>x.accepted).length;
const out={checkedAt:new Date().toISOString(),applicationSha:'9c74ecaa48f7a35830f713eed3528d46ba0466ad',deploymentCommit:'b2b5ee23dbbaaba04fd3810c4f63a3980d20477d',deploymentId:'dpl_AA4HezGdFY8sqfKBLELxcysL7VcC',origin:'https://lumiscore-mbjubus1a-rgkgroeneveld-9102.vercel.app',accepted:n,total:rows.length,coverage:'All exact35 source editions, real search/card click/detail/reload/return and original title query. Zero-rating mirror score parity only; not evidence of personalized ranking or nonzero public aggregates.',coverLimitation:'Initial M/L requests sometimes pending; two detail covers temporarily fell back. Later bounded focused navigation observed correct images and reloads. This proves successful observed loading, not guaranteed provider uptime.',measurementDefinition:'searchObservedMs/detailObservedMs in raw file include browser automation and bounded image settling; NOT TTFB, FCP or server processing latency. No production speed claim.',rows};
fs.writeFileSync(new URL('hosted-acceptance-summary.json',dir),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({accepted:n,total:rows.length,failed:rows.filter(x=>!x.accepted).map(x=>({case:x.caseNumber,checks:x.checks}))}));
