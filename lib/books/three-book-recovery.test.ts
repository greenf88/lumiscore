import test from 'node:test';
import assert from 'node:assert/strict';
import type {Book} from '../../app/data/books.ts';
import {selectStrictEdition,withStrictEdition,type StrictEditionRow} from './strict-edition.ts';
import {getReviewedCoverOverride} from './reviewed-cover-overrides.ts';
import {applyRatingSummaries,formatPublicRatingDisplay,ratingSummaryMap} from '../ratings/card-summaries.ts';
import {getBookCoverIdentity} from './book-cover-state.ts';
const fixtures = [
  {workId:'114',title:'Where the Crawdads Sing',author:'Delia Owens',openLibraryWorkId:'OL18766691W',editions:[
    {id:114,title:'Where the Crawdads Sing',language:'eng',isbn_13:'9780735219090',open_library_edition_id:'OL26702293M'},
    {id:9001,title:'Daar waar de rivierkreeften zingen',language:'nld',isbn_13:'9789041716149',open_library_edition_id:null}]},
  {workId:'8',title:'Dune',author:'Frank Herbert',openLibraryWorkId:'OL893414W',editions:[
    {id:8,title:'Dune',language:'eng',isbn_13:'9780575073340',open_library_edition_id:'OL7878673M'}]},
  {workId:'1381',title:'Animal Farm',author:'George Orwell',openLibraryWorkId:'OL1168007W',editions:[
    {id:1420,title:'Animal Farm',language:'eng',isbn_13:'9780307261236',open_library_edition_id:'OL10352481M'},
    {id:1421,title:'Dierenboerderij',language:'dut',isbn_13:'9789041330369',open_library_edition_id:'OL18430168M'},
    {id:9002,title:'Animal Farm',language:'eng',isbn_13:'9780451526342',open_library_edition_id:'OL7577246M'}]},
];
test('three reviewed identities: EN NL EN binds one edition and cover; no forced Work exception',()=>{
  for(const f of fixtures) {
    const base:Book={...f,id:'work-'+f.workId,source:'supabase',cover:'orbit',score:null,ratingsCount:null,match:null};
    const editions:StrictEditionRow[]=f.editions.map(e=>({...e,work_id:f.workId}));
    const present=(locale:'nl'|'en')=>withStrictEdition(base,selectStrictEdition(editions,locale,f.title),locale)!;
    const en=present('en'),nl=present('nl'),again=present('en');
    assert.ok(en.coverUrls?.length);assert.ok(nl.coverUrls?.length);
    assert.equal(en.workId,nl.workId);assert.equal(getBookCoverIdentity(en),getBookCoverIdentity(again));
    assert.equal(nl.englishEditionFallback,f.workId==='8');
    if(f.workId==='1381')assert.equal(en.isbn13,'9780451526342','normal stable edition ranking chooses verified printed edition');
    if(f.workId==='114')assert.equal(nl.title,'Daar waar de rivierkreeften zingen');
    for(const b of [en,nl]) {
      const input={...b,isbn13:b.isbn13};
      assert.ok(getReviewedCoverOverride(input));
      for(const delta of [{isbn13:'9781234567897'},{author:'Another author'},{title:'Another translation'},
        {openLibraryWorkId:'OL999999W'},{editionLanguage:'deu'}])assert.equal(getReviewedCoverOverride({...input,...delta}),null);
    }
  }
});
test('Crawdads requires data correction; empty language is never admitted on title or cover evidence',()=>{
  const f=fixtures[0],en=f.editions[0];
  for(const locale of ['nl','en'] as const)assert.equal(selectStrictEdition([{...en,language:null}],locale,f.title),null);
});
test('Dune uses a reviewed exact-volume cover without a live lookup or expiring image token',()=>{
  const f=fixtures[1],e=f.editions[0];
  const cover=getReviewedCoverOverride({...f,...e,workId:f.workId,isbn13:e.isbn_13,editionLanguage:e.language,openLibraryEditionId:e.open_library_edition_id});
  assert.equal(cover?.source,'reviewed_google_books');
  const url=new URL(cover!.coverUrl);
  assert.equal(url.searchParams.get('id'),'deRpPwAACAAJ');
  assert.equal(url.searchParams.has('imgtk'),false);
  assert.equal(getReviewedCoverOverride({...f,workId:f.workId,isbn13:e.isbn_13,editionLanguage:'nld',openLibraryEditionId:e.open_library_edition_id}),null);
});
test('three Work scores and bands have one public presentation across localized list/detail; synthetic only',()=>{
  for(const locale of ['nl','en'] as const)for(const available of [true,false]) {
    const books:Book[]=fixtures.map(f=>({...f,id:'work-'+f.workId,source:'supabase',cover:'orbit',score:null,ratingsCount:null,match:null}));
    const summaries=ratingSummaryMap(books.map((b,i)=>({work_id:b.workId,lumiscore:available?8+i/10:null,
      rating_count_band:available?'3–4':null,evidence_status:available?'available':'insufficient_evidence'})));
    for(const card of applyRatingSummaries(books,summaries)) {
      const detail=summaries.get(card.workId!)!;
      assert.deepEqual(formatPublicRatingDisplay(card.score,null,locale,card.ratingBand),formatPublicRatingDisplay(detail.lumiscore,null,locale,detail.ratingBand));
      assert.equal(card.workId,fixtures.find(f=>f.workId===card.workId)!.workId);
      if(!available)assert.equal(formatPublicRatingDisplay(card.score,null,locale,card.ratingBand).score,'—');
    }
  }
});
