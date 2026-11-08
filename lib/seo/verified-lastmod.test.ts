import assert from 'node:assert/strict';
import test from 'node:test';
import {verifiedPageLastmod} from './verified-lastmod.ts';
import {buildLocalizedSitemap} from './sitemap.ts';
const at='2026-11-01T12:34:56.000Z',now=Date.parse('2026-11-07'),hash='a'.repeat(64);
const revision={currentHash:hash,recordedHash:hash,changedAt:at,receiptSha256:'b'.repeat(64)};
test('only matching complete content and a committed receipt emit a stable sitemap date',()=>{
 assert.equal(verifiedPageLastmod(revision,now),at);
 assert.equal(verifiedPageLastmod(revision,now+86400000),at);
 for(const change of[{currentHash:null},{currentHash:'c'.repeat(64)},{receiptSha256:''},{changedAt:'tomorrow'},{changedAt:'2099-01-01'}])
  assert.equal(verifiedPageLastmod({...revision,...change},now),null);
 const books=[{workId:'1',locales:['en'] as const}],revisions=new Map([['/en/book/1',revision]]);
 const xml=buildLocalizedSitemap(books,[],'en',revisions);
 assert.match(xml,new RegExp('<lastmod>'+at+'</lastmod>'));
 assert.equal(xml,buildLocalizedSitemap(books,[],'en',revisions));
 assert.doesNotMatch(buildLocalizedSitemap(books,[],'en'),/<lastmod>/);
 assert.doesNotMatch(buildLocalizedSitemap(books,[],'nl',revisions),/<lastmod>/);
});
