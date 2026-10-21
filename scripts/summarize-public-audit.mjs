// Reuse saved responses; this command does not make network requests.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const [input,out]=process.argv.slice(2);
if(!input||!out)throw Error('Usage: summarize-public-audit.mjs RAW.json OUTPUT_DIRECTORY');
const audit=JSON.parse(await readFile(input,'utf8'));
const results=audit.results.map(r=>{
 const text=r.serverMainText??'',status=r.flags.includes('edition_unavailable')?'edition_unavailable':r.flags.includes('neutral_cover')||r.flags.includes('description_missing_or_uncertain')?'incomplete_information':'technically_usable_indexing_cause_unknown';
 return {originalUrl:r.originalUrl,lastCrawled:r.lastCrawled,checkedAt:r.checkedAt,status:r.status,redirects:r.chain,
  finalUrl:r.finalUrl,route:r.route,language:r.lang,workId:r.workId,collection:r.collection,
  title:r.title,h1:r.h1,description:r.description,canonical:r.canonical,hreflang:r.hreflang,
  robots:r.robots,xRobotsTag:r.headers?.['x-robots-tag'],serverTextPresent:r.serverMainTextLength>100,serverMainText:r.serverMainText,
  editionStatus:r.flags.includes('edition_unavailable')?'no permitted edition; Work identity retained':'edition visible',
  selectedLanguage:text.match(/(?:Language|Taal)\s+(ENG|NLD|DUT)\b/)?.[1]??null,
  displayedIsbn:text.match(/ISBN-13\s+(\d{13})/)?.[1]??null,
  descriptionStatus:r.descriptionStatus,covers:r.covers,actualImageLoad:r.actualImageLoad,
  publicScore:text.match(/LumiScore\s+(—|\d+\.\d+)/)?.[1]??null,
  sitemapOriginal:r.sitemapOriginal,sitemapCanonical:r.sitemapCanonical,jsonLdValid:r.jsonLd?.every(j=>j.valid),
  ttfbMs:r.ttfbMs,serverH1Ms:r.firstH1Ms,totalMs:r.totalMs,flags:r.flags,destinationClassification:status,suggestedAction:r.suggestedAction};
});
await mkdir(out,{recursive:true});
await writeFile(resolve(out,'search-console-84-audit.json'),JSON.stringify({...audit,results},(k,v)=>k==='setup'?v:v,2));
console.log(JSON.stringify({urls:results.length,destinationClasses:results.reduce((a,r)=>(a[r.destinationClassification]=(a[r.destinationClassification]??0)+1,a),{})}));
