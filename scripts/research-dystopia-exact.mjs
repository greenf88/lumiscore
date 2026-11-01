import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../catalog/edition-recovery-20261031/sources/',import.meta.url);
const targets=[['oryx','https://openlibrary.org/isbn/9789035125414.json'],['flood','https://openlibrary.org/isbn/9789044613988.json'],['ketters-old','https://openlibrary.org/books/OL37806976M.json'],['heretics-en','https://openlibrary.org/isbn/9780593201763.json'],['inwijding-official','https://www.lannoo.com/nl-nl/young-adult/divergent-1-inwijding-9789000407392'],['oryx-isbn-search','https://metadata.isbn.nl/search.html?search=9789035125414'],['flood-isbn-search','https://metadata.isbn.nl/search.html?search=9789044613988'],['inwijding-isbn-search','https://metadata.isbn.nl/search.html?search=9789000407392']];
for(const [key,url] of targets){
 const file=new URL(key+'.json',root);try{await fs.access(file);continue;}catch{}
 const out={url,checkedAt:new Date().toISOString()};
 try{const r=await fetch(url,{signal:AbortSignal.timeout(18000)}),text=await r.text();Object.assign(out,{status:r.status,sha256:createHash('sha256').update(text).digest('hex')});
 if(url.endsWith('.json')){const d=JSON.parse(text);out.record=Object.fromEntries(['key','title','authors','works','languages','isbn_10','isbn_13','publishers','physical_format','publish_date','covers'].filter(k=>d[k]!==undefined).map(k=>[k,d[k]]));}
 else{out.links=[...new Set([...text.matchAll(/(?:href|src|content)="([^"<>]+)"/g)].map(m=>m[1].replaceAll('&amp;','&')).filter(u=>/\.jpg|\.png|\.webp|\/\d+\/.*\.html/.test(u)))].slice(0,30);out.facts=text.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').match(/EAN \(ISBN\).{0,650}/)?.[0];}
 }catch(e){out.error=e.message;}
 await fs.writeFile(file,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({key,...out}));await new Promise(r=>setTimeout(r,1500));
}
