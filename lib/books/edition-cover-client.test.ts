import test from 'node:test';import assert from 'node:assert/strict';
import {coverUrlsForEdition} from './edition-cover-client.ts';import type {Book} from '../../app/data/books.ts';
test('late cover response cannot substitute a different edition, work or unsafe URL',()=>{
 const book={workId:'1',editionId:'en-1'} as Book;
 assert.deepEqual(coverUrlsForEdition(book,[{workId:'1',editionId:'nl-1',urls:['https://cover/nl']}]),[]);
 assert.deepEqual(coverUrlsForEdition(book,[{workId:'2',editionId:'en-1',urls:['https://cover/en']}]),[]);
 assert.deepEqual(coverUrlsForEdition(book,[{workId:'1',editionId:'en-1',urls:['javascript:bad','https://cover/en']}]),['https://cover/en']);
});
