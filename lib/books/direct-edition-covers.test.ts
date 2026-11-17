import test from 'node:test';
import assert from 'node:assert/strict';
import {createDirectEditionCoverResolver} from './direct-edition-covers.ts';
import type {Book} from '../../app/data/books.ts';
const book=(id:number)=>({workId:String(id),editionAvailable:true,openLibraryEditionId:`OL${id}M`,openLibraryWorkId:`OL${id}W`,editionLanguage:'eng',title:`Book ${id}`,isbn13:'9780544003415',coverUrls:[]} as unknown as Book);
const source=(id:number)=>({key:`/books/OL${id}M`,works:[{key:`/works/OL${id}W`}],languages:[{key:'/languages/eng'}],title:`Book ${id}`,isbn_13:['9780544003415'],covers:[14617723]});
test('direct edition evidence is bounded, coalesced, cached and tied to exact identity',async()=>{
 let active=0,max=0,calls=0;
 const resolve=createDirectEditionCoverResolver((async url=>{
   assert.match(String(url),/^https:\/\/openlibrary.org\/books\/OL\d+M.json$/);
   calls++;active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;
   return Response.json(source(Number(String(url).match(/OL(\d+)M/)![1])));
 }) as typeof fetch);
 const [rows,duplicate]=await Promise.all([resolve(Array.from({length:9},(_,i)=>book(i+1))),resolve([book(1)])]);
 assert.equal(calls,9);assert.equal(max,4);assert.equal(rows.filter(b=>b.coverUrls?.length).length,9);assert.equal(duplicate[0].coverUrls?.length,1);
 const mismatch=await resolve([{...book(1),editionLanguage:'dut'}, {...book(1),title:'Different title'}, {...book(1),openLibraryWorkId:'OL99W'}, {...book(1),isbn13:'9780261103344'}]);
 assert.ok(mismatch.every(b=>b.coverUrls?.length===0));assert.equal(calls,9);
});
test('source failure does not reject the books or retry on every render; stored covers need no request',async()=>{
 let calls=0;const resolve=createDirectEditionCoverResolver((async()=>{calls++;throw Error('source unavailable');}) as typeof fetch);
 assert.deepEqual((await resolve([book(1)]))[0].coverUrls,[]);
 await resolve([book(1)]);assert.equal(calls,1);
 const stored={...book(2),coverUrls:['https://covers.openlibrary.org/b/id/14617723-L.jpg']};
 assert.equal((await resolve([stored]))[0],stored);assert.equal(calls,1);
});
