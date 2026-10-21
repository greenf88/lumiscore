// Bounded, public GET audit of the image URLs attached to existing verified
// editions. Does not establish edition identity from an image response.
import {readFile,writeFile} from 'node:fs/promises';
import {selectStrictEdition,withStrictEdition} from '../../lib/books/strict-edition.ts';
import {editionSourceCoverUrls} from '../../lib/books/edition-cover-evidence.ts';
import {getOpenLibraryCoverVariantUrl} from '../../lib/books/covers.ts';
const root=new URL('../../catalog/editorial-parity-20261021/',import.meta.url);
const baseline=JSON.parse(await readFile(new URL('production-public-baseline.json',root),'utf8'));
const research=JSON.parse(await readFile(new URL('source-research.json',root),'utf8'));
const targets=[];
for(const locale of ['nl','en'])for(const work of baseline.rows){
 const edition=selectStrictEdition(work.editions,locale,work.title);if(!edition)continue;
 const book=withStrictEdition({id:'work-'+work.id,workId:String(work.id),source:'supabase',title:work.title,author:work.author,cover:'orbit',score:null,ratingsCount:null,match:null,openLibraryWorkId:work.open_library_id},edition,locale);
 const cover=editionSourceCoverUrls(book,research.editions.data.result['/books/'+edition.open_library_edition_id])[0];
 if(cover)targets.push({workId:work.id,locale,editionId:edition.id,url:cover});
}
function dimensions(bytes){
 const b=Buffer.from(bytes);
 if(b[0]!==0xff||b[1]!==0xd8)return null;
 let p=2;while(p+9<b.length){if(b[p]!==0xff){p++;continue;}const marker=b[p+1];if(marker===0xd9||marker===0xda)break;if(marker===0xd8){p+=2;continue;}const length=b.readUInt16BE(p+2);if(length<2)break;if([0xc0,0xc1,0xc2,0xc3].includes(marker))return {width:b.readUInt16BE(p+7),height:b.readUInt16BE(p+5)};p+=2+length;}return null;
}
const urls=[...new Set(targets.flatMap(t=>['M','L'].map(size=>getOpenLibraryCoverVariantUrl(t.url,size))))];
if(urls.length>20)throw Error('Bound exceeded');
const results=[];
for(let start=0;start<urls.length;start+=3)await Promise.all(urls.slice(start,start+3).map(async url=>{
 const started=Date.now();try{const response=await fetch(url,{signal:AbortSignal.timeout(12000)});const bytes=await response.arrayBuffer();results.push({url,status:response.status,contentType:response.headers.get('content-type'),bytes:bytes.byteLength,dimensions:dimensions(bytes),ms:Date.now()-started});}catch(error){results.push({url,status:null,error:error.message,ms:Date.now()-started});}
}));
await writeFile(new URL('image-http-audit.json',root),JSON.stringify({checkedAt:new Date().toISOString(),targets,results},null,2));
console.log(JSON.stringify({requests:results.length,failures:results.filter(r=>r.status!==200||!r.dimensions),over300kb:results.filter(r=>r.bytes>300000).map(r=>({url:r.url,bytes:r.bytes}))}));
