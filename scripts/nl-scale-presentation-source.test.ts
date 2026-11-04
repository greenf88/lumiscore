import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {safePublicSource} from '../lib/books/stored-presentation.ts';
const root=new URL('../catalog/nl-scale-20261102/subbatches/',import.meta.url);
test('every approved batch summary uses a source accepted by the unchanged shared loader',()=>{
 let checked=0;
 for(const n of fs.readdirSync(root).filter(n=>/^\d{3}$/.test(n))){const p=new URL(n+'/production-plan.json',root);if(!fs.existsSync(p))continue;const plan=JSON.parse(fs.readFileSync(p,'utf8'));for(const a of plan.actions.filter((a:{relation:string})=>a.relation==='catalog_work_descriptions')){assert(safePublicSource(a.after.source_url),n+': '+a.after.source_url);checked++;}}
 assert(checked>=145);
});
test('Eline correction changes one source field and retains identity, prose, metadata and restrictive URL policy',()=>{
 for(const env of ['production','test']){const current=JSON.parse(fs.readFileSync(new URL('012/'+env+'-plan.json',root),'utf8')),before=JSON.parse(fs.readFileSync(new URL('012/superseded-source-url-v1/'+env+'-plan.json',root),'utf8'));const d=current.actions.find((a:{relation:string;after:{work_id:number}})=>a.relation==='catalog_work_descriptions'&&[1193,987111006].includes(a.after.work_id));assert(safePublicSource(d.after.source_url));d.after.source_url+='?q=gemoderniseerd';assert(!safePublicSource(d.after.source_url));assert.deepEqual(current,before);}
});
test('current full test recovery has exactly one transaction COMMIT around both receipt-bound recoveries',()=>{
 const sql=fs.readFileSync(new URL('012/test-full-recovery-executable.sql',root),'utf8');assert.equal(sql.match(/\bcommit;/gi)?.length,1);assert.equal(sql.match(/^begin;/gm)?.length,1);assert.equal(sql.match(/^select set_config\('lumiscore.catalog_release_receipt'/gm)?.length,2);
});
