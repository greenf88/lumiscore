import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSeriesProgress, isCompanionMembership, type CollectionBook } from './model.ts';
import { buildCollectionDirectoryBaseItems } from './directory.ts';
import { getReviewedDescription, reviewedDescriptionSource } from '../books/reviewed-descriptions.ts';
import { getReviewedCoverOverride } from '../books/reviewed-cover-overrides.ts';
import { loadPublicBookDescription } from '../books/public-description.ts';
import type { Book } from '../../app/data/books.ts';
import { descriptionLanguageAllowed } from '../books/description-source.ts';
import { withStrictEdition } from '../books/strict-edition.ts';
const members = [1,2,3,4].map(n=>({workId:String(n),sequenceNumber:n,publicationOrder:n,subgroup:n===4?'companion':null,book:{workId:String(n),title:`Book ${n}`}})) as CollectionBook[];
test('companion position four does not alter trilogy completion, continuation or denominator',()=>{
 const rated=new Set(['1','2','3','4']);
 const p=calculateSeriesProgress(members,new Map(),3,rated);
 assert.equal(p.read,3);assert.equal(p.total,3);assert.equal(p.percentage,100);assert.equal(p.complete,true);assert.equal(p.nextBook,null);
 const onlyCompanion=calculateSeriesProgress(members,new Map(),3,new Set(['4']));assert.equal(onlyCompanion.read,0);assert.equal(onlyCompanion.nextBook?.workId,'1');
 assert.ok(isCompanionMembership({subgroup:'Companion — official publisher Volume 4'}));assert.ok(!isCompanionMembership({subgroup:null}));
});
test('directory counts optional book but keeps reviewed main-series coverage at 3/3',()=>{
 const [item]=buildCollectionDirectoryBaseItems([{id:'30',slug:'once-upon-a-broken-heart',name:'Once Upon a Broken Heart',collectionType:'series',description:null,expectedMainSeriesTotal:3}],members.map(m=>({...m,collectionId:'30'})));
 assert.equal(item.cataloguedBookCount,4);assert.equal(item.cataloguedMainSeriesCount,3);assert.equal(item.catalogComplete,true);
});
test('own bilingual descriptions do not turn English editions into Dutch editions',()=>{
 for(const isbn of ['9781250462039','9781399641777'])for(const locale of ['nl','en'] as const){
  const input={workId:'10138',editionId:'123',editionTitle:'The Mirror of Infinite Endings',author:'Stephanie Garber',isbn13:isbn,editionLanguage:'eng'};
  const d=getReviewedDescription(input,locale);assert.equal(d?.language,locale);assert.ok(d?.text.includes('Lotusbubble'));assert.ok(reviewedDescriptionSource(d!.sourceKey)?.href.includes('macmillan.com'));
  assert.equal(getReviewedDescription({...input,editionLanguage:'nld'},locale),null);assert.equal(getReviewedDescription({...input,workId:'999'},locale),null);
 }
});
test('registry cover applies only to exact English edition identity, not another ISBN',()=>{
 const input={workId:'10138',title:'The Mirror of Infinite Endings',author:'Stephanie Garber',isbn13:'9781399641777'};
 assert.ok(getReviewedCoverOverride(input)?.coverUrl.includes('isbn.nl'));
 assert.equal(getReviewedCoverOverride({...input,isbn13:'9781250462039'}),null);
 const original={...input,id:'work-10138',cover:'orbit',score:null,match:null,coverUrls:['https://example.invalid/other-edition.jpg']} as Book;
 const edition={id:91021203,work_id:10138,title:input.title,language:'eng',isbn_13:input.isbn13,open_library_edition_id:null,publisher:'Orion'};
 const english=withStrictEdition(original,edition,'en')!;
 const dutch=withStrictEdition(original,edition,'nl')!;
 assert.deepEqual(english.coverUrls,[getReviewedCoverOverride(input)!.coverUrl]);
 assert.equal(english.editionId,'91021203');assert.equal(english.englishEditionFallback,false);
 assert.equal(dutch.title,input.title);assert.equal(dutch.englishEditionFallback,true);
 assert.equal(english.workId,dutch.workId);
});
test('server HTML loader keeps reviewed Dutch summary for an English fallback edition',async()=>{
 const book={workId:'10138',editionId:'91021202',editionTitle:'The Mirror of Infinite Endings',title:'The Mirror of Infinite Endings',author:'Stephanie Garber',isbn13:'9781250462039',editionLanguage:'eng',englishEditionFallback:true,editionAvailable:true} as Book;
 const description=await loadPublicBookDescription(book,'nl',async()=>{throw Error('Reviewed summary must not need an external request');});
 assert.equal(description?.language,'nl');assert.ok(description?.text.includes('Lotusbubble'));
 assert.equal(descriptionLanguageAllowed(description!,'nl',true),true);
 assert.equal(descriptionLanguageAllowed({...description!,source:'open_library',sourceKey:'OL45033863W'},'nl',true),false);
 assert.equal(descriptionLanguageAllowed({...description!,sourceKey:'unreviewed'},'nl',true),false);
});
