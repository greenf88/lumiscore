import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const targets=[['148','https://covers.openlibrary.org/b/id/52093-L.jpg?default=false'],['228','https://images.penguinrandomhouse.com/cover/9780440418566'],['553','https://covers.openlibrary.org/b/id/14840896-L.jpg?default=false']];
const dir=resolve(process.argv[2]??'../../outputs/remaining-covers-20261023');mkdirSync(dir,{recursive:true});
const rows=[];
for(const [workId,url] of targets){try{const r=await fetch(url,{signal:AbortSignal.timeout(15000)}),b=Buffer.from(await r.arrayBuffer());const row={workId,url,status:r.status,contentType:r.headers.get('content-type'),bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};if(r.ok&&row.contentType?.startsWith('image/')){row.file=resolve(dir,workId+'.jpg');writeFileSync(row.file,b);}rows.push(row);}catch(e){rows.push({workId,url,error:String(e)});}}
writeFileSync(resolve('catalog/remaining-covers-20261023/image-probes.json'),JSON.stringify({checkedAt:new Date().toISOString(),rows:rows.map(({file,...row})=>{void file;return row;})},null,2)+'\n');console.log(JSON.stringify(rows,null,2));
