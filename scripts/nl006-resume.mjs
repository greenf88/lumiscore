// Offline continuation/control: does not connect to any database.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const dir='catalog/nl-research-006-20261101/';
const read=(n)=>JSON.parse(fs.readFileSync(dir+n));
const write=(n,v)=>fs.writeFileSync(dir+n,JSON.stringify(v,null,2)+'\n');
const frozen=read('frozen100.json');
const footer=new Set(['2095315','2110438','1998854','2127115','2127119','2148501']);
const requests=[];
for(const r of frozen.rows){
 if(fs.existsSync(dir+'sources/exact-'+r.workId+'.json'))continue;
 const d=read('sources/discovery-'+r.workId+'.json');
 const first=d.links.find(l=>!footer.has(new URL(l.url).pathname.split('/')[1]));
 if(!first)continue;
 requests.push({workId:r.workId,name:'exact-'+r.workId,url:first.url,purpose:'Candidate page observed in named discovery results; identity/language/format/content still require human review.'});
}
for(let i=0;i<requests.length;i+=10)write('resume-requests-'+String(i/10+1).padStart(2,'0')+'.json',requests.slice(i,i+10));
assert.equal(new Set(frozen.rows.map(r=>r.workId)).size,100);
console.log(JSON.stringify({newExactRequests:requests.length,batches:Math.ceil(requests.length/10)}));

if(process.argv.includes('--close-pr66')){
 const prev='../lumiscore-nl-research-cohort005-20261101/outputs/pr66-production-20261101/';
 const proof=JSON.parse(fs.readFileSync(prev+'execution-proof.json'));
 const receipts=proof.firstCommitReceipts.map(n=>({name:n,value:JSON.parse(fs.readFileSync(prev+n)),sha256:createHash('sha256').update(fs.readFileSync(prev+n)).digest('hex')}));
 const actions=receipts.flatMap(r=>r.value.rows.map(a=>({batch:r.value.batch,...a})));
 assert.equal(actions.length,156);assert.equal(proof.netExtraNlWorks,43);
 assert(!actions.some(r=>[48,65].includes(r.after_row?.work_id)));
 write('pr66-executed-closure.json',{checkedAt:new Date().toISOString(),...proof,productionStateSource:'FIRST COMMIT receipts, readback and independently confirmed main/Ready deployment/alias; not inferred from browser',published:true,receiptHashes:receipts.map(({name,sha256})=>({name,sha256})),actions,excluded:[{workId:48,reason:'Exact proposed ISBN9789056724054 not the selected hosted variant9789056727659; 2actions held.'},{workId:65,reason:'Exact proposed ISBN9789022557112 not the selected hosted variant9789022574492; 2actions held.'}],research006NotPublished:true});
}
