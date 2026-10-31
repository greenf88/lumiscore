import test from 'node:test';
import assert from 'node:assert/strict';
import {applyStoredPresentation,safePublicSource,type StoredDescription} from './stored-presentation.ts';
import {loadPublicBookDescriptionState} from './public-description.ts';
import type {Book} from '../../app/data/books.ts';

test('reviewed exact Google volume URL survives storage mapping without an external description fetch',async()=>{
 const url='https://books.google.com/books/about/Ghosts_in_the_Gallery.html?id=5hUViLO4kWgC';
 const row:StoredDescription={work_id:8665,bound_author_id:5183,language:'en',text:'Jenny arrives at her grandfather’s house, where nobody recognises her. She works as a maid while investigating what happened.',source_type:'official_catalog',source_name:'Google Books',source_url:url,reviewed_at:'2026-10-31',review_status:'approved'};
 const book={id:'8665',workId:'8665',authorId:'5183',title:'Ghosts in the gallery',author:'Barbara Brooks Wallace',editionAvailable:true,editionId:'8824',editionTitle:'Ghosts in the gallery',editionLanguage:'eng',isbn13:'9780439352901'} as Book;
 const selected=applyStoredPresentation([book],'en',[row],[])[0];
 assert.equal(selected.storedDescription?.sourceUrl,url);
 let requests=0;const result=await loadPublicBookDescriptionState(selected,'en',async()=>{requests++;throw Error('Should not fetch a provider');});
 assert.equal(result.description?.text,row.text);assert.equal(requests,0);
 assert.equal(applyStoredPresentation([book],'nl',[row],[])[0].storedDescription,undefined);
});

test('source URL validation permits only a single bounded Google volume identifier, not arbitrary query values',()=>{
 for(const url of ['https://books.google.com/books?id=5hUViLO4kWgC','https://books.google.nl/books/about/Ghosts.html?id=5hUViLO4kWgC','https://openlibrary.org/books/OL26336428M'])assert.equal(safePublicSource(url),true,url);
 for(const url of ['https://books.google.com/books?id=abc','https://books.google.com/books?id=5hUViLO4kWgC&id=otherbook','https://books.google.com/books?id=5hUViLO4kWgC&token=private','https://books.google.com/books?q=private+query','https://books.google.com/books?id=private%40example.org','https://books.google.com/redirect?id=5hUViLO4kWgC','https://untrusted.example/books?id=5hUViLO4kWgC','https://books.google.com/books?id=5hUViLO4kWgC#token','https://name:secret@books.google.com/books?id=5hUViLO4kWgC'])assert.equal(safePublicSource(url),false,url);
});
