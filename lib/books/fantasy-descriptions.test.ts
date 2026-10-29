import assert from 'node:assert/strict';
import test from 'node:test';
import type {Book} from '../../app/data/books.ts';
import {REVIEWED_FANTASY_DESCRIPTIONS} from './reviewed-fantasy-descriptions.ts';
import {getReviewedDescription} from './reviewed-descriptions.ts';
import {loadPublicBookDescriptionState} from './public-description.ts';
import {publicDescriptionSource} from './description-source.ts';
import {clearBookDescriptionCacheForTests,resolveBookDescription} from './description-resolution.ts';
import {normalizeBookDescription} from './description-text.ts';

test('physical extent is not presented as narrative copy',()=>{
  for(const text of ['152 pages ; 21 cm','320 p.; 20 cm','xii, 152 pages'])
    assert.equal(normalizeBookDescription(text),null);
  assert.equal(normalizeBookDescription('152 pages of a diary are missing.'),'152 pages of a diary are missing.');
});

for(const row of REVIEWED_FANTASY_DESCRIPTIONS){
  const book={workId:'999999',editionId:'888888',editionTitle:row.title,title:row.title,
    author:row.author,isbn13:row.isbn13,openLibraryWorkId:row.openLibraryWorkId,
    openLibraryEditionId:row.openLibraryEditionId,editionLanguage:'eng',editionAvailable:true} as Book;
  test(`${row.title}: durable reviewed synopsis survives cold sources, reload and NL fallback`,async()=>{
    let requests=0;const fail:typeof fetch=async()=>{requests++;throw Error('Source outage');};
    for(const locale of ['en','nl'] as const){
      for(let cold=0;cold<2;cold++){
        clearBookDescriptionCacheForTests();
        const result=await loadPublicBookDescriptionState({...book,englishEditionFallback:locale==='nl'},locale,fail);
        assert.equal(result.state,'resolved');assert.equal(result.description?.text,row.text);
        assert.equal(result.description?.language,'en');assert.equal(result.description?.verifiedAt,'2026-10-29');
        assert.deepEqual(publicDescriptionSource(result.description!),{name:'Open Library',href:row.sourceUrl});
      }
    }
    assert.equal(requests,0,'versioned public summary does not depend on instance or upstream cache');
  });
  test(`${row.title}: identity and language checks cannot be bypassed`,async()=>{
    const lookup={...book};
    assert.ok(getReviewedDescription(lookup,'en'));
    for(const patch of [{editionTitle:'Other book'},{author:'Other author'},{isbn13:'9780441172719'},
      {openLibraryWorkId:'OL999999W'},{openLibraryEditionId:'OL999999M'},{editionLanguage:'ger'},
      {editionLanguage:null}])assert.equal(getReviewedDescription({...lookup,...patch},'en'),null);
    assert.equal(getReviewedDescription(lookup,'nl'),null,'English synopsis is not relabelled Dutch');
    const noFetch:typeof fetch=async()=>{throw Error('No source allowed');};
    assert.equal((await loadPublicBookDescriptionState(book,'nl',noFetch)).description,null,
      'NL English copy needs an explicitly selected English fallback');
    assert.deepEqual(await loadPublicBookDescriptionState({...book,editionAvailable:false},'en',noFetch),
      {state:'confirmed_missing',description:null},'a synopsis cannot authorize an unavailable edition');
  });
}

test('reviewed copy is not shadowed by a temporary source failure cache',async()=>{
  const row=REVIEWED_FANTASY_DESCRIPTIONS.find(r=>r.title==='The Hobbit')!;
  clearBookDescriptionCacheForTests();
  const fetcher:typeof fetch=async()=>new Response('',{status:429});
  assert.equal((await resolveBookDescription({openLibraryEditionId:row.openLibraryEditionId,
    openLibraryWorkId:row.openLibraryWorkId,editionLanguage:'eng'},fetcher)).state,'temporary_failure');
  assert.equal((await resolveBookDescription({editionTitle:row.title,author:row.author,isbn13:row.isbn13,
    openLibraryEditionId:row.openLibraryEditionId,openLibraryWorkId:row.openLibraryWorkId,
    editionLanguage:'eng'},fetcher)).state,'resolved');
});
