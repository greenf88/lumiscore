// Reproducible evidence summary; no network, credentials, account or DB access.
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {selectStrictEdition} from '../../lib/books/strict-edition.ts';
const root=new URL('../../',import.meta.url),dir=new URL('catalog/editorial-parity-20261021/',root);
const read=async path=>JSON.parse(await readFile(new URL(path,dir),'utf8'));
const [baseline,server,plan,browser]=await Promise.all([read('production-public-baseline.json'),read('server-html-verification.json'),read('correction-proposal.json'),readFile(process.env.EDITORIAL_BROWSER_EVIDENCE,'utf8').then(JSON.parse)]);
const old=JSON.parse(execFileSync('git',['-c','safe.directory='+fileURLToPath(root).replace(/\/$/,''),'show','a668d8fd9ff964175ba0b9a55db706d3f5f0b047:lib/catalog/top-lists.json'],{cwd:root,encoding:'utf8',windowsHide:true}));
const records=[];
for(const locale of ['nl','en'])for(const work of baseline.rows){
 const oldBook=old.books.find(b=>b.workId===String(work.id));
 const list=server.results.find(r=>r.cards?.some(c=>c.id===String(work.id))&&r.path.startsWith('/'+locale+'/'));
 const card=list?.cards.find(c=>c.id===String(work.id));
 const detail=server.results.find(r=>r.id===String(work.id)&&r.path.startsWith('/'+locale+'/book/'));
 const edition=selectStrictEdition(work.editions,locale,work.title);
 records.push({workId:work.id,locale,before:{cardTitle:oldBook.title,cardCover:oldBook.coverUrl,cardScore:'—',detailEditionAvailable:Boolean(edition)},after:{cardTitle:card.title,detailTitle:detail.title,cardScore:card.score,detailScore:detail.score,editionId:edition?.id??null,isbn13:edition?.isbn_13??null,language:edition?.language??null,detailImage:detail.image??null,availability:edition?'verified edition':'no eligible stored edition'},browserLoaded:browser.details.some(d=>new URL(d.url).pathname==='/'+locale+'/book/'+work.id&&d.cover.some(c=>c.loaded&&c.width>1)),proposedEditionLanguage:plan.languageCorrections.filter(c=>c.workId===work.id).map(c=>c.editionId),catalogueAddition:plan.editionAdditions.some(c=>c.workId===work.id)});
}
const stats=values=>{const numbers=values.filter(Number.isFinite).sort((a,b)=>a-b);return {samples:numbers.length,median:Math.round(numbers[Math.floor(numbers.length/2)]??0),min:Math.round(numbers[0]??0),max:Math.round(numbers.at(-1)??0)};};
const measurements=[];
for(const phase of ['baseline-mobile','fixed-mobile','final-parallel-mobile','final-reviewed-mobile'])for(const locale of ['nl','en']){
 const rows=browser.performance.filter(row=>row.phase===phase&&row.locale===locale&&row.width===390);
 const perf=rows.map(row=>JSON.parse(row.perf));
 measurements.push({phase,locale,ttfbMs:stats(perf.map(p=>p.ttfb)),firstCardParsedMs:stats(perf.map(p=>p.firstCard)),firstCardVisibleMs:stats(rows.map(row=>Number(row.firstVisible))),firstImageLoadMs:stats(perf.map(p=>p.coverLoaded)),lcpMs:stats(perf.map(p=>p.lcp)),cls:perf.map(p=>p.cls)});
}
await writeFile(new URL('per-book-review.json',dir),JSON.stringify({checkedAt:new Date().toISOString(),note:'Original HTTP HTML proves identity/score for all70 detail routes; browserLoaded is separately recorded, never inferred from img markup or HTTP200.',records},null,2));
await writeFile(new URL('performance-summary.json',dir),JSON.stringify({profile:'Local Vinext dev servers on same Windows machine; normal desktop network, browser390x844, guest/public only; warm browser resources and compiled routes, n3 per locale/phase; NOT physical phone, throttled mobile or production latency.',baseline:'main a668d8f static editorial data, no catalog requests and all scores incorrectly neutral',queries:{finalDystopia:{works:10,editions:11,summaryRows:10,databaseRequests:3,parallel:true,externalMetadataRequests:0},finalFantasy:{works:25,editions:25,summaryRows:25,databaseRequests:3,parallel:true,externalMetadataRequests:1,note:'Only Dune needs source evidence; source lacks language, so cover remains neutral. Request is optional/deferred.'}},measurements},null,2));
console.log(JSON.stringify({bookLocaleRecords:records.length,serverRoutes:server.results.length,final:measurements.filter(m=>m.phase==='final-reviewed-mobile')}));
