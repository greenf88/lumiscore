// Read-only HTTP/SSR checks against a loopback app backed by the real test catalog.
// This does not claim browser hydration, actual browser image loading or hosted proof.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../catalog/remaining-covers-20261023/',import.meta.url);
const {changes}=JSON.parse(readFileSync(new URL('proposal.json',dir),'utf8'));
const base=process.argv[2]??'http://127.0.0.1:3991';
if(new URL(base).hostname!=='127.0.0.1')throw Error('Loopback only');
const decode=s=>s.replace(/&#x27;|&#39;/g,"'").replace(/&amp;/g,'&');
const checks=[];
for(const locale of ['nl','en'])for(const row of changes){
 const url=`${base}/${locale}/book/${row.testWorkId}?returnTo=%2Fcollection%2Fcollection-languages-review-20261023`;
 const began=Date.now(),response=await fetch(url,{signal:AbortSignal.timeout(30000)}),html=await response.text();
 const title=decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]??'');
 const images=[...html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"[^>]*>/g)].map(m=>decode(m[1]));
 const check={locale,workId:row.workId,testWorkId:row.testWorkId,status:response.status,title,correctEditionTitle:title===row.title,correctIsbn:html.includes(row.isbn13),correctCover:images.includes(row.coverUrl),englishFallback:html.includes('Engelse editie'),returnLink:html.includes(`href="/${locale}/collection/collection-languages-review-20261023"`),publicScoreNeutral:html.includes(locale==='nl'?'Onvoldoende beoordelingen':'Insufficient ratings'),localElapsedMs:Date.now()-began};
 checks.push(check);assert.equal(check.status,200);assert.ok(check.correctEditionTitle);assert.ok(check.correctIsbn);assert.ok(check.correctCover);assert.equal(check.englishFallback,locale==='nl');assert.ok(check.returnLink);assert.ok(check.publicScoreNeutral);
}
for(const locale of ['nl','en']){
 const response=await fetch(`${base}/${locale}/collection/collection-languages-review-20261023`,{signal:AbortSignal.timeout(30000)}),html=await response.text();
 const cards=changes.map(row=>({workId:row.workId,link:html.includes(`/${locale}/book/${row.testWorkId}?returnTo=`),title:decode(html).includes(row.title),cover:decode(html).includes(row.coverUrl)}));
 checks.push({locale,collection:'collection-languages-review-20261023',status:response.status,cards});assert.equal(response.status,200);for(const card of cards)assert.ok(card.link&&card.title&&card.cover);
}
writeFileSync(new URL('http-verification.json',dir),JSON.stringify({checkedAt:new Date().toISOString(),target:'hlvujbrmfdlrfxdjwsmb',base,evidence:'Real test records, built app HTTP and SSR; no browser/hosted claim',checks},null,2)+'\n');console.log(JSON.stringify(checks,null,2));
