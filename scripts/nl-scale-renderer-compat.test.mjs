import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{fileURLToPath}from'node:url';import{execFileSync}from'node:child_process';
import{renderImport as sharedImport,renderRollback as sharedRollback}from'./catalog-release-sql.mjs';
import{renderImport,renderRollback}from'./nl-scale-release-sql.mjs';
const root=new URL('../',import.meta.url),cwd=fileURLToPath(root),reference='9c74ecaa48f7a35830f713eed3528d46ba0466ad';
test('historical default renderer preserves byte-identical import, dry-run and rollback; new catalogue alone opts in',async()=>{
 const oldSource=execFileSync('git',['-c','safe.directory='+cwd.replaceAll('\\','/').replace(/\/$/,''),'show',reference+':scripts/catalog-release-sql.mjs'],{cwd,encoding:'utf8'});
 const old=await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'));
 const plan=JSON.parse(fs.readFileSync(new URL('catalog/release-20261031/release-plan.json',root),'utf8'));
 for(const options of[{}, {dryRun:true},{canary:true}])assert.equal(sharedImport(plan,options),old.renderImport(plan,options));assert.equal(sharedRollback(plan),old.renderRollback(plan));
 assert.throws(()=>renderImport(plan),/Bound non-null/); // Historical name-only authors are not a new identity policy.
});
test('opt-in isolation does not invalidate the exact indexed SQL already committed and recovered on test',()=>{
 for(const n of['010','011','012'])for(const env of['test','production']){const dir=new URL('catalog/nl-scale-20261102/subbatches/'+n+'/',root),plan=JSON.parse(fs.readFileSync(new URL(env+'-plan.json',dir),'utf8'));assert.equal(renderImport(plan,{canary:env==='test'}),fs.readFileSync(new URL(env+'-import.sql',dir),'utf8'));assert.equal(renderRollback(plan),fs.readFileSync(new URL(env+'-rollback.sql',dir),'utf8'));}
});
test('indexed lookup refuses empty/null/unbound or unreviewed keys before SQL is produced',()=>{
 const base={summary:{batch:'synthetic',target:'hlvujbrmfdlrfxdjwsmb'},bindings:[],actions:[]};for(const key of[{}, {id:null},{name:'Same name is not identity'},{id:'',open_library_id:null}])assert.throws(()=>renderImport({...base,actions:[{ref:'x',relation:'authors',key,before:null,after:{name:'Synthetic'}}]}),/Bound non-null/);
});
