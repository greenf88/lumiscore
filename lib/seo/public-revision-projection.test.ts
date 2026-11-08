import test from 'node:test';import assert from 'node:assert/strict';import type {Book} from '../../app/data/books.ts';
import {publicBookRevisionHash} from './public-revision-projection.ts';import {verifiedPageLastmod} from './verified-lastmod.ts';import {buildLocalizedSitemap} from './sitemap.ts';
const book={workId:'1',authorId:'2',author:'Verified Author',title:'Verified Title',editionTitle:'Verified Title',editionId:'3',editionLanguage:'eng',strictEditionLanguage:'en',editionAvailable:true,editionFormat:'paperback',coverUrls:['https://example.com/verified.jpg'],storedDescription:{text:'Reviewed text for this specific book, with checked provenance.',source:'official_catalog',sourceName:'Reviewed source',sourceUrl:'https://example.com/source',sourceKey:'https://example.com/source',language:'en',verifiedAt:'2026-11-01'}} as Book;
test('only a complete current reviewed presentation can expose a stable receipt-bound lastmod',()=>{
 const hash=publicBookRevisionHash(book,'en',[])!;assert.match(hash,/^[a-f0-9]{64}$/);
 const revision={currentHash:hash,recordedHash:hash,changedAt:'2026-11-01T12:00:00Z',receiptSha256:'a'.repeat(64)};
 assert.equal(verifiedPageLastmod(revision),'2026-11-01T12:00:00.000Z');
 const xml=buildLocalizedSitemap([{workId:'1',locales:['en']}],[],'en',new Map([['/en/book/1',revision]]));assert.match(xml,/<lastmod>2026-11-01T12:00:00.000Z<\/lastmod>/);
 for(const change of [{title:'Corrected title'},{editionId:'4'},{coverUrls:['https://example.com/new.jpg']},{storedDescription:{...book.storedDescription!,text:'A correction to the reviewed text'}}]){
  assert.notEqual(publicBookRevisionHash({...book,...change},'en',[]),hash);assert.equal(verifiedPageLastmod({...revision,currentHash:publicBookRevisionHash({...book,...change},'en',[])}),null);
 }
 for(const change of [{score:9,ratingBand:'10–19'},{storedDescription:{...book.storedDescription!,verifiedAt:'2026-11-07'}}])assert.equal(publicBookRevisionHash({...book,...change},'en',[]),hash,'ratings/review rechecks do not invent content dates');
 assert.equal(publicBookRevisionHash({...book,storedDescription:undefined},'en',[]),null);assert.equal(publicBookRevisionHash({...book,editionAvailable:false},'en',[]),null);assert.equal(publicBookRevisionHash(book,'nl',[]),null);
 assert.notEqual(publicBookRevisionHash(book,'en',[{slug:'changed-relation'}]),hash);
 const gone={...book,storedDescription:undefined,openLibraryEditionId:'OL3M'};
 const marker={work_id:1,edition_id:3,locale:'en',source_key:'OL3M',provider_status:'withdrawn'};
 const withdrawnHash=publicBookRevisionHash(gone,'en',[],marker);assert.match(withdrawnHash!,/^[a-f0-9]{64}$/);assert.notEqual(withdrawnHash,hash);
 assert.equal(publicBookRevisionHash(gone,'en',[],{...marker,provider_status:'temporary_failure'}),null);
 assert.equal(publicBookRevisionHash(gone,'en',[],{...marker,source_key:'OL4M'}),null);
});
