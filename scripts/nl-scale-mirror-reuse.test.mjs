import test from'node:test';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{reviewedExistingMirrors}from'./nl-scale-mirror-reuse.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function fixture(){
 const pa={id:1,open_library_id:'OL1A'},a={id:81,open_library_id:'OL1A'},w={id:82,author_id:81,open_library_id:'OL1W',title:'Book'},e={id:83,work_id:82,open_library_edition_id:'OL1M',isbn_13:'9789022341674',title:'Boek',language:'dut',publisher:'P'};
 const p={works:[{...w,id:2,author_id:1}],authors:[pa],editions:[{...e,id:3,work_id:2}]},pre={works:[w],authors:[a],editions:[e]},s={metadata:[],descriptions:[]};
 const r={project:'hlvujbrmfdlrfxdjwsmb',presentationReadbackSha256:hash(s),entries:[{testWorkId:82,productionWorkId:2,workSha256:hash(w),authorSha256:hash(a),reason:'Exact source/ISBN/publisher/author reviewed; preserve old mirror.',editions:[{testEditionId:83,productionEditionId:3,rowSha256:hash(e)}]}]};return{p,pre,s,r};
}
test('reviewed exact mirror is reused without mutating its rows',()=>{const {p,pre,s,r}=fixture(),before=structuredClone(pre),v=reviewedExistingMirrors(p,pre,r,s);assert.equal(v.works.get(2).id,82);assert.equal(v.editions.get(3).id,83);assert.deepEqual(pre,before);});
test('later row changes or different author/ISBN/parent refuse reuse',()=>{for(const change of [f=>f.pre.works[0].title='changed',f=>f.pre.authors[0].open_library_id='OL2A',f=>f.pre.editions[0].isbn_13='9789029574891',f=>f.pre.editions[0].work_id=99]){const f=fixture();change(f);assert.throws(()=>reviewedExistingMirrors(f.p,f.pre,f.r,f.s));}});
test('unreviewed mirror and existing presentation are never overwritten',()=>{const f=fixture();assert.throws(()=>reviewedExistingMirrors(f.p,f.pre,null,f.s));f.s.descriptions.push({text:'Existing approved text'});f.r.presentationReadbackSha256=hash(f.s);assert.throws(()=>reviewedExistingMirrors(f.p,f.pre,f.r,f.s));});
