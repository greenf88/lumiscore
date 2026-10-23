import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import type {Book} from '../../app/data/books.ts';
import {loadPublicBookDescriptionState} from './public-description.ts';
import {getReviewedDescription} from './reviewed-descriptions.ts';
import {publicDescriptionSource} from './description-source.ts';
import {normalizeVerifiedBookDescription} from './description-text.ts';
import {clearBookDescriptionCacheForTests,resolveBookDescription} from './description-resolution.ts';

const {changes}=JSON.parse(readFileSync(new URL('../../catalog/remaining-covers-20261023/proposal.json',import.meta.url),'utf8'));
for(const row of changes){
  const book={workId:String(row.testWorkId),editionId:String(row.testEditionId),title:row.title,editionTitle:row.title,
    author:row.author,isbn13:row.isbn13,editionLanguage:'eng',openLibraryWorkId:row.workOlid,
    openLibraryEditionId:row.editionOlid,editionAvailable:true} as Book;
  test(`description ${row.workId}: exact test and production identity resolves during provider outage with correct source`,async()=>{
    let calls=0;const unavailable:typeof fetch=async()=>{calls++;return new Response('',{status:429})};
    const productionEditionIds:Record<number,number>={148:10312,228:10313,553:10314};
    for(const ids of [{workId:book.workId,editionId:book.editionId},{workId:String(row.workId),editionId:String(productionEditionIds[row.workId])}]){
      for(const locale of ['en','nl'] as const){
        const result=await loadPublicBookDescriptionState({...book,...ids,englishEditionFallback:locale==='nl'},locale,unavailable);
        assert.equal(result.state,'resolved');assert.equal(result.description?.language,'en');
        assert.ok(result.description!.text.length>50);assert.equal(result.description?.sourceKey,row.isbn13);
        const source=publicDescriptionSource(result.description!);assert.ok(source?.href.startsWith('https://'));
        assert.notEqual(source?.name,'Open Library');assert.notEqual(source?.name,'Google Books');
        assert.equal(source?.name,row.workId===148?'NSW Department of Education':row.workId===228?'Penguin Random House':'Bookouture');
        assert.ok(normalizeVerifiedBookDescription(result.description));
      }
    }
    assert.equal(calls,0,'reviewed source requires no runtime provider requests, even during quota failures');
    assert.equal((await loadPublicBookDescriptionState(book,'nl',unavailable)).description,null,'EN text still needs explicit NL English-edition fallback');
    assert.equal((await loadPublicBookDescriptionState({...book,editionAvailable:false},'en',unavailable)).description,null);
  });
  test(`description ${row.workId}: wrong edition, ISBN, Work, author, title and language cannot borrow reviewed text`,()=>{
    for(const change of [{isbn13:row.oldIsbn},{openLibraryEditionId:row.oldOlid},{openLibraryWorkId:'OL999W'},
      {author:'Unrelated author'},{editionTitle:'Another book'},{editionLanguage:null},{editionLanguage:'ger'},{editionLanguage:'nld'}]){
      assert.equal(getReviewedDescription({...book,...change},'en'),null);
    }
    assert.equal(getReviewedDescription(book,'nl'),null);
  });
}
test('catalog attribution is a distinct reviewed source, not a publisher or an arbitrary URL',()=>{
  const description={text:'A short reviewed description.',source:'official_catalog' as const,sourceKey:'9780064471107',verifiedAt:'2026-10-23',language:'en' as const};
  assert.equal(publicDescriptionSource(description)?.name,'NSW Department of Education');
  assert.equal(publicDescriptionSource({...description,source:'official_publisher'}),null);
  assert.equal(normalizeVerifiedBookDescription({...description,source:'official_publisher'}),null);
  assert.equal(publicDescriptionSource({...description,sourceKey:'https://private.invalid/token'}),null);
  assert.equal(normalizeVerifiedBookDescription({...description,sourceKey:'9780000000000'}),null);
});
test('an earlier provider failure cache cannot hide an exact reviewed summary',async()=>{
  clearBookDescriptionCacheForTests();
  const row=changes[1];
  const lookup={openLibraryWorkId:row.workOlid,openLibraryEditionId:row.editionOlid,isbn13:row.isbn13,editionLanguage:'eng',locale:'en' as const};
  let calls=0;const limited:typeof fetch=async()=>{calls++;return new Response(null,{status:429})};
  assert.equal((await resolveBookDescription(lookup,limited)).state,'temporary_failure');
  const failedCalls=calls;
  assert.equal((await resolveBookDescription({...lookup,editionTitle:row.title,author:row.author},limited)).state,'resolved');
  assert.equal(calls,failedCalls,'reviewed exact identity is checked before provider failure cache');
});
