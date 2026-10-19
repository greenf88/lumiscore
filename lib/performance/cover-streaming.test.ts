import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import type {Book} from '../../app/data/books.ts';
import {clearEditionCoverEvidenceCacheForTests, deferEditionCoverEvidence, withEditionCoverEvidence} from '../books/edition-cover-evidence.ts';

const book:Book={id:'work-1',workId:'1',title:'Verified title',author:'Author',source:'supabase',cover:'orbit',score:8,ratingsCount:4,match:null,editionAvailable:true,editionId:'11',editionLanguage:'eng',strictEditionLanguage:'en',openLibraryEditionId:'OL11M',openLibraryWorkId:'OL1W',coverUrls:[]};
const source={key:'/books/OL11M',title:book.title,works:[{key:'/works/OL1W'}],languages:[{key:'/languages/eng'}],covers:[101]};
test('real card identity, score and actions are available before slow source evidence; same verified cover afterwards',async()=>{
 clearEditionCoverEvidenceCacheForTests();let resolve!:(response:Response)=>void;let calls=0;
 const fetcher:typeof fetch=()=>{calls++;return new Promise(r=>{resolve=r;});};
 const [early]=deferEditionCoverEvidence([book],fetcher);
 assert.equal(calls,1);assert.equal(early.title,book.title);assert.equal(early.workId,book.workId);assert.equal(early.score,8);assert.deepEqual(early.coverUrls,[]);
 let done=false;early.editionCoverUrls!.then(()=>{done=true;});await Promise.resolve();assert.equal(done,false);
 resolve(new Response(JSON.stringify({status:'ok',result:{'/books/OL11M':source}})));
 assert.match((await early.editionCoverUrls!)[0],/\/101-L\.jpg/);
 assert.deepEqual(await early.editionCoverUrls!, (await withEditionCoverEvidence([book],fetcher))[0].coverUrls);
 assert.equal(calls,1,'stream and JSON path share existing source cache, no duplicate fetch');
});
test('source outage keeps real card with neutral cover; wrong-language evidence never appears',async()=>{
 for(const response of [null,{...source,languages:[{key:'/languages/ger'}]},{...source,title:123}]){
  clearEditionCoverEvidenceCacheForTests();
  const [early]=deferEditionCoverEvidence([book],async()=>response ? new Response(JSON.stringify({status:'ok',result:{'/books/OL11M':response}})) : Promise.reject(Error('source unavailable')));
  assert.equal(early.title,book.title);assert.deepEqual(await early.editionCoverUrls!,[]);
 }
});
test('already verified cover does not wait for or query optional external metadata',async()=>{
 clearEditionCoverEvidenceCacheForTests();let calls=0;
 const known={...book,coverUrls:['https://publisher.invalid/reviewed.jpg']};
 const [actual]=await withEditionCoverEvidence([known],async()=>{calls++;throw Error('must not fetch');});
 assert.equal(calls,0);assert.deepEqual(actual.coverUrls,known.coverUrls);
 assert.equal(deferEditionCoverEvidence([known])[0].editionCoverUrls,undefined);
});
test('only SSR page loaders opt in; API and taste storage keep resolved JSON; no shared private cache',async()=>{
 const read=(path:string)=>readFile(new URL('../../'+path,import.meta.url),'utf8');
 const [home,browse,collection,ui,books]=await Promise.all(['app/page.tsx','app/browse/page.tsx','app/collection/[slug]/page.tsx','app/components/LumiScoreHome.tsx','lib/supabase/books.ts'].map(read));
 assert.match(home,/loadHighestRatedCatalog\(8,locale,true\)/);assert.match(browse,/loadEditorialCatalog\(state, locale, true, true\)/);assert.match(collection,/loadCollectionPageData\(slug,locale,true\)/);
 assert.match(ui,/<Suspense fallback=\{initial\}><StreamedBookCover key=\{coverIdentity\}/);
 assert.match(ui,/key=\{getBookCoverIdentity\(book\)\}/);
 assert.match(books,/streamCovers = false/);assert.doesNotMatch(books,/loadStoredCoverResolutionsBatched/);
 assert.doesNotMatch(home+browse+collection,/s-maxage|unstable_cache/);
});
