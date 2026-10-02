import fs from 'node:fs/promises';
import path from 'node:path';
import { inputs, root } from './catalog-selection-local.mjs';
import { buildPlan, readCsv } from './catalog-selection-core.mjs';
import { refuseLegacyRewrite } from './catalog-selection-inputs.mjs';
await refuseLegacyRewrite();
const {records,works,pins}=await inputs();
const directory=path.join(root,'catalog/selection-v1');
const original=readCsv(await fs.readFile(path.join(directory,'lumiscore-catalogusselectie-v1.original.csv'),'utf8'));
const corrected=readCsv(await fs.readFile(path.join(directory,'lumiscore-catalogusselectie-v1.corrected.csv'),'utf8'));
const changes=readCsv(await fs.readFile(path.join(directory,'changes.csv'),'utf8'));
const plan=buildPlan(records,works,pins);
await fs.writeFile(path.join(directory,'proposed-import-plan.json'),JSON.stringify(plan,null,2)+'\n');
const report={
  reviewed:records.length,changed_records:new Set(changes.map(c=>c['kandidaat-ID'])).size,
  field_changes:changes.length,
  fields:Object.fromEntries(Object.entries(Object.groupBy(changes,r=>r.veld)).map(([k,rows])=>[k,rows.length])),
  original_ol_year_conflicts:original.filter(r=>r['korte twijfel- of correctienotitie'].includes('Open Library-jaar gebruikt')).map(r=>{
    const fixed=corrected.find(c=>c['kandidaat-ID']===r['kandidaat-ID']);
    return {candidate_id:r['kandidaat-ID'],title:r.titel,old:r['oorspronkelijke publicatiejaar'],corrected:fixed['oorspronkelijke publicatiejaar']};
  }),
  counts:plan.counts,
  exceptions:plan.actions.filter(a=>a.kind==='skip').map(a=>({...a,title:records.find(r=>r.candidate_id===a.candidate_id).title})),
  categories: Object.fromEntries([...new Set(records.flatMap(r=>r.categories))].map(c=>[c,records.filter(r=>r.categories.includes(c)&&plan.actions.some(a=>a.candidate_id===r.candidate_id&&a.kind!=='skip')).length])),
  limitations:['AI editorial review, not HIGH evidence or publisher certification',
    'Candidate-specific bibliographic production reads only; local snapshot is not a full production clone',
    'No ISBN-to-edition or cover assertion from a checksum alone',
    'No updates to existing bibliographic years, titles or authors',
    'Fresh read-only matching and an approved target-specific production runner are required before a future production import'],
};
await fs.writeFile(path.join(directory,'review-summary.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({reviewed:report.reviewed,fields:report.fields,counts:report.counts,yearConflicts:report.original_ol_year_conflicts.length}));
