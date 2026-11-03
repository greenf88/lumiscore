import fs from'node:fs';
import{PRIOR}from'./nl-continuation-bootstrap.mjs';
const {loadSnapshot}=await import(new URL('scripts/nl-scale-snapshot.mjs',PRIOR));
const snap=loadSnapshot(),id=Number(process.argv[2]),w=snap.works.find(w=>w.id===id);
const e=snap.editions.filter(e=>e.work_id===id);
const source=JSON.parse(fs.readFileSync(new URL('.research-cache/nl-scale-20261102/editions-extract.json',PRIOR),'utf8'));
const records=source.records??[];
console.log(JSON.stringify({work:w,author:snap.authors.find(a=>a.id===w?.author_id),editions:e,metadata:snap.metadata.filter(m=>m.work_id===id),descriptions:snap.descriptions.filter(d=>d.work_id===id),sourceEditions:records.filter(r=>e.some(e=>r.record?.key==='/books/'+e.open_library_edition_id))},null,2));
