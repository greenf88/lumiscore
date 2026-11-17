import assert from 'node:assert/strict';
import test from 'node:test';
import type {Book} from '../../app/data/books.ts';
import evidence from './catalog-reviewed-covers-20261117.json' with {type:'json'};
import {withCatalogCoverEvidence} from './catalog-cover-evidence.ts';

function fixture(row:typeof evidence[number]):Book{
  return {id:'work-'+row.workId,workId:row.workId,editionId:row.editionId,
    authorId:row.authorId,author:row.author,title:row.title,editionTitle:row.title,
    isbn13:row.isbn13,editionLanguage:row.language,strictEditionLanguage:row.language==='nld'?'nl':'en',
    openLibraryWorkId:row.openLibraryWorkId??undefined,openLibraryEditionId:row.openLibraryEditionId??undefined,
    source:'supabase',cover:'orbit',score:8,ratingsCount:4,match:null,editionAvailable:true,coverUrls:[]};
}

test('independently reviewed images keep every selected edition and book attribute intact',()=>{
  assert.ok(evidence.some(x=>x.language==='nld'));
  assert.ok(evidence.some(x=>x.language==='eng'));
  assert.equal(new Set(evidence.map(x=>x.editionId)).size,evidence.length);
  for(const row of evidence){const book=fixture(row);const [resolved]=withCatalogCoverEvidence([book]);
    assert.deepEqual(resolved,{...book,coverUrls:[row.coverUrl]},row.editionId);
    for(const change of [
      {workId:'other'},{editionId:'other'},{authorId:'other'},{author:'Different author'},
      {editionTitle:'Different title'},{isbn13:'9780000000000'},{editionLanguage:'ger'},
      {openLibraryWorkId:'OL999999999W'},{openLibraryEditionId:'OL999999999M'},
      {strictEditionLanguage:undefined},{strictEditionLanguage:row.language==='nld'?'en':'nl'},
      {editionAvailable:false},{storedPresentationUnavailable:true},
    ] as Partial<Book>[]){const changed={...book,...change};assert.equal(withCatalogCoverEvidence([changed])[0],changed,row.editionId+JSON.stringify(change));}
    const existing={...book,coverUrls:['https://publisher.example/approved.jpg']};
    assert.equal(withCatalogCoverEvidence([existing])[0],existing);
  }
});
