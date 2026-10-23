// Bounded public bibliography/source research; no catalog writes or credentials.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const dir=resolve('catalog/remaining-covers-20261023');mkdirSync(dir,{recursive:true});
const urls=[
 'https://openlibrary.org/books/OL10925015M.json',
 'https://openlibrary.org/books/OL10943545M.json',
 'https://openlibrary.org/books/OL46205129M.json',
 ...['9780064471107','9780008662950','9780440418566','9780375823350','9780349132617','9781837901326'].map(i=>'https://openlibrary.org/isbn/'+i+'.json'),
 'https://www.hachettebookgroup.com/titles/freida-mcfadden/the-housemaids-secret/9781538742587/',
 'https://www.littlebrown.com/titles/freida-mcfadden/the-housemaids-secret/9780349132617/',
 'https://www.hachette.co.uk/titles/freida-mcfadden/the-housemaids-secret/9780349132617/',
 'https://collins.co.uk/products/9780008662950.js',
 'https://www.penguinrandomhouse.com/books/136441/his-dark-materials-the-amber-spyglass-book-3-by-philip-pullman/',
 'https://books.google.com/books?vid=ISBN9781538742587',
 'https://openlibrary.org/authors/OL7386651A.json',
 'https://openlibrary.org/authors/OL8384995A.json',
 'https://www.littlebrown.co.uk/titles/freida-mcfadden/the-housemaids-secret/9780349132617/',
];
const results=[];
for(let start=0;start<urls.length;start+=2)await Promise.all(urls.slice(start,start+2).map(async url=>{
 const began=Date.now();try{const r=await fetch(url,{signal:AbortSignal.timeout(15000)}),h=await r.text();
 const row={url,status:r.status,finalUrl:r.url,elapsedMs:Date.now()-began};
 if(r.ok&&/openlibrary.org/.test(url)){const b=JSON.parse(h);row.facts={key:b.key,name:b.name,title:b.title,subtitle:b.subtitle,authors:b.authors,works:b.works,languages:b.languages,isbn13:b.isbn_13,isbn10:b.isbn_10,covers:b.covers,publishers:b.publishers,publishDate:b.publish_date,format:b.physical_format};}
 else if(r.ok&&url.endsWith('.js')){const b=JSON.parse(h);row.facts={title:b.title,images:b.images,variants:b.variants?.map(v=>({title:v.title,barcode:v.barcode,sku:v.sku}))};}
 else if(r.ok){row.title=h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];row.images=[...h.matchAll(/<img\b[^>]*>/gi)].map(m=>m[0]).filter(m=>/9780440418566|9780349132617|9781538742587/.test(m)).map(m=>({src:m.match(/(?:data-)?src=["']([^"']+)/)?.[1],alt:m.match(/alt=["']([^"']+)/)?.[1]})).slice(0,6);row.isbns=[...new Set(h.match(/97[89][0-9]{10}/g)??[])].slice(0,20);row.structured=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m=>{try{const b=JSON.parse(m[1]);const e=b.mainEntity??b;return {type:e['@type'],name:e.name,author:e.author,isbn:e.isbn,inLanguage:e.inLanguage,image:e.image};}catch{return null;}}).filter(x=>x?.isbn);}
 results.push(row);
 }catch(e){results.push({url,error:String(e),elapsedMs:Date.now()-began});}
}));
const report={checkedAt:new Date().toISOString(),concurrency:2,timeoutMs:15000,results};
writeFileSync(resolve(dir,'source-probes.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checkedAt:report.checkedAt,results:results.map(r=>({url:r.url,status:r.status,finalUrl:r.finalUrl,title:r.title,facts:r.facts,images:r.images,structured:r.structured,error:r.error}))},null,2));
