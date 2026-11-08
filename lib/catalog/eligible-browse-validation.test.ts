import assert from 'node:assert/strict';
import test from 'node:test';
import {browseQuery} from './editorial-query.ts';
import {readEligibleBrowsePage} from './eligible-browse.ts';

test('only an explicit numeric zero can confirm a genuinely empty catalog',()=>{
 const state=browseQuery({}),empty={contract:'eligible-browse-v3',locale:'en',pageSize:16,total:0,page:1,pageCount:1,workIds:[]};
 assert.equal(readEligibleBrowsePage(empty,state,'en').total,0);
 for(const value of [null,undefined,'',false,'0'])assert.throws(()=>readEligibleBrowsePage({...empty,total:value},state,'en'),/Invalid/);
 for(const field of ['page','pageCount'])for(const value of [null,undefined,'1',true])
  assert.throws(()=>readEligibleBrowsePage({...empty,[field]:value},state,'en'),/Invalid/);
});
