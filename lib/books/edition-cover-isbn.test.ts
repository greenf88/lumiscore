import assert from 'node:assert/strict';
import test from 'node:test';
import type {Book} from '../../app/data/books.ts';
import {editionSourceCoverUrls} from './edition-cover-evidence.ts';

const book={title:'Macbeth',editionTitle:'Macbeth',editionAvailable:true,editionLanguage:'nld',isbn13:'9789064032295',openLibraryEditionId:'OL34490134M',openLibraryWorkId:'OL258902W'} as Book;
const source={key:'/books/OL34490134M',title:'Macbeth',works:[{key:'/works/OL258902W'}],languages:[{key:'/languages/dut'}],isbn_10:['9064032297'],covers:[12040529]};

test('an exact older Dutch edition can prove its ISBN-13 through valid ISBN-10',()=>{
 assert.deepEqual(editionSourceCoverUrls(book,source),['https://covers.openlibrary.org/b/id/12040529-L.jpg?default=false']);
 assert.deepEqual(editionSourceCoverUrls(book,{...source,isbn_10:['90-6403-229-7']}),editionSourceCoverUrls(book,source));
});
test('ISBN-10 cannot bypass an explicit ISBN-13 conflict, bad checksum or edition/language boundary',()=>{
 for(const change of [
  {isbn_13:['9780373708185']},{isbn_13:['invalid']},{isbn_13:{}},{isbn_10:['9064032298']},
  {isbn_10:['invalid']},{isbn_10:[null,{}]}, {isbn_10:{}},
  {languages:[{key:'/languages/eng'}]},{works:[{key:'/works/OL999W'}]},
  {key:'/books/OL999M'},{title:'Another title'},
 ])assert.deepEqual(editionSourceCoverUrls(book,{...source,...change} as never),[]);
 assert.deepEqual(editionSourceCoverUrls({...book,isbn13:'9789064032296'},source),[]);
 assert.deepEqual(editionSourceCoverUrls({...book,isbn13:'9799064032295'},source),[]);
});
