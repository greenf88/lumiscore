// Normalize only already verified local archive members; performs no network calls.
import fs from 'node:fs';
import {ROOT,CACHE,hash} from './nl-continuation-bootstrap.mjs';
const phase=process.argv[2];if(!/^\d{3}$/.test(phase??''))throw Error('Explicit phase required');
const rows=JSON.parse(fs.readFileSync(new URL('cover-largezip-readback-'+phase+'.json',ROOT)));
fs.mkdirSync(new URL('covers/',CACHE),{recursive:true});
let count=0;
for(const r of rows){
 if(!r.sha256)continue;
 const b=fs.readFileSync(new URL('archive-covers/'+r.coverId+'-largezip.jpg',CACHE));
 if(hash(b)!==r.sha256||b.length!==r.bytes)throw Error('Verified archive member changed');
 const target=new URL('covers/'+r.coverId+'-L.jpg',CACHE),receipt=new URL('cover-normal-'+r.coverId+'.json',ROOT);
 if(fs.existsSync(target)&&hash(fs.readFileSync(target))!==r.sha256)throw Error('Existing cover bytes differ');
 if(fs.existsSync(receipt)){if(JSON.parse(fs.readFileSync(receipt)).sha256!==r.sha256)throw Error('Existing receipt differs');}
 else fs.writeFileSync(receipt,JSON.stringify({...r,source:'official_large_bulk_exact_member',decodeAndIdentityPending:true},null,2)+'\n');
 fs.writeFileSync(target,b);count++;
}
console.log(JSON.stringify({phase,normalized:count,networkRequests:0}));
