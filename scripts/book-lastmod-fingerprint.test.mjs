import test from'node:test';import assert from'node:assert/strict';import{reviewedBookPageFingerprint as fingerprint}from'../docs/proposals/book-lastmod-fingerprint.mjs';
const page={lifecycle:'indexable',locale:'nl',policyVersion:'strict-edition-v1',work:{id:1,title:'Synthetic fixture',authorId:2,authorName:'Synthetic author',firstPublicationYear:2001},edition:{id:3,title:'Synthetic fixture NL',language:'nld',isbn:'synthetic',publisher:'Synthetic',format:'paperback',reviewStatus:'approved'},summary:{status:'approved',text:'Synthetic original fixture text.',language:'nl',source:'https://example.invalid/reviewed-source'},cover:{status:'approved',verifiedIdentity:'same-edition-image-sha',source:'https://example.invalid/cover'},rating:{known:true,display:'9.0',band:'5–9',available:true},links:[{path:'/nl/toplijsten/fixture?returnTo=ignored',label:'Fixture list'}]};
test('review-only fingerprint follows visible identity, edition, text, cover, links and public rating',()=>{
 const before=fingerprint(page);assert.match(before,/^[a-f0-9]{64}$/);
 for(const change of[
  {work:{...page.work,title:'Other title'}},{edition:{...page.edition,publisher:'Corrected publisher'}},
  {edition:{...page.edition,format:'hardcover'}},{summary:{...page.summary,text:'Corrected fixture content.'}},
  {cover:{...page.cover,verifiedIdentity:'other verified image'}},{rating:{...page.rating,display:'9.1'}},
  {rating:{...page.rating,band:'10–24'}},{links:[{path:'/nl/collection/fixture',label:'Fixture collection'}]},
  {policyVersion:'strict-edition-v2'},
 ])assert.notEqual(fingerprint({...page,...change}),before);
});
test('requests, builds, private state, raw counts and unchanged reviews cannot advance lastmod',()=>{
 assert.equal(fingerprint({...page,buildAt:'2026-11-07',requestAt:'2026-11-08',userId:'not hashed',readingStatus:'read',reviewedAt:'2026-11-09',rating:{...page.rating,rawCount:8},links:[{path:'/nl/toplijsten/fixture?returnTo=other',label:'Fixture list'}]}),fingerprint(page));
});
test('unknown optional content or scores and unsuitable locales omit dates rather than guess',()=>{
 for(const change of[{summary:{status:'temporary_failure'}},{summary:{status:'unreviewed'}},{cover:{status:'unknown'}},{rating:{known:false}},{lifecycle:'noindex'},{edition:{...page.edition,reviewStatus:'unknown'}}])assert.equal(fingerprint({...page,...change}),null);
});
