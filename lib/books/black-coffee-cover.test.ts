import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import { withStrictEdition } from './strict-edition.ts';
import { getReviewedCoverOverride } from './reviewed-cover-overrides.ts';
import { withEditionCoverEvidence } from './edition-cover-evidence.ts';
import { getInitialBookCoverUrls } from './book-cover-state.ts';

const cover='https://theatrical-cdn2-hbb2fybfcphnf6hc.a01.azurefd.net/media/0051725_black_coffee_300.png';
const identity={workId:'10020',openLibraryWorkId:'OL471602W',title:'Black Coffee',author:'Agatha Christie',isbn13:'9780573702341',editionLanguage:'eng',openLibraryEditionId:'OL37024404M'};
const base:Book={...identity,id:'work-10020',source:'supabase',score:null,ratingsCount:null,match:null,cover:'orbit'};
const edition={id:'10179',work_id:'10020',title:'Black Coffee',language:'eng',isbn_13:'9780573702341',isbn_10:'0573702349',open_library_edition_id:'OL37024404M'};

test('Black Coffee acting edition uses publisher art without consulting the mislabelled provider cover',async()=>{
  const book=withStrictEdition(base,edition,'en');assert.ok(book);
  assert.deepEqual(getInitialBookCoverUrls(book),[cover]);
  let calls=0;
  const [hydrated]=await withEditionCoverEvidence([book],async()=>{calls++;throw Error('Incorrect provider cover must not be fetched');});
  assert.equal(calls,0);assert.deepEqual(getInitialBookCoverUrls(hydrated),[cover]);
  assert.deepEqual(hydrated.coverUrls,[cover]);
});

test('Black Coffee publisher art cannot cross edition, author, Work or language identities',()=>{
  assert.equal(getReviewedCoverOverride(identity)?.coverUrl,cover);
  for(const mismatch of [{isbn13:'9780007151665'},{title:'A different book'},{author:'Charles Osborne'},
    {openLibraryWorkId:'OL999W'},{openLibraryEditionId:'OL999M'},{editionLanguage:'nld'}]){
    assert.equal(getReviewedCoverOverride({...identity,...mismatch}),null);
  }
});
