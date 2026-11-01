import test from 'node:test';
import assert from 'node:assert/strict';
import type { Book } from '../../app/data/books.ts';
import { searchQuery, browseQuery, editorialHref } from './editorial-query.ts';
import { collectSearchIds, searchWindow } from './search-window.ts';
import { selectStrictEdition, withStrictEdition, type StrictEditionRow } from '../books/strict-edition.ts';
import { browseFilterChips } from './browse-controls.ts';
const book = (id: number, title = 'Dune ' + id): Book => ({ id: 'work-' + id, workId: String(id), source: 'supabase',
  title, author: 'Frank Herbert', score: null, match: null, ratingsCount: null, cover: 'orbit' });

test('Search defaults16/relevance; explicit sort and return context roundtrip; Browse unchanged', () => {
  const state = searchQuery({ q: ' Dune ', page: '3', category: 'fiction_fantasy', language: 'en' });
  assert.equal(state.pageSize, 16); assert.equal(state.relevance, true);
  for (const sort of ['az', 'highest', 'newest', 'relevance']) {
    const s = searchQuery({ q: 'Dune', sort, pageSize: '64', page: '3', author: '2' });
    const href = editorialHref('/search', s);
    assert.deepEqual(searchQuery(Object.fromEntries(new URL(href, 'https://lumisco.re').searchParams)), s);
  }
  assert.equal(browseQuery({}).sort, 'highest'); assert.equal(browseQuery({}).pageSize, 16);
  assert.equal(searchQuery({ q: 'Dune', pageSize: '999' }).pageSize, 16);
  const chips = browseFilterChips(state, [], null, 'en', '/search');
  assert.ok(chips.every(c => !c.key.startsWith('q') && c.href.startsWith('/search?')));
});
test('exact title on a later database window ranks first BEFORE pagination; stable pages no duplicates', async () => {
  const ids = await collectSearchIds({ workIds: Array.from({length:128},(_,i)=>i+1),total:150,page:1 },
    async page => ({workIds:Array.from({length:22},(_,i)=>i+129),total:150,page}));
  assert.equal(ids.length,150);
  const rows = ids.map(id => book(Number(id), id === '149' ? 'Dune' : 'Children of Dune ' + id));
  const state = searchQuery({q:'Dune'});
  const first=searchWindow(rows,state),second=searchWindow(rows,{...state,page:2});
  assert.equal(first.books[0].workId,'149');assert.equal(first.books.length,16);assert.equal(first.total,150);
  assert.ok(second.books.every(b=>!first.books.some(a=>a.workId===b.workId)));
  assert.equal(searchWindow(rows,{...state,page:999}).page,10);
});
test('strict language/identity eligibility precedes count and paging; neutral cover remains eligible', () => {
  const editions: StrictEditionRow[] = [
    {id:1,work_id:1,title:'Duin',language:'nld',isbn_13:null,open_library_edition_id:null},
    {id:2,work_id:1,title:'Dune',language:'eng',isbn_13:null,open_library_edition_id:null},
    {id:3,work_id:2,title:'Dune Messiah',language:'eng',isbn_13:null,open_library_edition_id:null},
    {id:4,work_id:3,title:'Dune',language:'deu',isbn_13:null,open_library_edition_id:null},
    {id:5,work_id:4,title:'Dune',language:null,isbn_13:null,open_library_edition_id:null},
  ];
  for(const locale of ['nl','en'] as const){
    const rows=[1,2,3,4].flatMap(id=>{const b=book(id),e=selectStrictEdition(editions.filter(e=>e.work_id===id),locale,b.title);
      const result=withStrictEdition(b,e,locale);return result?[result]:[]});
    const result=searchWindow(rows,searchQuery({q:'Dune'}),new Map([['1',['Dune']]]));
    assert.equal(result.total,locale==='nl'?1:2);assert.deepEqual(result.books.map(b=>b.workId),locale==='nl'?['1']:['1','2']);
    assert.equal(result.books[0].title,locale==='nl'?'Duin':'Dune');assert.deepEqual(result.books[0].coverUrls,[]);
  }
});
test('one ID request for six results; no silent incomplete windows or broad-search truncation', async () => {
  let calls=0;
  assert.equal((await collectSearchIds({workIds:[1,2,3,4,5,6],total:6,page:1},async()=>{calls++;throw Error('unexpected')})).length,6);
  assert.equal(calls,0);
  await assert.rejects(()=>collectSearchIds({workIds:[1],total:2,page:1},async()=>{throw Error()}),/Incomplete/);
  await assert.rejects(()=>collectSearchIds({workIds:[],total:10001,page:1},async()=>{throw Error()}),/narrow/);
});
