// Reuses the previous bounded ISBN adapter. Explicit URLs only, no crawl or DB writes.
import fs from 'node:fs/promises';import{createHash}from'node:crypto';
const root=new URL('../catalog/nl-research-004-20261101/',import.meta.url);
const clean=s=>s.replace(/<script\b[\s\S]*?<\/script>/giu,'').replace(/<style\b[\s\S]*?<\/style>/giu,'').replace(/<[^>]*>/gu,' ').replaceAll('&amp;','&').replaceAll('&nbsp;',' ').replaceAll('&#039;',"'").replaceAll('&quot;','"').replace(/\s+/gu,' ').trim();
const h=x=>createHash('sha256').update(x).digest('hex');
await fs.mkdir(new URL('sources/',root),{recursive:true});
const input=JSON.parse(await fs.readFile(process.argv[2],'utf8'));if(input.length>16)throw Error('Explicit batch maximum16');
for(const p of input){
 if(!/^https:\/\/metadata\.isbn\.nl\/(?:search\.html\?search=|\d+\/)/u.test(p.url))throw Error('Unapproved source domain/path');
 const file=new URL('sources/'+p.name+'.json',root);let previousAttempt;try{const prior=JSON.parse(await fs.readFile(file));if(prior.error&&process.argv.includes('--network-now-authorized'))previousAttempt=prior;else{console.log(JSON.stringify({...prior,cached:true}));continue;}}catch{}
 const out={...p,at:new Date().toISOString(),scope:'Individual bibliography and content verification; no full publisher text retained',...(previousAttempt?{previousAttempts:[previousAttempt],changedCondition:'Network egress now authorized by sandbox reviewer; not a provider denial bypass'}:{})};
 try{const r=await fetch(p.url,{signal:AbortSignal.timeout(16000)}),html=await r.text();out.status=r.status;out.sha256=h(html);if(r.ok){
  const header=html.split(/<div class="main-container/u)[0];out.title=clean(header.match(/<h1[^>]*>([\s\S]*?)<\/h1>/u)?.[1]??'');
  out.authors=clean(html.match(/<dt>Auteur\(s\)<\/dt><dd>([\s\S]*?)<\/dd>/u)?.[1]??'');
  out.editions=html.split(/<div class="uitv">/u).slice(1).map(b=>b.split(/<div class="pd pd-inactive">/u)[0]).map(b=>({format:clean(b.match(/<div class="uvlabel">([\s\S]*?)<\/div>/u)?.[1]??''),facts:clean(b).split(' ').slice(0,100).join(' '),covers:[...b.matchAll(/<a[^>]+href="([^"]+\.(?:jpg|png|webp))"/giu)].map(m=>new URL(m[1].replaceAll('&amp;','&'),p.url).href)}));
  out.links=out.editions.length?[]:[...html.matchAll(/<a[^>]+href="([^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/giu)].map(m=>({url:new URL(m[1],p.url).href,label:clean(m[2])})).filter(x=>/^https:\/\/metadata\.isbn\.nl\/\d+\//u.test(x.url)&&!x.label).slice(0,10);
  const narrative=clean(html.match(/<meta name="(?:og:)?description" content="([\s\S]*?)"\s*\/>/u)?.[1]??'');out.narrative={sha256:h(narrative),words:narrative.split(' ').filter(Boolean).length,stored:false};
  const nl=out.editions.filter(e=>e.facts.includes('taal Nederlands'));
  console.log(JSON.stringify({...out,editions:nl.length?nl:out.editions.slice(0,2),premiseForReviewOnly:out.editions.length?narrative.split(' ').slice(0,150).join(' '):undefined}));
 }}catch(e){out.error=e.message;console.log(JSON.stringify(out));}
 await fs.writeFile(file,JSON.stringify(out,null,2)+'\n');await new Promise(r=>setTimeout(r,1700));
}
