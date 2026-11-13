import assert from 'node:assert/strict';
import test from 'node:test';
import type {Book} from '../../app/data/books.ts';
import {getReviewedDescription} from './reviewed-descriptions.ts';
import {resolveBookDescription} from './description-resolution.ts';
import {getInitialPublicBookDescription,loadPublicBookDescriptionState} from './public-description.ts';
import {publicDescriptionSource} from './description-source.ts';
import {normalizeVerifiedBookDescription} from './description-text.ts';

// Independently recorded public edition identities, not generated from the fallback entries.
const editions=[
  {workId:'9912',title:'10 Things I Hate About You',author:'David Levithan',isbn13:'9780439087308',
    subject:/Bianca Stratford/,source:'official_catalog',sourceName:'Google Books — Scholastic edition',
    sourceUrl:'https://books.google.com/books/about/10_Things_I_Hate_about_You.html?id=UkSIGwAACAAJ'},
  {workId:'8052',title:'Palace of Solitude',author:'Esfandiary Bakhtiary',isbn13:'9780704370203',
    subject:/Princess Soraya/,source:'official_publisher',sourceName:'J’ai lu / FeniXX — publisher synopsis via Torrossa',
    sourceUrl:'https://www.torrossa.com/fr/resources/an/6336125'},
  {workId:'3822',title:"Zlata's Diary",author:'Zlata Filipovic\u0301',isbn13:'9780140242058',
    subject:/Sarajevo/,source:'official_publisher',sourceName:'Penguin Random House',
    sourceUrl:'https://www.penguinrandomhouse.com/books/323402/zlatas-diary-by-zlata-filipovic/'},
  {workId:'6967',title:'The Official Filthy Rich Handbook',author:'Christopher Tennant',isbn13:'9780761147039',
    subject:/butler and a majordomo/,source:'official_publisher',sourceName:'Workman Publishing — Spring 2011 catalog, page 94',
    sourceUrl:'https://edelweiss-assets.abovethetreeline.com/WN/pdfs/Workman_Spring2011.pdf'},
] as const;

for(const edition of editions){
  const book={workId:edition.workId,title:edition.title,editionTitle:edition.title,author:edition.author,
    isbn13:edition.isbn13,editionLanguage:'eng',editionAvailable:true} as Book;

  test(`reviewed recovery ${edition.workId}: public page and resolver return attributed text without provider access`,async()=>{
    let providerCalls=0;
    const unavailable:typeof fetch=async()=>{providerCalls++;return new Response(null,{status:429});};
    const snapshotStore={loadDescriptionSnapshot:async()=>null,saveDescriptionSnapshot:async()=>undefined,
      markDescriptionSnapshotFailure:async()=>undefined};
    const publicResult=await loadPublicBookDescriptionState(book,'en',unavailable,snapshotStore);
    const resolverResult=await resolveBookDescription({...book,locale:'en'},unavailable);
    assert.equal(publicResult.state,'resolved');
    assert.equal(resolverResult.state,'resolved');
    assert.deepEqual(publicResult.description,resolverResult.description);
    const description=publicResult.description!;
    assert.deepEqual(getInitialPublicBookDescription(book,'en'),description,'initial HTML uses the same identity-bound text without awaiting any source');
    assert.match(description.text,edition.subject);
    assert.equal(description.language,'en');
    assert.equal(description.sourceKey,edition.isbn13);
    assert.equal(description.source,edition.source);
    assert.deepEqual(normalizeVerifiedBookDescription(description),description);
    assert.deepEqual(publicDescriptionSource(description),{name:edition.sourceName,href:edition.sourceUrl});
    assert.equal(providerCalls,0);
  });

  test(`reviewed recovery ${edition.workId}: mismatched identity or locale cannot borrow the summary`,()=>{
    for(const mismatch of [{isbn13:'9780143036876'},{isbn13:null},{editionTitle:'Unrelated book'},
      {editionTitle:null},{author:'Unrelated author'},{author:null},
      {editionLanguage:'nld'},{editionLanguage:'fre'},{editionLanguage:null}]){
      assert.equal(getReviewedDescription({...book,...mismatch},'en'),null,JSON.stringify(mismatch));
      // Include malformed runtime values as well as valid-but-wrong identities.
      assert.equal(getInitialPublicBookDescription({...book,...mismatch} as Book,'en'),null,JSON.stringify(mismatch));
    }
    assert.equal(getReviewedDescription(book,'nl'),null);
    assert.equal(getInitialPublicBookDescription(book,'nl'),null);
  });

  test(`reviewed recovery ${edition.workId}: source attribution rejects a different source kind`,()=>{
    const description=getReviewedDescription(book,'en')!;
    const mismatched={...description,source:edition.source==='official_catalog'?'official_publisher' as const:'official_catalog' as const};
    assert.equal(publicDescriptionSource(mismatched),null);
    assert.equal(normalizeVerifiedBookDescription(mismatched),null);
  });
}

test('Zlata author matching accepts equivalent Unicode accents while retaining identity checks',()=>{
  const edition=editions[2];
  const identity={editionTitle:edition.title,author:edition.author,isbn13:edition.isbn13,editionLanguage:'eng'};
  assert.deepEqual(getReviewedDescription({...identity,author:'Zlata Filipović'},'en'),getReviewedDescription(identity,'en'));
  assert.equal(getReviewedDescription({...identity,author:'Zlata Filipovic'},'en'),null);
});
