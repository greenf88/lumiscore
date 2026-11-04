// Rebind only the reinstalled source-URL-v2 batch to its actual COMMIT receipts.
import fs from 'node:fs';import{createHash}from'node:crypto';import{ROOT,readJson}from'./nl-scale-snapshot.mjs';
const dir=new URL('subbatches/012/',ROOT),parts=[];let release;
for(const name of ['test','test-fixture']){
 const path=new URL(name+'-first-committed-receipt.json',dir),raw=readJson(path),r=raw.receipt??raw,p=readJson(new URL(name+'-plan.json',dir));
 if(r.project!=='hlvujbrmfdlrfxdjwsmb'||r.batch!==p.summary.batch||r.rows.length!==p.actions.length)throw Error('Bad actual committed receipt');
 if(name==='test'){release=r;if(r.rows.find(r=>r.relation==='catalog_work_descriptions'&&r.after_row.work_id===987111006)?.after_row.source_url!=='https://www.dbnl.org/tekst/anbe001lexi01_01/lvlw00134.php')throw Error('Not amended receipt');}
 fs.writeFileSync(path,JSON.stringify(r,null,2)+'\n');
 const original=fs.readFileSync(new URL(name+'-rollback.sql',dir),'utf8');
 const body="select set_config('lumiscore.catalog_release_receipt','"+JSON.stringify(r).replaceAll("'","''")+"',false);\n"+original;
 const atomicBody=original.replace(/(^|\n)begin;/g,'$1').replace(/commit;\s*$/,'');
 if(/\bcommit;/i.test(atomicBody))throw Error('Unexpected transaction boundary');
 parts.push("select set_config('lumiscore.catalog_release_receipt','"+JSON.stringify(r).replaceAll("'","''")+"',false);\n"+atomicBody);
 fs.writeFileSync(new URL(name+'-recovery-executable.sql',dir),body);
 fs.writeFileSync(new URL(name+'-recovery-executable-hash.json',dir),JSON.stringify({project:r.project,batch:r.batch,rows:r.rows.length,sha256:createHash('sha256').update(body).digest('hex'),receiptSha256:createHash('sha256').update(JSON.stringify(r)).digest('hex')},null,2)+'\n');
}
const full='-- OWN TEST012 source-URL-v2 only; actual COMMIT receipts.\nbegin;\n'+parts.join('\n')+'\ncommit;\n';if((full.match(/\bcommit;/gi)??[]).length!==1)throw Error('Single atomic COMMIT required');fs.writeFileSync(new URL('test-full-recovery-executable.sql',dir),full);
const expected=JSON.stringify(release.rows.map(r=>({relation:r.relation,id:r.after_row.id,work_id:r.after_row.work_id,language:r.after_row.language,after:r.after_row}))).replaceAll("'","''");
const query=`with e as(select * from jsonb_array_elements('${expected}'::jsonb)),v as(select value->>'relation' as relation,case value->>'relation' when 'works' then(select to_jsonb(t) from public.works t where t.id=(value->>'id')::bigint) when 'editions' then(select to_jsonb(t) from public.editions t where t.id=(value->>'id')::bigint) when 'catalog_work_descriptions' then(select to_jsonb(t) from public.catalog_work_descriptions t where t.work_id=(value->>'work_id')::bigint and t.language=value->>'language') else(select to_jsonb(t) from public.catalog_edition_metadata t where t.edition_id=(value->'after'->>'edition_id')::bigint) end as actual,value->'after' as expected from e)select jsonb_build_object('checked_at',clock_timestamp(),'expected',count(*),'exact',count(*)filter(where actual=expected),'mismatches',coalesce(jsonb_agg(relation)filter(where actual is distinct from expected),'[]'::jsonb)) as verification from v;`;
fs.writeFileSync(new URL('test-source-v2-readback.sql',dir),query+'\n');console.log({releaseRows:release.rows.length,fullRecoverySha256:createHash('sha256').update(full).digest('hex')});
