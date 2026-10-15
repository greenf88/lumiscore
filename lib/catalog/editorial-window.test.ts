import test from 'node:test';
import assert from 'node:assert/strict';
import { browseQuery, editorialQuery, editorialRpcArgs, editorialHref } from './editorial-query.ts';
import { editorialWindow } from './editorial-window.ts';
import { updateBrowseReturnPath, getSafeBrowseReturnPath } from '../navigation/browse-return.ts';

test('Browse defaults to all/highest/16; Search retains az/32; explicit old choices are authoritative', () => {
  assert.deepEqual(browseQuery({}), {...editorialQuery({}), sort:'highest', pageSize:16});
  assert.equal(editorialQuery({}).pageSize,32); assert.equal(editorialQuery({}).sort,'az');
  for(const size of [16,32,64,128]) for(const sort of ['az','highest','newest']) {
    const state=browseQuery({pageSize:String(size),sort});
    assert.equal(state.pageSize,size); assert.equal(state.sort,sort);
    assert.equal(new URL(editorialHref('/browse',state),'https://example.invalid').searchParams.get('sort'),sort);
  }
  assert.equal(browseQuery({q:'author',category:'fiction_fantasy'}).pageSize,16);
  assert.equal(browseQuery({sort:''}).sort,'highest');
  assert.equal(browseQuery({sort:'not-a-sort',pageSize:'999'}).sort,'highest');
  assert.equal(getSafeBrowseReturnPath('/browse?sort=az&pageSize=16'),'/browse?pageSize=16&sort=az');
  assert.equal(updateBrowseReturnPath('/browse?page=5&pageSize=16&sort=az&author=42',{pageSize:64}),'/browse?pageSize=64&sort=az&author=42');
});

test('two 16-result pages split one database-ranked 32-ID window before hydration', () => {
  const ids=Array.from({length:32},(_,i)=>9000+i);
  const pages=[1,2,3,4].map(page=>browseQuery({page:String(page)}));
  assert.deepEqual(pages.map(s=>editorialRpcArgs(s).p_page),[1,1,2,2]);
  assert.ok(pages.every(s=>editorialRpcArgs(s).p_page_size===32));
  const a=editorialWindow(pages[0],{workIds:ids,total:10134,page:1});
  const b=editorialWindow(pages[1],{workIds:ids,total:10134,page:1});
  assert.deepEqual(a.ids,ids.slice(0,16).map(String)); assert.deepEqual(b.ids,ids.slice(16).map(String));
  assert.equal(a.pageCount,634); assert.ok(a.ids.every(id=>!b.ids.includes(id)));
});

test('partial final windows, empty results and huge pages clamp on UI boundaries without duplicates', () => {
  for(const total of [0,1,16,17,31,32,33,48,49,64,65,10134]) {
    const state=browseQuery({page:'999999999999'});
    const pageCount=Math.max(1,Math.ceil(total/16)),rpcPage=Math.ceil(pageCount/2);
    const from=(rpcPage-1)*32;
    const ids=Array.from({length:Math.max(0,total-from)},(_,i)=>from+i+1);
    const window=editorialWindow(state,{total,page:rpcPage,workIds:ids});
    assert.equal(window.page,pageCount); assert.equal(window.pageCount,pageCount);
    assert.deepEqual(window.ids,Array.from({length:Math.max(0,total-(pageCount-1)*16)},(_,i)=>String((pageCount-1)*16+i+1)));
  }
  assert.throws(()=>editorialWindow(browseQuery({}),{workIds:[],total:5,page:2}),/Inconsistent/);
  assert.throws(()=>editorialWindow(browseQuery({}),{workIds:[],total:-1,page:1}),/Invalid/);
});

test('32/64/128 windows and all filter arguments retain the existing database contract', () => {
  for(const pageSize of [32,64,128]) {
    const state=browseQuery({pageSize:String(pageSize),page:'2',author:'42',q:'Title',category:'fiction_fantasy',language:'nl',selection:'lumiscore-selectie-1000',sort:'newest'});
    const args=editorialRpcArgs(state);
    assert.equal(args.p_page_size,pageSize); assert.equal(args.p_page,2);
    assert.deepEqual(args.p_categories,['fiction_fantasy']); assert.deepEqual(args.p_languages,['nl']);
    assert.equal(args.p_selection,'lumiscore-selectie-1000'); assert.equal(args.p_query,'Title');
    assert.equal(args.p_sort,'newest');
    assert.deepEqual(editorialWindow(state,{workIds:[1,2],total:pageSize+2,page:2}),{ids:['1','2'],total:pageSize+2,page:2,pageCount:2});
  }
});
