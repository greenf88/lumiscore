import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {Book} from '../../app/data/books.ts';
import {selectStrictEdition,withStrictEdition,unavailableEdition,type StrictEditionRow} from './strict-edition.ts';
import {withEditionCoverEvidence,clearEditionCoverEvidenceCacheForTests,editionSourceCoverUrls} from './edition-cover-evidence.ts';
import {getBookCoverIdentity} from './book-cover-state.ts';
import {resolveBookDescription,clearBookDescriptionCacheForTests} from './description-resolution.ts';
const base:Book={id:'work-1456',workId:'1456',source:'supabase',openLibraryWorkId:'OL17641518W',title:'ההיסטוריה של המחר',author:'Yuval Noah Harari',cover:'orbit',score:null,ratingsCount:null,match:null};
const en:StrictEditionRow={id:1523,work_id:1456,title:'Homo Deus',language:'eng',isbn_13:'9781910701874',open_library_edition_id:'OL26326058M'};

test('resumed rounds retain stored selection language while presentation/search/caches follow UI locale',()=>{
 const read=(path:string)=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
 const round=read('app/api/taste-test/rounds/route.ts'),ui=read('app/components/RatingTasteTest.tsx');
 assert.match(round,/state\.round\?\.language \?\? locale/);
 assert.match(round,/loadTasteEligibility\(client, ids, language\)/);
 assert.match(round,/loadCatalogBooksByIdsWithStoredCovers\(ids, undefined, locale\)/);
 assert.match(ui,/b\.strictEditionLanguage === locale/);
 assert.match(read('app/collection/[slug]/rate/page.tsx'),/CollectionQuickRating key=\{locale\}/);
 assert.match(read('app/taste-test/preferences/page.tsx'),/loadCatalogBooksByIdsWithStoredCovers\(TASTE_TEST_WORK_IDS,undefined,locale\)/);
 assert.match(read('app/components/LumiScoreHome.tsx'),/\$\{locale\}:\$\{normalizedQuery\.toLocaleLowerCase/);
 const css=read('app/globals.css');
 assert.match(css,/\.taste-direct-test \.taste-book-identity \.book-cover \{ width: clamp\([^\n]+height: auto; aspect-ratio: \.66; max-width: 35%/);
});
test('real Homo Deus identity: official EN title, NL labelled EN fallback; Work rating key unchanged',()=>{
 const english=withStrictEdition(base,selectStrictEdition([en],'en',base.title),'en')!,dutch=withStrictEdition(base,selectStrictEdition([en],'nl',base.title),'nl')!;
 assert.equal(english.title,'Homo Deus');assert.equal(dutch.title,'Homo Deus');assert.equal(dutch.englishEditionFallback,true);assert.equal(english.englishEditionFallback,false);
 assert.equal(english.workId,dutch.workId);assert.equal(english.editionId,'1523');assert.equal(english.isbn13,en.isbn_13);
});
test('real Da Costa translation is one edition/title/ISBN, not French Work title',()=>{
 const book={...base,workId:'1342',title:'Je revenais des autres',author:'Mélissa Da Costa',openLibraryWorkId:'OL24343547W'};
 const edition={...en,id:1367,work_id:1342,title:'Waar de zon de sneeuw raakt',language:'dut',isbn_13:'9789022341674',open_library_edition_id:'OL61048815M'};
 assert.equal(withStrictEdition(book,selectStrictEdition([edition],'nl',book.title),'nl')!.title,edition.title);
 assert.equal(selectStrictEdition([edition],'en',book.title),null);
});
test('Grunberg data correction is required: verified German edition excluded; no title/script/prefix heuristic',()=>{
 const german={...en,id:1462,work_id:1410,title:'Der Mann, der nie krank war',language:'ger',isbn_13:'9783462046601',open_library_edition_id:'OL28188774M'};
 assert.equal(selectStrictEdition([german],'nl','De man zonder ziekte'),null);assert.equal(selectStrictEdition([german],'en','De man zonder ziekte'),null);
 // Current catalog AND OL have the erroneous dut label. Code must not pretend
 // it can deduce German from title words. Correction stays a separate proposal.
 assert.ok(selectStrictEdition([{...german,language:'dut'}],'nl','De man zonder ziekte'));
});
test('NL always prefers NL over better-equipped EN; official foreign words in EN title remain permitted',()=>{
 const nl={...en,id:3,language:'nld',title:'Nederlandse titel',isbn_13:null};
 assert.equal(selectStrictEdition([en,nl],'nl',base.title)?.id,3);
 assert.ok(selectStrictEdition([{...en,title:'Les Misérables'}],'en',base.title));
 for(const language of ['fre','deu','spa','heb',null,'und','eng,fre'])assert.equal(selectStrictEdition([{...en,language}],'en',base.title),null);
});
test('right edition without cover: no ISBN guess, old Work/ISBN cache or image from other edition',()=>{
 const book=withStrictEdition({...base,coverUrls:['https://example.invalid/hebrew.jpg']},en,'en',[
 {state:'resolved',source_key:'OL17641518W',cover_url:'https://example.invalid/work.jpg'},
 {state:'resolved',source_key:en.isbn_13!,cover_url:'https://example.invalid/isbn.jpg'},
 {state:'resolved',source_key:'OL26326058M',cover_url:'https://example.invalid/unproven.jpg'}])!;
 assert.deepEqual(book.coverUrls,[]);assert.equal(unavailableEdition(base,'en').editionAvailable,false);
});
test('cover evidence batch binds exact Work/edition/title/language/ISBN; no cross-language cache bleed',async()=>{
 clearEditionCoverEvidenceCacheForTests();let calls=0;
 const source={key:'/books/OL26326058M',title:'Homo Deus',works:[{key:'/works/OL17641518W'}],languages:[{key:'/languages/eng'}],isbn_13:['9781910701874'],covers:[8001570]};
 const fetcher:typeof fetch=async input=>{calls++;assert.equal(new URL(String(input)).pathname,'/api/get_many');return new Response(JSON.stringify({status:'ok',result:{'/books/OL26326058M':source}}));};
 const english=withStrictEdition(base,en,'en')!,nlFallback=withStrictEdition(base,en,'nl')!;
 const [a,b]=await Promise.all([withEditionCoverEvidence([english],fetcher),withEditionCoverEvidence([nlFallback],fetcher)]);
 assert.equal(calls,1);assert.equal(a[0].coverUrls!.length,1);assert.deepEqual(a[0].coverUrls,b[0].coverUrls);
 for(const change of [{works:[{key:'/works/OL999W'}]},{languages:[{key:'/languages/heb'}]},{languages:[]},{isbn_13:['9783462046601']},{title:'Different translation'},{covers:[]}])assert.deepEqual(editionSourceCoverUrls(english,{...source,...change}),[]);
 assert.notEqual(getBookCoverIdentity(a[0]),getBookCoverIdentity(b[0]));
 assert.equal(getBookCoverIdentity(a[0]),getBookCoverIdentity((await withEditionCoverEvidence([english],fetcher))[0]));
});
test('EN→NL→EN identity and ratings stay Work-scoped; cross-Work edition rejected',()=>{
 const nl={...en,id:4,title:'Homo Deus Nederlands',language:'dut',open_library_edition_id:null};
 const present=(language:'nl'|'en')=>withStrictEdition(base,selectStrictEdition([nl,en],language,base.title),language)!;
 const a=present('en'),b=present('nl'),c=present('en');
 assert.equal(a.workId,b.workId);assert.equal(a.workId,c.workId);assert.equal(getBookCoverIdentity(a),getBookCoverIdentity(c));assert.notEqual(getBookCoverIdentity(a),getBookCoverIdentity(b));
 assert.equal(withStrictEdition(base,{...en,work_id:999},'en'),null);
});
test('description needs exact edition and language; NL English fallback is explicit, caches include Work',async()=>{
 clearBookDescriptionCacheForTests();
 const fetcher:typeof fetch=async()=>new Response(JSON.stringify({works:[{key:'/works/OL17641518W'}],languages:[{key:'/languages/eng'}],description:'Synthetic English copy.'}));
 const lookup={openLibraryWorkId:'OL17641518W',openLibraryEditionId:'OL26326058M',editionLanguage:'eng'};
 assert.equal((await resolveBookDescription({...lookup,locale:'nl'},fetcher)).description?.language,'en');
 assert.equal((await resolveBookDescription({...lookup,openLibraryWorkId:'OL999W',locale:'en'},fetcher)).description,null);
 clearBookDescriptionCacheForTests();
 for(const languages of [[],[{key:'/languages/ger'}],[{key:'/languages/eng'},{key:'/languages/fre'}]]){
  assert.equal((await resolveBookDescription({...lookup,locale:'en'},async()=>new Response(JSON.stringify({works:[{key:'/works/OL17641518W'}],languages,description:'Uncertain copy.'})))).description,null);
  clearBookDescriptionCacheForTests();
 }
});
