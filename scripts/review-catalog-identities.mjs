// Reproduce the narrow identity revision from the frozen pilot, never its genre gate.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildPlan, normalizeIdentity, digest } from './catalog-selection-core.mjs';
import { root } from './catalog-selection-local.mjs';
const pilot=path.resolve(process.argv[2]??'../lumiscore-catalog-v2-audit/audit/catalog-v2/open-pilot-20261001');
const dir=path.join(root,'catalog/selection-v1');
const read=async(base,name)=>JSON.parse(await fs.readFile(path.join(base,name),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const originals=await read(dir,'reviewed-records.json');
const records=structuredClone(originals);
const pins=await read(dir,'identity-pins.json');
const works=[...new Map([...(await read(dir,'database-matches.json')).matches,await read(dir,'translation-match.json')].map(w=>[w.id,w])).values()];
const oldPlan=buildPlan(originals,works,pins);
const population=(await read(pilot,'taxonomy-v2-pilot-population.json')).records;
const packets=(await read(pilot,'taxonomy-v2-neutral-evidence-packets.json')).records;
const warnings=(await read(pilot,'taxonomy-v2-gold-set-candidate.json')).records.filter(r=>r.status==='IDENTITY_UNRESOLVED');
if(warnings.length!==24)throw new Error('Frozen pilot changed');
const review=warnings.map(warning=>{
  const p=population.find(p=>p.pilot_id===warning.pilot_id);
  const packet=packets.find(x=>x.pilot_id===p.pilot_id);
  const matches=records.filter(r=>r.existing_work_id===p.work_id || (p.open_library_id&&r.open_library_id===p.open_library_id)
    || r.isbns.some(i=>p.editions.some(e=>[e.isbn_13,e.isbn_10].includes(i))) || normalizeIdentity(r.title)===normalizeIdentity(p.title));
  for(const r of matches)r.hold=[r.hold,`Identity revision 2026-10-01 ${p.pilot_id}: ${warning.reason}`].filter(Boolean).join(' ');
  return {pilot_id:p.pilot_id,work_id:p.work_id,title:p.title,author:p.author,open_library_work:p.open_library_id,
    author_open_library_id:p.author_open_library_id,editions:p.editions,issue:warning.reason,
    outcome:matches.length?'uitgesloten':'buiten selectie',
    candidates:matches.map(r=>({candidate_id:r.candidate_id,title:r.title,author:r.author,form:r.form,existing_work_id:r.existing_work_id,
      open_library_id:r.open_library_id,isbns:r.isbns,previous_action:oldPlan.actions.find(a=>a.candidate_id===r.candidate_id).kind})),
    sources:packet.evidence.filter(e=>e.source_url).map(e=>({evidence_id:e.evidence_id,url:e.source_url,checked_at:e.checked_at,
      facts:e.facts??null,identity:e.identity??null})),
    production_repair: ['N025','N092','N134'].includes(p.pilot_id)?'Separate edition/ISBN repair required; no production changes authorized or performed.':null};
});
const plan=buildPlan(records,works,pins);
const revision='identity-20261001';
const payloads={
  [`${revision}.records.json`]:records,
  [`${revision}.review.json`]:{scope:'24 identity warnings only; no HIGH classification gate. Exclusion is precautionary, not proof every catalog Work is incorrect.',records:review},
  [`${revision}.plan.json`]:plan,
};
const files={};
for(const [name,value] of Object.entries(payloads)){
  const bytes=JSON.stringify(value,null,2)+'\n';files[name]=hash(bytes);
  const destination=path.join(dir,name);
  try{if(await fs.readFile(destination,'utf8')!==bytes)throw new Error('Frozen revision differs: '+name);}
  catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(destination,bytes,{flag:'wx'});}
}
const manifest={version:revision,records_file:`${revision}.records.json`,files,
  previous_records_sha256:hash(await fs.readFile(path.join(dir,'reviewed-records.json'))),
  pins_sha256:hash(await fs.readFile(path.join(dir,'identity-pins.json'))),
  records_semantic_sha256:digest(records),previous_counts:oldPlan.counts,counts:plan.counts,
  members:plan.counts.link+plan.counts.insert,
  category_links:plan.actions.filter(a=>a.kind!=='skip').reduce((n,a)=>n+records.find(r=>r.candidate_id===a.candidate_id).categories.length,0),
  pilot_sources:Object.fromEntries(await Promise.all(['taxonomy-v2-pilot-population.json','taxonomy-v2-neutral-evidence-packets.json','taxonomy-v2-gold-set-candidate.json'].map(async f=>[f,hash(await fs.readFile(path.join(pilot,f)))])))};
const name=path.join(dir,`${revision}.manifest.json`),bytes=JSON.stringify(manifest,null,2)+'\n';
try{if(await fs.readFile(name,'utf8')!==bytes)throw new Error('Frozen manifest differs');}
catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(name,bytes,{flag:'wx'});}
console.log(JSON.stringify(manifest,null,2));
