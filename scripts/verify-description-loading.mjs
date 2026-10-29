// Real test-catalogue HTTP/SSR checks; never writes ratings, metadata or accounts.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../catalog/descriptions-20261023/',import.meta.url);
const {changes}=JSON.parse(readFileSync(new URL('../remaining-covers-20261023/proposal.json',root),'utf8'));
const base=process.argv[2]??'http://127.0.0.1:3992';
if(new URL(base).hostname!=='127.0.0.1')throw Error('Loopback test target only');
const expected={148:{source:'official_catalog',name:'NSW Department of Education',marker:'Polly and Digory unexpectedly reach Narnia.',href:'https://online.education.nsw.gov.au/prc/booklist/listBooksByTitle.html?letter=M&levelId=3'},228:{source:'official_publisher',name:'Penguin Random House',marker:'Lyra and Will face a dangerous journey',href:'https://www.penguinrandomhouse.com/books/136441/his-dark-materials-the-amber-spyglass-book-3-by-philip-pullman/9780440418566/'},553:{source:'official_publisher',name:'Bookouture',marker:'A housemaid takes a job with the wealthy Garricks',href:'https://bookouture.com/books/2903/'}};
const decode=s=>s.replace(/&amp;/g,'&').replace(/&#x27;|&#39;/g,"'");
const checks=[];
for(const locale of ['nl','en'])for(const row of changes){
  const wanted=expected[row.workId],url=`${base}/${locale}/book/${row.testWorkId}?returnTo=%2Fcollection%2Fcollection-languages-review-20261023`;
  const started=performance.now(),response=await fetch(url,{signal:AbortSignal.timeout(15000)}),html=decode(await response.text());
  const page={locale,workId:row.workId,testWorkId:row.testWorkId,status:response.status,milliseconds:Math.round(performance.now()-started),description:html.includes(wanted.marker),attribution:html.includes(wanted.name)&&html.includes(wanted.href),editionTitle:html.includes(row.title),isbn:html.includes(row.isbn13),cover:html.includes(row.coverUrl),englishDescriptionLabel:html.includes('Engelse beschrijving bij de Engelse editie'),temporaryFailure:html.includes('The description could not load right now')||html.includes('De beschrijving kon tijdelijk niet worden geladen'),returnLink:html.includes(`href="/${locale}/collection/collection-languages-review-20261023"`)};
  assert.equal(page.status,200);for(const key of ['description','attribution','editionTitle','isbn','cover','returnLink'])assert.equal(page[key],true,`${row.workId} ${locale} ${key}`);
  assert.equal(page.englishDescriptionLabel,locale==='nl');assert.equal(page.temporaryFailure,false);checks.push({kind:'page',...page});
  const api=await fetch(`${base}/api/books/${row.testWorkId}/description?locale=${locale}`,{signal:AbortSignal.timeout(15000)}),data=await api.json();
  assert.equal(api.status,200);assert.equal(data.state,'resolved');assert.equal(data.description.language,'en');assert.equal(data.description.source,wanted.source);assert.equal(data.description.sourceKey,row.isbn13);assert.ok(data.description.text.includes(wanted.marker));
  checks.push({kind:'api',locale,workId:row.workId,status:api.status,state:data.state,source:data.description.source,sourceKey:data.description.sourceKey,language:data.description.language});
}
writeFileSync(new URL('test-http-proof.json',root),JSON.stringify({checkedAt:new Date().toISOString(),project:'hlvujbrmfdlrfxdjwsmb',base,evidence:'Built app, actual existing test catalogue; HTTP/SSR/API, not hosted/browser/physical-phone proof',databaseWrites:false,checks},null,2)+'\n');
console.log(JSON.stringify(checks,null,2));
