import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error('Input evidence directory and review output required');
const json = async path => JSON.parse(await readFile(join(input,path),'utf8'));
const browser = await json('hosted-browser-evidence.json');
const stats = values => {
 const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
 const middle=Math.floor(sorted.length/2);
 return {n:sorted.length,min:sorted[0],median:sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2,max:sorted.at(-1)};
};
const http=[];
for(const mode of ['preview','production']){
 const data=await json(mode==='preview'?'hosted-http/preview-http-measurements.json':'production-http/production-http-measurements.json');
 for(const route of new Set(data.results.map(r=>r.route))){
  const rows=data.results.filter(r=>r.route===route);
  http.push({mode,route,ttfbMs:stats(rows.map(r=>r.ttfbMs)),completeResponseMs:stats(rows.map(r=>r.totalMs)),
   h1StreamMs:stats(rows.map(r=>r.h1StreamObservedMs)),http:rows.map(r=>r.http),headers:rows[0].headers,robots:rows[0].robots,canonical:rows[0].canonical,jsonLdValid:rows.every(r=>r.jsonLdValid),
   caveat:'Three sequential repeats, no cold-cache guarantee; preview test catalog differs from production. Not LCP.'});
 }
}
const coverKey=src=>src?.replace(/-[MLS]\.jpg/,'.jpg');
const dystopia=browser.details.map(d=>{
 const c=browser.list[d.locale].find(c=>c.id===d.id);
 return {workId:Number(d.id.replace('work-',''))-921100000,testWorkId:d.id.replace('work-',''),locale:d.locale,
  title:d.h1,titleParity:c.title===d.h1,score:d.score,scoreParity:c.score===d.score,
  coverParity:coverKey(c.image[0]?.src)===coverKey(d.imgs[0]?.src),listImages:c.image,detailImages:d.imgs,
  isbn:d.body.match(/ISBN-13\s+(\d{13})/)?.[1]??null,overflow:d.scrollWidth>d.width,
  mainObservationMs:d.arrivedMs,coverObservationMs:d.loadObservedMs??null,
  descriptionState:/could not load|kon tijdelijk/.test(d.body)?'temporary_failure':/verified English description|geverifieerde.*beschrijving/.test(d.body)?'missing':'other'};
});
const result={at:new Date().toISOString(),codeSha:'b98268875dc011153bcd70926d9be1fa60048bdd',productionSha:'571108e181e2db406aac2886b3ee1eb08ac7f37d',preview:'https://lumiscore-7s94of4eo-rgkgroeneveld-9102.vercel.app',
 limits:['Windows in-app browser, actual375px mobile and1265px desktop; no physical phone or network throttling.','Browser timings are observed upper bounds, not LCP or measured interaction-to-paint.','One first production NL cover was still pending at1145ms; excluded from loaded-cover statistics.','No production writes/accounts/ratings. Test catalog483Works; local projection fixture10001Works.'],
 http,dystopia,fantasy:browser.fantasy,fantasyDetails:browser.fantasyDetails.map(({locale,id,url,h1,score,imgs})=>({locale,id,url,h1,score,imgs})),
 corrected:browser.corrected.map(({body,...d})=>({...d,englishUnavailable:body.includes('A verified English edition is not available.')})),
 browserTimings:browser.timings,productionBrowserTimings:browser.productionTimings,
 browserSummary:['nl','en'].map(locale=>({locale,previewMain:stats(browser.timings.filter(x=>x.kind==='list'&&x.locale===locale).map(x=>x.domObservedMs)),previewCover:stats(browser.timings.filter(x=>x.kind==='list'&&x.locale===locale&&x.image.complete&&x.image.w>0).map(x=>x.coverObservedMs)),productionMain:stats(browser.productionTimings.filter(x=>x.locale===locale).map(x=>x.domObservedMs)),productionCover:stats(browser.productionTimings.filter(x=>x.locale===locale&&x.image.complete&&x.image.w>0).map(x=>x.coverObservedMs))}))};
await mkdir(output,{recursive:true});
await writeFile(join(output,'hosted-verification.json'),JSON.stringify(result,null,2));
await copyFile(join(input,'local-browser-before-after.json'),join(output,'local-browser-before-after.json'));
await mkdir(join(output,'screenshots'),{recursive:true});
for(const name of ['hosted-dystopia-nl-ink-mobile.png','hosted-dystopia-en-paper-mobile.png','hosted-detail-en-paper-mobile.png','hosted-fantasy-en-paper-desktop.png','hosted-fantasy-detail-desktop.png','hosted-souvenir-nl-ink-desktop.png','hosted-dystopia-nl-ink-desktop.png'])await copyFile(join(input,name),join(output,'screenshots',name));
console.log(JSON.stringify({dystopiaPass:dystopia.filter(r=>r.titleParity&&r.scoreParity&&r.coverParity&&!r.overflow&&r.detailImages.every(i=>i.complete&&i.w>0)).length,total:dystopia.length,http,browserSummary:result.browserSummary},null,2));
