import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { inputs } from './catalog-selection-local.mjs';
import { buildPlan, digest } from './catalog-selection-core.mjs';
import { reviewedInput, sha256 } from './catalog-selection-inputs.mjs';
const input=await inputs(),index=727;
const action=(records=input.records,works=input.works,pins=input.pins)=>buildPlan(records,works,pins).actions[index];
test('Rendez-vous requires the reviewed ISBN→Edition→Work chain and never selects 1739',()=>{
  assert.equal(action().kind,'link');assert.equal(action().work_id,1078);
  const noPin={...input.pins};delete noPin['LS1000-0728'];
  assert.equal(action(undefined,undefined,noPin).kind,'skip','title/author ambiguity stays excluded');
  for(const changes of [{existing_work_id:1739},{open_library_id:'OL20923709W'},{isbns:[]},
    {isbns:['9781407470610']},{form:'stripbewerking'},{form:'omnibus'},{year:2011}]){
    const records=structuredClone(input.records);Object.assign(records[index],changes);
    assert.equal(action(records).kind,'skip',JSON.stringify(changes));
  }
  for(const changes of [{open_library_edition_id:null},{open_library_edition_id:'OL28347895M'},
    {isbn_13:'9781407470610'},{language:'eng'},{title:'Rendez-vous comic adaptation'}]){
    const works=structuredClone(input.works);Object.assign(works.find(w=>w.id===1078).editions[0],changes);
    assert.equal(action(undefined,works).kind,'skip',JSON.stringify(changes));
  }
  const titlesOnly=input.works.map(w=>({...w,editions:[]}));
  assert.equal(action(undefined,titlesOnly).kind,'skip');
  const duplicate=structuredClone(input.works);
  duplicate.find(w=>w.id===1739).editions=structuredClone(duplicate.find(w=>w.id===1078).editions);
  assert.equal(action(undefined,duplicate).kind,'skip','duplicated edition chain fails closed');
});
test('only LS1000-0728 changes on a full-collision fixture; old frozen artifacts remain verifiable',async()=>{
  const oldPins={...input.pins};delete oldPins['LS1000-0728'];
  const before=buildPlan(input.records,input.works,oldPins),after=buildPlan(input.records,input.works,input.pins);
  assert.deepEqual(before.counts,{link:874,insert:99,skip:27});
  assert.deepEqual(after.counts,{link:875,insert:99,skip:26});
  assert.deepEqual(after.actions.filter((a,i)=>JSON.stringify(a)!==JSON.stringify(before.actions[i])).map(a=>a.candidate_id),['LS1000-0728']);
  const {manifest,manifestSha256}=await reviewedInput();
  const base=new URL('../catalog/selection-v1/',import.meta.url);
  const oldBytes=await fs.readFile(new URL('identity-20261001.manifest.json',base));
  assert.equal(sha256(oldBytes),manifest.previous_manifest_sha256);
  const old=JSON.parse(oldBytes);
  for(const [file,hash] of Object.entries(old.files))assert.equal(sha256(await fs.readFile(new URL(file,base))),hash);
  assert.equal(sha256(await fs.readFile(new URL('identity-pins.json',base))),old.pins_sha256);
  assert.equal(manifest.files[manifest.records_file],old.files[old.records_file]);
  assert.equal(manifest.records_semantic_sha256,digest(input.records));
  assert.equal(input.pins['LS1000-0728'].candidate_hash,digest(input.records[index]));
  assert.match(manifestSha256,/^[a-f0-9]{64}$/);
});
