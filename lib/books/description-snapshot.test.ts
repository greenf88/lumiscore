import assert from 'node:assert/strict';
import test from 'node:test';
import {createDescriptionSnapshot,readDescriptionSnapshot} from './description-snapshot.ts';
import type {Book,VerifiedBookDescription} from '../../app/data/books.ts';
const now=Date.parse('2026-11-07T12:00:00Z');
const book={workId:'1',authorId:'2',editionId:'3',title:'A verified book',editionTitle:'A verified book',editionLanguage:'eng',strictEditionLanguage:'en',editionAvailable:true,openLibraryWorkId:'OL1W',openLibraryEditionId:'OL2M',isbn13:null} as Book;
const description={text:'The traveller and her companions discover a distant city where they must decide who can be trusted. Their search for a way home brings them into conflict with the people who rule the city.',source:'open_library',sourceKey:'OL2M',verifiedAt:new Date(now).toISOString(),language:'en'} as VerifiedBookDescription;
test('durable snapshots retain exact edition, identity, language, source and fetch provenance',()=>{
 const row=createDescriptionSnapshot(book,'en',description,now)!;assert.ok(row);
 assert.equal(readDescriptionSnapshot(row,book,'en',now+1000)?.fresh,true);
 assert.equal(readDescriptionSnapshot(row,book,'en',now+31*86400000)?.fresh,false);
 assert.equal(readDescriptionSnapshot(row,book,'en',now+91*86400000),null);
 assert.equal(readDescriptionSnapshot({...row,provider_status:'temporary_failure'},book,'en',now+31*86400000)?.description.text,description.text);
 for(const changed of [{authorId:'9'},{editionTitle:'Another book'},{editionId:'9'},{editionLanguage:'nld'},{openLibraryEditionId:'OL9M'},{openLibraryWorkId:null},{editionAvailable:false}])
  assert.equal(readDescriptionSnapshot(row,{...book,...changed},'en',now+1000),null);
 assert.equal(readDescriptionSnapshot(row,book,'nl',now+1000),null);
});
test('bad or very short provider text, wrong source, language and ISBN binding cannot replace valid content',()=>{
 for(const change of [{text:'No description available.'},{text:'A short book.'},{language:'nl'},{sourceKey:'OL3M'},{source:'google_books'}])
  assert.equal(createDescriptionSnapshot(book,'en',{...description,...change} as VerifiedBookDescription,now),null);
 const row=createDescriptionSnapshot(book,'en',description,now)!;
 assert.equal(readDescriptionSnapshot({...row,text:'Service unavailable'},book,'en',now),null);
 assert.equal(readDescriptionSnapshot({...row,fetched_at:new Date(now+1000).toISOString()},book,'en',now),null);
 assert.equal(readDescriptionSnapshot(row,{...book,isbn13:'9780385472579'},'en',now),null);
});
