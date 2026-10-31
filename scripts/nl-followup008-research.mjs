// Explicit per-Work public bibliography only. Discovery strings are NOT verified Dutch titles.
import fs from'node:fs/promises';import{createHash}from'node:crypto';
const root=new URL('../catalog/nl-followup-008-20261031/',import.meta.url),[mode,arg]=process.argv.slice(2),read=async n=>JSON.parse(await fs.readFile(new URL(n,root))),write=(n,x)=>fs.writeFile(new URL(n,root),JSON.stringify(x,null,2)+'\n');
const clean=s=>s.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replaceAll('&amp;','&').replaceAll('&nbsp;',' ').replaceAll('&#039;',"'").replaceAll('&quot;','"').replace(/\s+/g,' ').trim();
await fs.mkdir(new URL('sources/',root),{recursive:true});
if(mode==='prepare'){
 const rows=(await read('frozen100.json')).rows,q=await read('discovery-queries.json');if(q.length!==100||rows.some(r=>!q.some(q=>q[0]===r.workId)))throw Error('Frozen100 mismatch');
 for(let i=0;i<q.length;i+=16)await write('search-'+(i/16+1)+'.json',q.slice(i,i+16).map(([workId,query])=>({workId,name:'search-'+workId,url:'https://metadata.isbn.nl/search.html?search='+encodeURIComponent(query)})));console.log('100 explicit bibliography queries; no Dutch title/language inferred');
}else if(mode==='pages'){
 const rows=(await read('frozen100.json')).rows,pages=[],choices=await read('page-choices.json');for(const r of rows){let s;try{s=await read('sources/search-'+r.workId+'.json');}catch{continue;}const chosen=Object.hasOwn(choices.overrides,String(r.workId))?choices.overrides[r.workId]:s.links?.[0]?.url;if(chosen)pages.push({workId:r.workId,name:'title-'+r.workId,url:chosen,warning:choices.warnings[r.workId]??null});}
 for(let i=0;i<pages.length;i+=16)await write('pages-'+(i/16+1)+'.json',pages.slice(i,i+16));console.log(JSON.stringify({discoveryPages:pages.length,unresolved:100-pages.length,note:'First search hit is only an inspected candidate, never an automatic approval'}));
}else if(mode==='fetch'){
 const pages=await read(arg);if(pages.length>16)throw Error('Maximum16 explicit requests');
 for(const p of pages){const file=new URL('sources/'+p.name+'.json',root);try{await fs.access(file);console.log('retained '+p.workId);continue;}catch{}
  if(!/^https:\/\/metadata\.isbn\.nl\/(search\.html\?search=|\d+\/)/.test(p.url))throw Error('Unreviewed host/path');
  const out={...p,checkedAt:new Date().toISOString(),interpretation:'Public bibliography/content source inspected, candidate only until exact Work/author/edition/language/cover/narrative review',fullNarrativeStored:false};
  try{const response=await fetch(p.url,{signal:AbortSignal.timeout(15000)}),html=await response.text();out.status=response.status;out.sha256=createHash('sha256').update(html).digest('hex');if(response.ok){out.title=clean(html.split(/<div class="main-container/)[0].match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]??'');out.authors=clean(html.match(/<dt>Auteur\(s\)<\/dt><dd>([\s\S]*?)<\/dd>/)?.[1]??'');
   out.editions=html.split(/<div class="uitv">/).slice(1).map(b=>b.split(/<div class="pd pd-inactive">/)[0]).map(b=>({format:clean(b.match(/<div class="uvlabel">([\s\S]*?)<\/div>/)?.[1]??''),facts:clean(b).split(' ').slice(0,90).join(' '),covers:[...b.matchAll(/<a[^>]+href="([^"]+\.(?:jpg|png|webp))"/gi)].map(m=>new URL(m[1].replaceAll('&amp;','&'),p.url).href)}));
   out.links=out.editions.length?[]:[...html.matchAll(/<a[^>]+href="([^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({url:new URL(m[1],p.url).href,label:clean(m[2])})).filter(l=>l.label===''&&/^https:\/\/metadata\.isbn\.nl\/\d+\//.test(l.url)).slice(0,10);
  }}catch(e){out.error=e.message;}
  await fs.writeFile(file,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({workId:p.workId,status:out.status,title:out.title,authors:out.authors,links:out.links?.slice(0,2),editions:out.editions?.filter(e=>e.facts.endsWith('taal Nederlands')).map(e=>({format:e.format,facts:e.facts,covers:e.covers}))}));await new Promise(r=>setTimeout(r,1700));
 }
}else throw Error('prepare | pages | fetch explicit-file.json');
