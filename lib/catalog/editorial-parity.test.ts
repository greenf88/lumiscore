import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Book} from '../../app/data/books.ts';
import {loadPublicRatingSummaries} from '../supabase/public-rating-summaries.ts';
import {applyRatingSummaries,formatPublicRatingDisplay} from '../ratings/card-summaries.ts';
import {selectStrictEdition,withStrictEdition,unavailableEdition} from '../books/strict-edition.ts';
import {getVerifiedCoverAttempts} from '../books/covers.ts';
import {withEditionCoverEvidence,clearEditionCoverEvidenceCacheForTests} from '../books/edition-cover-evidence.ts';
import {REVIEWED_COVER_OVERRIDES} from '../books/reviewed-cover-overrides.ts';
const read=(path:string)=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const base:Book={id:'work-102',workId:'102',source:'supabase',title:'The Hunger Games',author:'Suzanne Collins',firstPublishYear:2008,score:null,ratingsCount:null,match:null,cover:'orbit'};

test('one central batch gives list and detail exactly the same rounded public status; no individual ratings',async()=>{
  let calls=0;
  const client={rpc:async(name:string,args:unknown)=>{
    calls++;assert.equal(name,'get_work_rating_summaries_v2');assert.deepEqual(args,{target_work_ids:[102,208]});
    return {data:[{work_id:102,lumiscore:'8.85',rating_count_band:'5–9',evidence_status:'available'},{work_id:208,lumiscore:null,rating_count_band:null,evidence_status:'insufficient_evidence'}],error:null};
  }} as unknown as SupabaseClient;
  const summaries=await loadPublicRatingSummaries(client,['102','208','102']);
  const card=applyRatingSummaries([base],summaries)[0];
  const detail=summaries.get('102')!;
  assert.equal(calls,1);assert.equal(card.score,8.9);
  assert.deepEqual(formatPublicRatingDisplay(card.score,null,'nl',card.ratingBand),formatPublicRatingDisplay(detail.lumiscore,null,'nl',detail.ratingBand));
  assert.equal(formatPublicRatingDisplay(null,null,'en',summaries.get('208')?.ratingBand).count,'Insufficient ratings');
  assert.match(read('lib/supabase/ratings.ts'),/loadPublicRatingSummaries\(supabase, \[workId\]\)/);
});
test('RPC rejection, missing row and transport failure are unavailable, not zero evidence',async()=>{
  for(const response of [{data:null,error:{message:'unavailable'}},{data:[],error:null},{data:[{work_id:102,lumiscore:null,evidence_status:'unknown'}],error:null},{data:[{work_id:102,lumiscore:9,rating_count_band:'invalid',evidence_status:'available'}],error:null},'throw']){
    const client={rpc:async()=>{if(response==='throw')throw Error('network');return response;}} as unknown as SupabaseClient;
    const [book]=applyRatingSummaries([base],await loadPublicRatingSummaries(client,['102']));
    assert.equal(book.publicRatingUnavailable,true);assert.equal(book.score,null);
    for(const locale of ['en','nl'] as const) assert.match(formatPublicRatingDisplay(book.score,null,locale,book.ratingBand,book.publicRatingUnavailable).count,/temporarily|tijdelijk/);
  }
});
test('unavailable edition retains Work identity and year, but cannot expose another language or cover',()=>{
  const book=unavailableEdition({...base,editionId:'bad',isbn13:'9780000000000',coverUrls:['https://example.test/foreign.jpg']},'nl');
  assert.equal(book.title,base.title);assert.equal(book.author,base.author);assert.equal(book.firstPublishYear,2008);
  assert.equal(book.editionAvailable,false);assert.deepEqual(book.coverUrls,[]);assert.equal(book.isbn13,null);
  for(const language of [null,'ger','fre','eng,fre'])assert.equal(selectStrictEdition([{id:1,title:base.title,language,isbn_13:null,open_library_edition_id:null}],'en',base.title),null);
});
test('editorial loader reuses exact edition mapper and public summaries, preserves order and streams optional covers',()=>{
  const page=read('app/toplijsten/[slug]/page.tsx'),client=read('app/components/EditorialTopList.tsx');
  assert.match(page,/loadCatalogBooksBySourceIds\(list.workIds.map\(getEditorialWorkSourceId\), locale\)/);
  assert.match(page,/deferEditionCoverEvidence\(books\)/);
  assert.match(client,/list.workIds.map/);assert.match(client,/books.find\(book => book.openLibraryWorkId === choice.sourceId\)/);
  assert.match(page,/topListBookHref\(book.workId,list.slug\)/);
  assert.doesNotMatch(client,/import \{.*editorialTopLists|import .*campaigns.*json/);
  assert.doesNotMatch(client,/topListBook\(/);assert.doesNotMatch(read('lib/catalog/top-lists.ts'),/score:|coverUrls:/);
  assert.match(read('lib/supabase/books.ts'),/\[result, editions, summaries\] = await Promise.all/);
  const en={id:1319,work_id:102,title:base.title,language:'eng',isbn_13:'9780439023481',open_library_edition_id:'OL22549594M'};
  const nl={...en,id:1320,title:'De Hongerspelen',language:'dut',isbn_13:'9789000399284',open_library_edition_id:'OL60075974M'};
  for(const locale of ['en','nl'] as const){
    const present=()=>withStrictEdition(base,selectStrictEdition([en,nl],locale,base.title),locale)!;
    assert.deepEqual(present(),present());assert.equal(present().editionId,locale==='nl'?'1320':'1319');
  }
});
test('failed large/density image recovers via M of the exact same verified ID, bounded; no foreign lookup',()=>{
  const url='https://covers.openlibrary.org/b/id/7890713-L.jpg?default=false';
  const detail=getVerifiedCoverAttempts(url,'detail');
  assert.equal(detail[0].src,url);assert.equal(detail[1].src,url.replace('-L.','-M.'));
  assert.equal(detail[1].srcSet,undefined);assert.ok(detail.length<=4);
  for(const presentation of ['compact','card','taste','detail'] as const){
    const attempts=getVerifiedCoverAttempts(url,presentation);
    assert.ok(attempts.some(a=>a.src.endsWith('-M.jpg?default=false')&&!a.srcSet));
    assert.ok(attempts.every(a=>a.src.includes('/id/7890713-')));
    assert.equal(new Set(attempts.map(a=>a.src+'|'+a.srcSet)).size,attempts.length);
  }
  assert.equal(getVerifiedCoverAttempts('https://publisher.example/verified.jpg','detail').length,1);
});
test('temporary missing edition source is retried after one minute, not cached for a day',async()=>{
  clearEditionCoverEvidenceCacheForTests();
  const original=Date.now;let now=original(),calls=0;
  Date.now=()=>now;
  const book=withStrictEdition({...base,workId:'700001',openLibraryWorkId:'OL700001W'},{id:1319,work_id:700001,title:base.title,language:'eng',isbn_13:'9780439023481',open_library_edition_id:'OL22549594M'},'en')!;
  const fetcher:typeof fetch=async()=>{calls++;return new Response(JSON.stringify({status:'ok',result:calls===1?{}:{'/books/OL22549594M':{key:'/books/OL22549594M',title:base.title,languages:[{key:'/languages/eng'}],works:[{key:'/works/OL700001W'}],isbn_13:['9780439023481'],covers:[7890713]}}}));};
  try{
    assert.equal((await withEditionCoverEvidence([book],fetcher))[0].coverUrls?.length,0);
    now+=61_000;
    assert.equal((await withEditionCoverEvidence([book],fetcher))[0].coverUrls?.length,1);
    assert.equal(calls,2);
  }finally{Date.now=original;clearEditionCoverEvidenceCacheForTests();}
});
test('reviewed positive edition covers need no external metadata call on a cold render',async()=>{
  clearEditionCoverEvidenceCacheForTests();
  const books=REVIEWED_COVER_OVERRIDES.filter(entry=>entry.source==='reviewed_open_library').map(entry=>withStrictEdition({...base,workId:entry.workId,openLibraryWorkId:entry.openLibraryWorkId,title:entry.title,author:entry.author},{id:entry.openLibraryEditionId!,work_id:entry.workId,title:entry.title,language:entry.editionLanguage!,isbn_13:entry.isbn13,open_library_edition_id:entry.openLibraryEditionId!},entry.editionLanguage==='nld'?'nl':'en')!);
  let calls=0;
  const resolved=await withEditionCoverEvidence(books,async()=>{calls++;throw Error('No runtime source dependency expected');});
  assert.equal(resolved.length,books.length);assert.ok(resolved.length>=13);assert.equal(calls,0);assert.ok(resolved.every(book=>book.coverUrls?.length===1));
});
