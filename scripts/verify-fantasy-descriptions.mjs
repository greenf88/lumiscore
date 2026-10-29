// Actual isolated catalogue SSR/API evidence; explicitly loopback, read-only.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const data=new URL('../catalog/fantasy-descriptions-20261029/',import.meta.url);
const prod=JSON.parse(readFileSync(new URL('catalogue-readonly.json',data),'utf8'));
const test=JSON.parse(readFileSync(new URL('test-catalogue-readonly.json',data),'utf8'));
const base=process.argv[2]??'http://127.0.0.1:3029';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Explicit local isolated target only');
const results=[];
for(const row of prod){const fixture=test.find(w=>w.open_library_id===row.open_library_id);if(!fixture){results.push({workId:row.work_id,state:'test_fixture_absent'});continue;}
 for(const locale of ['en','nl']){
  const url=`${base}/${locale}/book/${fixture.test_work_id}?returnTo=%2Ftoplijsten%2Ffantasy-sciencefiction`;
  const start=performance.now(),r=await fetch(url,{signal:AbortSignal.timeout(20000)}),html=await r.text();
  const sections=[...html.matchAll(/<section class="book-description"[^>]*>([\s\S]*?)<\/section>/g)];
  const section=sections.at(-1)?.[1]??'';
  const api=await fetch(`${base}/api/books/${fixture.test_work_id}/description?locale=${locale}`,{signal:AbortSignal.timeout(10000)}),body=await api.json();
  const resolved=body.state==='resolved';
  const item={workId:row.work_id,testWorkId:fixture.test_work_id,locale,status:r.status,milliseconds:Math.round(performance.now()-start),state:body.state,language:body.description?.language,source:body.description?.source,sourceKey:body.description?.sourceKey,visibleSSR:section.includes('description-source'),englishFallbackLabel:section.includes('Engelse beschrijving bij de Engelse editie'),returnLink:html.includes(`href="/${locale}/toplijsten/fantasy-sciencefiction"`)};
  const available=fixture.editions.some(e=>e.language==='eng');
  assert.equal(r.status,200);assert.equal(api.status,200);assert.equal(resolved,available,row.work_title+' '+locale);assert.equal(item.visibleSSR,available);
  if(available){assert.equal(item.language,'en');assert.equal(item.source,'open_library');assert.equal(item.sourceKey,row.open_library_id);}
  else assert.equal(body.state,'confirmed_missing','unavailable editions remain unavailable, not a source failure');
  assert.equal(item.englishFallbackLabel,available&&locale==='nl');assert.equal(item.returnLink,true);results.push(item);
 }}
writeFileSync(new URL('local-http-proof.json',data),JSON.stringify({checkedAt:new Date().toISOString(),base,testProject:'hlvujbrmfdlrfxdjwsmb',writes:false,results},null,2)+'\n');
console.log(JSON.stringify({resolvedCombinations:results.filter(r=>r.state==='resolved').length,absentFixtures:results.filter(r=>r.state==='test_fixture_absent').map(r=>r.workId),passed:true}));
