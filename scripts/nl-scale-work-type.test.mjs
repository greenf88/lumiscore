import test from'node:test';import assert from'node:assert/strict';import{reviewedWorkType}from'./nl-scale-work-type.mjs';
test('existing Work-type constraint is checked before materialising any SQL',()=>{
 for(const t of ['novel','novella','short_story','collection','audiobook_original',null])assert.equal(reviewedWorkType(t),t);
 for(const t of ['nonfiction','non_fiction','philosophy','Paperback','',undefined])assert.throws(()=>reviewedWorkType(t),/existing reviewed database model/);
});
