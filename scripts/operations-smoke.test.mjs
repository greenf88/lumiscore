import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectHtml,smoke} from './operations/smoke.mjs';
const url='https://lumisco.re/nl/browse';
const html='<html lang="nl"><title>Boeken</title><link rel="canonical" href="'+url+'"><meta name="robots" content="index, follow">';
test('HTTP smoke checks actual canonical, title and non-error status',()=>{
  assert.equal(inspectHtml(html,url,200).ok,true);
  assert.equal(inspectHtml(html,url,500).ok,false);
  assert.equal(inspectHtml(html,url+'?page=2',200).ok,false);
  assert.equal(inspectHtml(html+`<link rel="canonical" href="${url}">`,url,200).ok,false);
});
test('smoke refuses another origin before sending requests',async()=>{
  await assert.rejects(smoke('https://example.com'));
});
