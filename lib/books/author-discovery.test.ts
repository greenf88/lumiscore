import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createAuthorBookLinksLoader, sameAuthorBookLinks, type AuthorDiscoveryBook } from './author-discovery.ts';
import type { Locale } from '../i18n/config.ts';

const book=(workId:string,locale:Locale='en',authorId='7'):AuthorDiscoveryBook=>({
  workId,authorId,title:`Book ${workId}`,author:`Author ${authorId}`,openLibraryWorkId:`OL${workId}W`,
  editionAvailable:true,editionLanguage:locale==='nl'?'nld':'eng',strictEditionLanguage:locale,
});
const page=(locale:Locale='en',ids=['1','2','3','4','5'])=>({contract:'eligible-browse-v3',locale,workIds:ids,total:ids.length,page:1,pageCount:1,pageSize:16});

test('same-author links exclude self, duplicate Work/source identities, wrong author and ineligible editions',()=>{
  const current=book('1');
  const candidates=[current,{...book('10'),openLibraryWorkId:current.openLibraryWorkId},book('2'),book('2'),
    book('3','en','8'),{...book('4'),editionAvailable:false},book('5','nl'),
    {...book('6'),editionLanguage:null},{...book('7'),title:' '},book('8'),book('9'),book('11')];
  assert.deepEqual(sameAuthorBookLinks(current,candidates,'en'),[
    {workId:'2',title:'Book 2',author:'Author 7'},
    {workId:'8',title:'Book 8',author:'Author 7'},
    {workId:'9',title:'Book 9',author:'Author 7'},
  ]);
  assert.deepEqual(sameAuthorBookLinks(current,candidates,'nl'),[]);
  assert.deepEqual(sameAuthorBookLinks({...current,authorId:null},candidates,'en'),[]);
  assert.deepEqual(sameAuthorBookLinks({...current,editionAvailable:false},candidates,'en'),[]);
  assert.deepEqual(sameAuthorBookLinks(current,[book('0'),book('9007199254740993'),book('../2')],'en'),[]);
});

test('loader scopes one eligible query, hydrates four, coalesces identical reads and isolates different Work windows',async()=>{
  let reads=0,hydrations=0,release:()=>void=()=>{};
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const load=createAuthorBookLinksLoader({
    async readPage(args,signal){
      reads++;assert.equal(args.p_author_id,7);assert.equal(args.p_locale,'en');assert.equal(args.p_page,1);
      assert.equal(args.p_page_size,16);assert.equal(args.p_sort,'az');assert.deepEqual(args.p_categories,[]);
      assert.equal(signal.aborted,false);await gate;return page();
    },
    async readBooks(ids,locale,signal){hydrations++;assert.equal(ids.length,4);assert.equal(locale,'en');assert.equal(signal.aborted,false);
      return [...ids].reverse().map(id=>book(id)).concat(book('999'));},
  });
  const first=load(book('1'),'en'),same=load(book('1'),'en'),other=load(book('2'),'en');
  release();
  assert.deepEqual((await first).map(x=>x.workId),['2','3','4']);
  assert.deepEqual((await same).map(x=>x.workId),['2','3','4']);
  assert.deepEqual((await other).map(x=>x.workId),['3','4','5']);
  assert.deepEqual((await load(book('1'),'en')).map(x=>x.workId),['2','3','4']);
  assert.equal(reads,2);assert.equal(hydrations,2);
});

test('positions five, ten, fifteen and sixteen receive circular neighbours without increasing the eligible page or hydration limit',async()=>{
  const ids=Array.from({length:16},(_,i)=>String(i+1));
  let hydrated:string[]=[];
  const load=createAuthorBookLinksLoader({
    async readPage(args){assert.equal(args.p_page_size,16);assert.equal(args.p_page,1);return page('en',ids);},
    async readBooks(selected){hydrated=[...selected];return selected.map(id=>book(id));},
  });
  for(const [current,expected] of [['5',['5','6','7','8']],['10',['10','11','12','13']],
    ['15',['15','16','1','2']],['16',['16','1','2','3']]] as const){
    assert.deepEqual((await load(book(current),'en')).map(x=>x.workId),expected.slice(1));
    assert.deepEqual(hydrated,expected);
  }
  assert.deepEqual((await load(book('42'),'en')).map(x=>x.workId),['1','2','3']);
  assert.deepEqual(hydrated,['1','2','3','4'],'a Work outside the first page keeps a bounded fallback');
});

