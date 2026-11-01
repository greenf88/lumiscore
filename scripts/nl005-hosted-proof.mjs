// Bounded, public catalogue proof preparation. No network/database client.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='catalog/nl-research-005-20261101/';
const read=n=>JSON.parse(fs.readFileSync(dir+n,'utf8'));
const save=(n,v)=>fs.writeFileSync(dir+n,JSON.stringify(v,null,2)+'\n');
const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const names=['test-seed',...Array.from({length:5},(_,i)=>`batch0${i+1}-test`)];
const rows=names.flatMap(n=>read(n+'-first-commit-receipt.json').rows);
const lookup={authors:'authors',works:'works',editions:'editions',catalog_edition_metadata:'metadata',catalog_work_descriptions:'descriptions'};
if(process.argv[2]==='dependencies'){
 const fks=read('test-foreign-keys.json').foreignKeys;
 const checks=fks.flatMap(f=>{
  const ids=rows.filter(r=>r.relation===f.parentTable&&r.before_row===null).map(r=>r.after_row.id);
  if(!ids.length)return[];
  assert.equal(f.pairs.length,1);assert.equal(f.pairs[0].parent,'id');
  assert.match(f.childSchema,/^[a-z_]+$/);assert.match(f.childTable,/^[a-z_0-9]+$/);assert.match(f.pairs[0].child,/^[a-z_]+$/);
  const expectedOwn=rows.filter(r=>r.relation===f.childTable&&ids.includes(r.after_row[f.pairs[0].child])).length;
  return [`select '${f.name}' as constraint_name,'${f.childSchema}.${f.childTable}' as relation,${expectedOwn} as expected_own,count(*) as actual from ${f.childSchema}.${f.childTable} where ${f.pairs[0].child} in(${ids.join(',')})`];
 });
 fs.writeFileSync(dir+'test-dependency-preflight.sql',`select jsonb_build_object('project','hlvujbrmfdlrfxdjwsmb','at',statement_timestamp(),'checks',(select jsonb_agg(x) from(${checks.join('\nunion all\n')}) x)) as snapshot;\n`);
 console.log(JSON.stringify({checks:checks.length,ownRows:rows.length}));
}else if(process.argv[2]==='installed'){
 const current=read(process.argv[3]||'first-installed-full.json');
 const results=rows.map(r=>{
  const actual=current[lookup[r.relation]].find(v=>Object.entries(r.key).every(([k,x])=>v[k]===x));
  return{relation:r.relation,key:r.key,equal:stable(actual)===stable(r.after_row)};
 });
 assert(results.every(r=>r.equal),'Full-row mismatch');
 assert.equal(stable(current.protected),stable(read('test-before.json').protected),'Protected data changed');
 save('test-full-row-readback-proof.json',{at:current.at,project:current.project,comparisons:results.length,allEqual:true,protectedEqual:true,results});
 console.log(JSON.stringify({matched:results.length,protectedEqual:true}));
}else if(process.argv[2]==='restored'){
 const current=read('final-approved-test-state.json'),receipts=names.flatMap(n=>read(n+'-restored-commit-receipt.json')[0].receipt.rows).concat(read('fixture-restored-commit-receipt.json').rows);
 const results=receipts.map(r=>{const actual=current[lookup[r.relation]].find(v=>Object.entries(r.key).every(([k,x])=>v[k]===x));return{relation:r.relation,key:r.key,equal:stable(actual)===stable(r.after_row)};});
 assert(results.every(r=>r.equal));assert.equal(stable(current.protected),stable(read('test-before.json').protected));
 save('final-test-readback-proof.json',{at:current.at,project:current.project,comparisons:results.length,allEqual:true,protectedEqual:true,results});console.log(JSON.stringify({matched:results.length,protectedEqual:true}));
}else if(process.argv[2]==='undo'){
 const before=read('test-before.json'),after=read('after-committed-undo-full.json');
 const checks=Object.keys(lookup).map(k=>lookup[k]).concat(['reserved','protected']).map(k=>({section:k,equal:stable(before[k])===stable(after[k])}));
 assert(checks.every(r=>r.equal),'Committed undo differs from original baseline');
 save('committed-recovery-proof.json',{project:after.project,beforeAt:before.at,afterAt:after.at,checks,allEqual:true,ownRowsRemoved:rows.length,method:'Six separate committed receipt-bound transactions, reverse content batches then own public seed; not a ROLLBACK dry-run.'});
 console.log(JSON.stringify({checks,ownRowsRemoved:rows.length}));
}else throw Error('Use dependencies|installed|undo');
