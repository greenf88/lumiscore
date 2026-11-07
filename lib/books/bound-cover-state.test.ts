import assert from 'node:assert/strict';import test from 'node:test';
import{getBookCoverIdentity as oldIdentity,getInitialBookCoverUrls}from'./book-cover-state.ts';
import{getBookCoverIdentity,getInitialBoundCoverUrls,hasBoundCover}from'./bound-cover-state.ts';
import{isBookPresentationAllowed as original}from'./strict-edition.ts';
import{isBookPresentationAllowed}from'./edition-language-policy.ts';
import type{Book}from'../../app/data/books.ts';
test('bound client covers retain server selection, identity, language and precise fallback order',()=>{
 for(const locale of ['en','nl']as const){const b={id:'1',workId:'1',title:'A book',author:'An author',editionId:'2',isbn13:'9780593135204',editionAvailable:true,strictEditionLanguage:locale,editionLanguage:locale==='en'?'eng':'nld',coverUrls:['https://example.invalid/edition.jpg','https://example.invalid/other-verified.jpg']}as Book;
  assert.deepEqual(getInitialBoundCoverUrls(b),getInitialBookCoverUrls(b));assert.equal(getBookCoverIdentity(b),oldIdentity(b));assert.equal(hasBoundCover(b),true);
 }
 assert.deepEqual(getInitialBoundCoverUrls({coverUrls:[]}),[]);assert.equal(hasBoundCover({}),false);
});
test('server and lightweight browser predicates are the same policy, not parallel eligibility',()=>{
 assert.equal(isBookPresentationAllowed,original);
 for(const locale of ['en','nl']as const)for(const language of ['eng','en','nld','nl','deu',null]){
  const b={editionAvailable:true,strictEditionLanguage:locale,editionLanguage:language};assert.equal(isBookPresentationAllowed(b,locale),original(b,locale));
 }
});