test('cache separates author and locale, expires, and successful empty selection replaces old links',async()=>{
  let now=0,reads=0,empty=false;
  const load=createAuthorBookLinksLoader({
    async readPage(args){reads++;return page(args.p_locale,empty?[]:['1','2']);},
    async readBooks(ids,locale){return ids.map(id=>book(id,locale));},
  },()=>now);
  assert.equal((await load(book('1'),'en')).length,1);
  assert.equal((await load(book('1'),'en')).length,1);assert.equal(reads,1);
  assert.equal((await load(book('1','nl'),'nl')).length,1);assert.equal(reads,2);
  await load(book('1','en','8'),'en');assert.equal(reads,3);
  now=15001;empty=true;
  assert.deepEqual(await load(book('1'),'en'),[]);assert.equal(reads,4);
  assert.deepEqual(await load(book('1'),'en'),[]);assert.equal(reads,4);
});

test('absent identities and unavailable source editions never issue a catalogue query',async()=>{
  const unexpected=async()=>{assert.fail('unexpected query');};
  const load=createAuthorBookLinksLoader({readPage:unexpected,readBooks:unexpected});
  for(const candidate of [{...book('1'),authorId:null},{...book('1'),authorId:'0'},
    {...book('1'),workId:'bad'}, {...book('1'),editionAvailable:false},book('1','nl')]) {
    assert.deepEqual(await load(candidate,'en'),[]);
  }
});

test('failure and invalid eligibility contracts are isolated, retried on the next request, and never reuse expired links',async()=>{
  let now=0,mode='good',hydrations=0;
  const load=createAuthorBookLinksLoader({
    async readPage(){if(mode==='error')throw Error('DB unavailable');return mode==='wrong-locale'?page('nl'):mode==='duplicates'?page('en',['1','1']):page();},
    async readBooks(ids,locale){hydrations++;if(mode==='hydrate-error')throw Error('Edition unavailable');return ids.map(id=>book(id,locale));},
  },()=>now);
  assert.equal((await load(book('1'),'en')).length,3);
  now=16000;
  for(const failure of ['error','wrong-locale','duplicates','hydrate-error']){mode=failure;assert.deepEqual(await load(book('1'),'en'),[]);}
  assert.equal(hydrations,2,'invalid selection cannot request identities');
  mode='good';assert.equal((await load(book('1'),'en')).length,3);
});

test('entire optional discovery read has a deadline even when an upstream ignores its abort signal',async()=>{
  let signal:AbortSignal|undefined;
  const load=createAuthorBookLinksLoader({
    readPage:async(_args,s)=>{signal=s;await delay(50);return page();},
    async readBooks(){assert.fail('timed out selection cannot hydrate');},
  },Date.now,20);
  // Keep a real timer active: AbortSignal.timeout intentionally unrefs its timer.
  const [links]=await Promise.all([load(book('1'),'en'),delay(65)]);
  assert.deepEqual(links,[]);assert.equal(signal?.aborted,true);
});

test('public identity cache evicts older windows at its fixed capacity',async()=>{
  let reads=0;
  const load=createAuthorBookLinksLoader({async readPage(){reads++;return page('en',[]);},async readBooks(){assert.fail('empty selection');}});
  for(let id=1;id<=101;id++)await load(book('1','en',String(id)),'en');
  await load(book('1','en','101'),'en');assert.equal(reads,101);
  await load(book('1','en','1'),'en');assert.equal(reads,102);
});
