// Public-source GETs and offline verification of actual test readback. No DB writes.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {selectStrictEdition,withStrictEdition} from '../../lib/books/strict-edition.ts';
import {editionSourceCoverUrls} from '../../lib/books/edition-cover-evidence.ts';
const dir=new URL('../../catalog/editorial-parity-20261021/',import.meta.url);
const receipt=JSON.parse(await readFile(new URL('fantasy-test-receipt.json',dir),'utf8'));
const old=JSON.parse(await readFile(new URL('source-research.json',dir),'utf8')).editions.data.result;
const rows=receipt.readback;
assert.equal(rows.length,20);assert.equal(receipt.application.target,'hlvujbrmfdlrfxdjwsmb');
const keys=rows.map(r=>'/books/'+r.open_library_edition_id).concat('/books/OL7878673M');
const sourceUrl=new URL('https://openlibrary.org/api/get_many');sourceUrl.searchParams.set('keys',JSON.stringify(keys));
const response=await fetch(sourceUrl,{signal:AbortSignal.timeout(20000)});
if(!response.ok)throw Error('Source unavailable: '+response.status);
const data=await response.json();if(data.status!=='ok')throw Error('Invalid source response');
const fields=['key','title','languages','works','isbn_13','isbn_10','covers','physical_format','publishers','publish_date'];
const sources=Object.fromEntries(Object.entries(data.result).map(([key,value])=>[key,Object.fromEntries(fields.filter(f=>value[f]!==undefined).map(f=>[f,value[f]]))]));
const checks=[];
for(const row of rows){
 const edition={id:row.edition_id,work_id:row.id,title:row.edition_title,language:row.language,isbn_13:row.isbn_13,isbn_10:row.isbn_10,open_library_edition_id:row.open_library_edition_id,publisher:row.publisher};
 for(const locale of ['nl','en']){
  const selected=selectStrictEdition([edition],locale,row.title);assert.equal(selected?.id,row.edition_id);
  const book=withStrictEdition({id:'work-'+row.id,workId:String(row.id),title:row.title,author:row.author,cover:'orbit',score:null,ratingsCount:null,match:null,openLibraryWorkId:row.open_library_id},selected,locale);
  assert.equal(book.title,row.edition_title);assert.equal(book.isbn13,row.isbn_13);assert.equal(book.editionLanguage,'eng');
  assert.equal(book.englishEditionFallback,locale==='nl');
  const source=sources['/books/'+row.open_library_edition_id];
  assert.ok(source?.works?.some(w=>w.key==='/works/'+row.open_library_id),'Source Work mismatch '+row.id);
  assert.ok(source?.isbn_13?.includes(row.isbn_13),'Source ISBN mismatch '+row.id);
  assert.deepEqual(source.languages,[{key:'/languages/eng'}],'Source language mismatch '+row.id);
  const covers=editionSourceCoverUrls(book,source);
  checks.push({testWorkId:row.id,productionWorkId:row.id-921100000,locale,title:book.title,editionId:book.editionId,isbn13:book.isbn13,language:book.editionLanguage,fallback:book.englishEditionFallback,coverUrls:covers,sourceChanged:JSON.stringify(source)!==JSON.stringify(old['/books/'+row.open_library_edition_id])});
 }
}
function dimensions(b){
 if(b[0]!==255||b[1]!==216)return null;let p=2;
 while(p+9<b.length){if(b[p]!==255){p++;continue;}const m=b[p+1];if(m===217||m===218)break;const l=b.readUInt16BE(p+2);if(l<2)break;if([192,193,194,195].includes(m))return {width:b.readUInt16BE(p+7),height:b.readUInt16BE(p+5)};p+=2+l;}return null;
}
const publishers=[{productionWorkId:25,isbn13:'9780553897845',source:'https://penguinrandomhouselibrary.com/book/?isbn=9780553897845',cover:'https://images.penguinrandomhouse.com/cover/9780553897845'},
 {productionWorkId:304,isbn13:'9780553897487',source:'https://penguinrandomhouselibrary.com/book/?isbn=9780553897487',cover:'https://images.penguinrandomhouse.com/cover/9780553897487'}];
const urls=[...new Set(checks.filter(c=>c.locale==='en').flatMap(c=>c.coverUrls.slice(0,1)))].concat(publishers.map(p=>p.cover));
assert.ok(urls.length<=22);
const images=[];
for(let start=0;start<urls.length;start+=3)await Promise.all(urls.slice(start,start+3).map(async url=>{
 const began=Date.now();try{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});const b=Buffer.from(await r.arrayBuffer());images.push({url,status:r.status,bytes:b.length,type:r.headers.get('content-type'),dimensions:dimensions(b),ms:Date.now()-began});}catch(e){images.push({url,error:e.message});}
}));
const result={checkedAt:new Date().toISOString(),target:receipt.application.target,note:'Actual persisted test rows; real shared edition selector and cover identity guard. No browser image load claimed by HTTP alone.',sources,checks,images,publisherCandidates:publishers,excluded:[{workId:14,reason:'Bilingual edition, unchanged'},{workId:22,reason:'Audio edition, unchanged'}],unresolved:checks.filter(c=>c.locale==='en'&&!c.coverUrls.length).map(c=>({workId:c.productionWorkId,title:c.title,isbn13:c.isbn13})),dune:sources['/books/OL7878673M']};
await writeFile(new URL('fantasy-test-cover-verification.json',dir),JSON.stringify(result,null,2));
console.log(JSON.stringify({localeChecks:checks.length,eligibleNL:checks.filter(c=>c.locale==='nl').length,eligibleEN:checks.filter(c=>c.locale==='en').length,withSourceCovers:checks.filter(c=>c.locale==='en'&&c.coverUrls.length).length,unresolved:result.unresolved,imageRequests:images.length,imageFailures:images.filter(i=>i.status!==200||!i.dimensions),above300kb:images.filter(i=>i.bytes>300000),duneLanguages:result.dune?.languages??null}));
