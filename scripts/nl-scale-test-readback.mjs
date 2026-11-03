// Bounded exact full-row verification against actual committed public catalogue receipts.
import fs from'node:fs';import{ROOT,readJson}from'./nl-scale-snapshot.mjs';
const batch=process.argv[2];if(!/^\d{3}$/.test(batch??''))throw Error('Exact batch required');
const dir=new URL('subbatches/'+batch+'/',ROOT),raw=readJson(new URL('test-first-committed-receipt.json',dir)),r=raw.receipt??raw,p=readJson(new URL('test-plan.json',dir));
if(r.project!=='hlvujbrmfdlrfxdjwsmb'||r.batch!==p.summary.batch||r.rows.length!==p.actions.length)throw Error('Exact actual test receipt required');
const relations=new Set(['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata']);
const values=r.rows.map(a=>{if(!relations.has(a.relation))throw Error('Unreviewed relation');const after=a.after_row,key=a.relation==='catalog_work_descriptions'?`t.work_id=${after.work_id} and t.language='${after.language}'`:a.relation==='catalog_edition_metadata'?`t.edition_id=${after.edition_id}`:`t.id=${after.id}`;return `select '${a.relation}:${a.seq}' as ref,(select to_jsonb(t) from public.${a.relation} t where ${key})='${JSON.stringify(after).replaceAll("'","''")}'::jsonb as exact`;});
const q="select jsonb_build_object('checked_at',clock_timestamp(),'expected',count(*),'exact',count(*)filter(where exact),'mismatches',coalesce(jsonb_agg(ref)filter(where not coalesce(exact,false)),'[]')) as verification from("+values.join(' union all ')+')s;\n';fs.writeFileSync(new URL('test-readback-current.sql',dir),q);console.log({expected:r.rows.length,project:r.project});
// Keep the same full-row comparison in bounded requests; large evidence JSON can
// exceed connector/shell payload limits even though the result is only counts.
const chunks=[];
for(let i=0;i<values.length;i+=16){
 const file='test-readback-chunk-'+String(chunks.length+1).padStart(3,'0')+'.sql';
 const part=values.slice(i,i+16),sql=q.slice(0,q.indexOf('from(')+5)+part.join(' union all ')+')s;\n';
 fs.writeFileSync(new URL(file,dir),sql);chunks.push({file,expected:part.length});
}
fs.writeFileSync(new URL('test-readback-chunks.json',dir),JSON.stringify({batch:r.batch,project:r.project,expected:r.rows.length,chunks},null,2)+'\n');
