import test from'node:test';import assert from'node:assert/strict';import{resolveBookDescription,clearBookDescriptionCacheForTests}from'./description-resolution.ts';
const lookup={workId:'synthetic-source',editionId:'222',author:'Fixture Author',openLibraryWorkId:'OL111W',openLibraryEditionId:'OL222M',isbn13:'9780141439471',editionTitle:'Fixture',editionLanguage:'eng',locale:'en' as const};
for(const c of[{name:'authentication401',http:401,state:'temporary_failure',calls:1},{name:'authorization403',http:403,state:'temporary_failure',calls:1},{name:'server502',http:502,state:'temporary_failure',calls:3},{name:'invalidJSON200',http:200,state:'temporary_failure',calls:3},{name:'empty200',http:200,state:'confirmed_missing',calls:1},{name:'mismatchedISBN200',http:200,state:'confirmed_missing',calls:1}]){
 test('source classification: '+c.name+' is not a missing LumiScore Work',async()=>{
  clearBookDescriptionCacheForTests();let google=0;
  const result=await resolveBookDescription(lookup,async input=>{
   if(String(input).startsWith('https://openlibrary.org/'))return new Response(null,{status:404});
   google++;const body=c.name==='invalidJSON200'?'invalid JSON':c.name==='mismatchedISBN200'?JSON.stringify({items:[{volumeInfo:{title:'Different book',authors:['Different Author'],language:'en',industryIdentifiers:[{type:'ISBN_13',identifier:'9780553383041'}],description:'This is a long English description for the wrong book and must never be shown.'}}]}):JSON.stringify({totalItems:0});
   return new Response(body,{status:c.http});
  });
  assert.equal(result.state,c.state);assert.equal(result.description,null);assert.equal(google,c.calls);
 });
}

