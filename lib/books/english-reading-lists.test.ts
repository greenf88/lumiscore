import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../../docs/operations/en-reading-lists-20261116/records.json' with { type: 'json' };
import {applyStoredPresentation,type StoredDescription,type StoredEditionMetadata} from './stored-presentation.ts';
import {getInitialPublicBookDescription,loadPublicBookDescriptionState} from './public-description.ts';
import {publicDescriptionSource} from './description-source.ts';
import {selectStrictEdition} from './strict-edition.ts';
import type {Book} from '../../app/data/books.ts';

test('reviewed English synopses render immediately and cannot cross author or language bindings',async()=>{
  assert.equal(data.descriptions.length,69);
  for(const r of data.descriptions){
    const book:Book={id:String(r.id),workId:String(r.id),authorId:String(r.authorId),openLibraryWorkId:r.ol,title:r.title,author:'Verified author',source:'supabase',editionId:'70000',editionTitle:r.title,editionLanguage:'eng',strictEditionLanguage:'en',editionAvailable:true,cover:'orbit',score:null,ratingsCount:null,match:null};
    const row:StoredDescription={work_id:r.id,language:'en',bound_author_id:r.authorId,text:r.text,source_type:r.sourceType as StoredDescription['source_type'],source_name:r.sourceName,source_url:r.source,reviewed_at:'2026-11-16T00:00:00Z',review_status:'approved'};
    const applied=applyStoredPresentation([book],'en',[row],[])[0];
    assert.equal(getInitialPublicBookDescription(applied,'en')?.text,r.text);
    const resolved=await loadPublicBookDescriptionState(applied,'en',async()=>{throw Error('External provider must not be needed');});
    assert.equal(resolved.state,'resolved');assert.equal(resolved.description?.text,r.text);
    assert.equal(publicDescriptionSource(resolved.description!)?.href,r.source);
    assert.equal(applyStoredPresentation([{...book,authorId:'999999'}],'en',[row],[])[0].storedDescription,undefined);
    assert.equal(applyStoredPresentation([book],'nl',[row],[])[0].storedDescription,undefined);
  }
});

test('new ordinary English editions win over the incomplete or large-print predecessors and bind their own covers',()=>{
 const old=[{id:21,work_id:21,title:'Left Hand of Darkness',language:'eng',isbn_13:'9781417648436',open_library_edition_id:'OL11760711M'},
 {id:26,work_id:26,title:'Lion, Witch, & Wardrobe',language:'eng',isbn_13:'9780848808235',open_library_edition_id:'OL11558559M'},
 {id:2882,work_id:2723,title:'Artemis',language:'eng',isbn_10:'0525532102',isbn_13:'9780525532101',open_library_edition_id:'OL26940537M'}];
 for(const r of data.editions){
  const fresh={id:80000,work_id:r.id,title:r.title,language:'eng',isbn_10:r.isbn10,isbn_13:r.isbn,open_library_edition_id:r.olid,publisher:r.publisher};
  assert.equal(selectStrictEdition([old.find(e=>e.work_id===r.id)!,fresh],'en',r.title)?.isbn_13,r.isbn);
  const book:Book={id:String(r.id),workId:String(r.id),authorId:String(r.authorId),openLibraryWorkId:r.ol,title:r.title,author:'Verified author',source:'supabase',editionId:'80000',editionTitle:r.title,editionLanguage:'eng',isbn13:r.isbn,strictEditionLanguage:'en',editionAvailable:true,cover:'orbit',score:null,ratingsCount:null,match:null};
  const meta:StoredEditionMetadata={edition_id:80000,work_id:r.id,bound_author_id:r.authorId,bound_title:r.title,bound_language:'eng',bound_isbn13:r.isbn,format:r.format as StoredEditionMetadata['format'],cover_url:r.cover,card_cover_url:r.cover,evidence_url:r.bibliography,review_status:'approved'};
  assert.equal(applyStoredPresentation([book],'en',[],[meta])[0].cardCoverUrl,r.cover);
  assert.equal(applyStoredPresentation([{...book,isbn13:'9780000000002'}],'en',[],[meta])[0].cardCoverUrl,undefined);
 }
});
