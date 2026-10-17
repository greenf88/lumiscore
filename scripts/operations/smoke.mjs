// Public HTTP/SEO smoke only. This is not a browser, login, visual or write test.
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export function inspectHtml(html, expectedUrl, status) {
  const tags=[...html.matchAll(/<link\b[^>]*>/gi)].map(x=>x[0]);
  const canonicals=tags.filter(x=>/\brel\s*=\s*["']canonical["']/i.test(x));
  const canonical=canonicals[0]?.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]?.replaceAll('&amp;','&');
  const robots=[...html.matchAll(/<meta\b[^>]*\bname\s*=\s*["']robots["'][^>]*>/gi)].map(x=>x[0]);
  return {status,canonical,canonicalCount:canonicals.length,robotsCount:robots.length,
    hasTitle:/<title>[^<]+<\/title>/i.test(html),
    language:html.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i)?.[1],
    ok:status===200 && canonicals.length===1 && canonical===expectedUrl && robots.length<=1
      && /<title>[^<]+<\/title>/i.test(html)};
}

export async function smoke(origin='https://lumisco.re') {
  if(origin!=='https://lumisco.re') throw new Error('Only the authorized LumiScore production origin is allowed.');
  const results=[];
  for(const path of ['/nl','/en','/nl/browse','/en/browse','/nl/collections','/en/collections',
    '/nl/collection/dune','/en/collection/dune','/nl/toplijsten/dystopie-vanaf-1990']) {
    try {
      const start=performance.now();
      const response=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(25_000),
        headers:{'User-Agent':'LumiScore-Automation/1.0 (public read-only quality check)'}});
      const html=await response.text();
      const inspected=inspectHtml(html,origin+path,response.status);
      results.push({path,...inspected,ok:inspected.ok && inspected.language===path.split('/')[1],milliseconds:Math.round(performance.now()-start)});
    }catch(error){results.push({path,ok:false,error:error.name});}
  }
  return {capturedAt:new Date().toISOString(),kind:'public-http-not-browser',results};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const output=await smoke();
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify(output,null,2));
  if(output.results.some(x=>!x.ok))process.exitCode=1;
}
