import fs from'node:fs';import{PRIOR,CACHE}from'./nl-continuation-bootstrap.mjs';
const x=JSON.parse(fs.readFileSync(new URL('catalog/nl-scale-20261102/identity-neighbours.json',PRIOR),'utf8'));
const nums=process.argv.slice(2).map(Number),open=fs.readFileSync(new URL('open-cases.jsonl',CACHE),'utf8').trim().split('\n').map(JSON.parse),ids=new Set(open.filter(c=>nums.includes(c.caseNumber)).map(c=>c.candidateId));
for(const c of x.cases.filter(c=>ids.has(c.candidateId)))console.log(JSON.stringify(c,null,2));
