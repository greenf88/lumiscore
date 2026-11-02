import test from 'node:test';import assert from 'node:assert/strict';
import {existingSourceAuthor} from './nl-scale-author-identity.mjs';
test('joint Martin Beck credits never equate Maj Sjöwall with existing Per Wahlöö through a Work-level Wikidata match',()=>{
 const current=[{id:3341,name:'Per Wahlöö',open_library_id:'OL1460559A'}];
 const n={sourceAuthors:[{key:'/authors/OL709121A',name:'Maj Sjöwall'},{key:'/authors/OL1460559A',name:'Per Wahlöö'}],authorityMatches:[{authorId:3341,sourceName:'Per Wahlöö',method:'exact_author_alias'},{authorId:3341,wikidata:'Q553730',method:'shared_wikidata_authority'}]};
 assert.equal(existingSourceAuthor({name:'Maj Sjöwall',sourceAuthorId:'OL709121A'},n,current),null);
 assert.equal(existingSourceAuthor({name:'Per Wahlöö',sourceAuthorId:'OL1460559A'},n,current),current[0]);
});
test('verified single-author authority alias and explicitly source-bound joint-author authority remain usable, ambiguous people stop',()=>{
 const a={id:1,name:'Canonical Person',open_library_id:'OL1A'},source={name:'Verified Pen Name',sourceAuthorId:'OL2A'};
 assert.equal(existingSourceAuthor(source,{sourceAuthors:[source],authorityMatches:[{authorId:1,method:'shared_wikidata_authority'}]},[a]),a);
 assert.equal(existingSourceAuthor(source,{sourceAuthors:[source,{}],authorityMatches:[{authorId:1,method:'shared_wikidata_authority',sourceAuthorKey:'OL2A'}]},[a]),a);
 assert.throws(()=>existingSourceAuthor(source,{sourceAuthors:[source],authorityMatches:[{authorId:1,sourceName:source.name},{authorId:2,sourceName:source.name}]},[a,{id:2}]),/Ambiguous/);
});
