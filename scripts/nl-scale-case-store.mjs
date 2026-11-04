import fs from 'node:fs';import {createHash} from 'node:crypto';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
export function loadCases(){
 const cache=new URL('../.research-cache/nl-scale-20261102/',import.meta.url),manifests=[],cases=[];
 for(const file of ['research-selection.json',...fs.readdirSync(ROOT).filter(f=>/^research-selection-supplement-\d+\.json$/.test(f)).sort()]){
  const m=readJson(new URL(file,ROOT)),name=file==='research-selection.json'?'research-cases.jsonl':file.replace('research-selection-','research-').replace(/\.json$/,'.jsonl');
  const raw=fs.readFileSync(new URL(name,cache),'utf8');if(createHash('sha256').update(raw).digest('hex')!==m.selectionSha256)throw Error('Immutable case source changed: '+file);
  const rows=raw.trim().split('\n').map(JSON.parse);if(rows.length!==m.cases)throw Error('Case count mismatch');cases.push(...rows);manifests.push({file,sha256:m.selectionSha256});
 }
 if(new Set(cases.map(c=>c.candidateId)).size!==cases.length||new Set(cases.map(c=>c.caseNumber)).size!==cases.length)throw Error('Duplicate selected candidate or case number');
 return {cases,manifests};
}
