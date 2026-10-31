import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {Book} from '../../app/data/books.ts';
import {selectStrictEdition,withStrictEdition,type StrictEditionRow} from './strict-edition.ts';
import {getReviewedCoverOverride} from './reviewed-cover-overrides.ts';
const review=JSON.parse(readFileSync(new URL('../../catalog/remaining-covers-20261023/proposal.json',import.meta.url),'utf8'));
for(const r of review.changes){
  test(`proposed print edition ${r.workId}: one coherent presentation in NL/EN with unchanged Work score/progress key`,()=>{
    const old:StrictEditionRow={id:r.existingEditionId,work_id:r.testWorkId,title:r.oldTitle,language:'eng',isbn_13:r.oldIsbn,open_library_edition_id:r.oldOlid,publisher:r.oldPublisher};
    const next:StrictEditionRow={id:r.testEditionId,work_id:r.testWorkId,title:r.title,language:'eng',isbn_10:r.isbn10,isbn_13:r.isbn13,open_library_edition_id:r.editionOlid,publisher:r.publisher};
    const book:Book={id:'work-'+r.testWorkId,workId:String(r.testWorkId),openLibraryWorkId:r.workOlid,title:r.workTitle,author:r.author,source:'supabase',cover:'orbit',score:8.2,ratingsCount:12,match:null};
    for(const language of ['en','nl'] as const){
      if(language==='nl'){
        assert.equal(selectStrictEdition([old,next],language,book.title),null);
        assert.equal(withStrictEdition(book,next,language),null);
        continue;
      }
      const chosen=selectStrictEdition([old,next],language,book.title);
      assert.equal(chosen?.id,next.id);
      const presented=withStrictEdition(book,chosen,language)!;
      assert.equal(presented.workId,book.workId);assert.equal(presented.score,8.2);assert.equal(presented.ratingsCount,12);
      assert.equal(presented.title,r.title);assert.equal(presented.isbn13,r.isbn13);assert.equal(presented.openLibraryEditionId,r.editionOlid);
      assert.equal(presented.englishEditionFallback,false);assert.deepEqual(presented.coverUrls,[r.coverUrl]);
      assert.deepEqual(withStrictEdition(book,old,language)?.coverUrls,[],'new edition image must not leak onto old binding');
      for(const change of [{openLibraryWorkId:'OL999W'},{openLibraryEditionId:r.oldOlid},{isbn13:r.oldIsbn},{editionLanguage:null},{editionLanguage:'ger'},{title:r.oldTitle},{author:'Another author'}]){
        assert.equal(getReviewedCoverOverride({...presented,...change}),null);
      }
    }
    assert.equal(selectStrictEdition([{...next,language:null}],'en',book.title),null);
    assert.equal(selectStrictEdition([{...next,language:'ger'}],'nl',book.title),null);
    assert.equal(withStrictEdition(book,{...next,work_id:999},'en'),null);
  });
}
