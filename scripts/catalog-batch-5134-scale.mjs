// Local synthetic PostgreSQL/WASM measurements; not production latency estimates.
import {performance} from 'node:perf_hooks';
import fs from 'node:fs/promises';
import {createLocalDatabase} from './catalog-selection-local.mjs';
const results=[];
for(const count of [10134]){
 const db=await createLocalDatabase(undefined,[]);
 try{
  await db.exec(`insert into public.authors(id,name) select i,'Representative Author '||i from generate_series(1,500) i;
   insert into public.works(id,title,author_id,first_publish_year) select i,
     (case i%5 when 0 then 'Dutch Mystery ' when 1 then 'Fantasy Journey ' when 2 then 'Science Fiction Planet ' when 3 then 'Literary City ' else 'Thriller Night ' end)||lpad(i::text,5,'0'),
     1+(i%500),1950+(i%77) from generate_series(1,${count}) i;
   insert into public.editions(work_id,title,language) select i,'Edition translation '||i,case when i%4=0 then 'dut' else 'eng' end from generate_series(1,${count}) i;
   insert into public.catalog_categories values('fiction_fantasy','Fantasy','Fantasy'),('fiction_thriller_mystery','Thriller','Thriller');
   insert into public.work_catalog_categories select i,'fiction_fantasy' from generate_series(1,${count}) i where i%5=1;
   insert into public.work_catalog_categories select i,'fiction_thriller_mystery' from generate_series(1,${count}) i where i%5=0 or i%5=4;
   insert into public.catalog_selections values('lumiscore-selectie-1000','LumiScore Selectie','LumiScore Selection');
   insert into public.catalog_selection_members select 'lumiscore-selectie-1000',i,'LS1000-'||i from generate_series(1,974) i;
   -- These two indexes ALREADY EXIST in production (read-only verified 2026-10-03).
   -- Reproduce the deployed shape locally; do not propose/apply additional indexes.
   create index editions_work_id_idx on public.editions(work_id);
   create index works_author_id_idx on public.works(author_id);
   analyze;set statement_timeout='15s';`);
  const cases=[
   ['browse-32',['',[],'',[],'az',1,32,[]]],['browse-128',['',[],'',[],'az',1,128,[]]],
   ['deep-last-128',['',[],'',[],'az',999999,128,[]]],['newest-128',['',[],'',[],'newest',1,128,[]]],
   ['search-title',['Fantasy',[],'',[],'az',1,32,[]]],['search-author',['Representative Author 13',[],'',[],'az',1,32,[]]],
   ['search-edition',['Edition translation 13',[],'',[],'az',1,32,[]]],['search-no-match',['Definitely no match',[],'',[],'az',1,32,[]]],
   ['filter-language-nl',['',[],'',['nl'],'az',1,128,[]]],['filter-category',['',['fiction_fantasy'],'',[],'az',1,128,[]]],
   ['selection',['',[],'lumiscore-selectie-1000',[],'az',1,128,[]]]
  ];
  const query='select public.catalog_editorial_page($1,$2,$3,$4,$5,$6,$7,$8) as data';
  const measurements=[];
  for(const [name,params] of cases){
   const times=[];let data;
   await db.query(query,params);
   for(let i=0;i<5;i++){const start=performance.now();data=(await db.query(query,params)).rows[0].data;times.push(performance.now()-start);}
   times.sort((a,b)=>a-b);
   const plan=(await db.query('explain (analyze,buffers,format json) '+query,params)).rows[0]['QUERY PLAN'];
   measurements.push({name,total:data.total,returned:data.workIds.length,median_ms:Number(times[2].toFixed(2)),p95_ms:Number(times[4].toFixed(2)),runs:5,explain:plan});
  }
  const times=[],unique=new Set();let chunks;
  for(let run=0;run<5;run++){
   unique.clear();chunks=0;const start=performance.now();
   for(let offset=0;;offset+=1000){chunks++;const rows=(await db.query('select id from public.works order by id limit 1000 offset $1',[offset])).rows;for(const r of rows)unique.add(r.id);if(rows.length<1000)break;}
   times.push(performance.now()-start);
  }
  times.sort((a,b)=>a-b);if(unique.size!==count)throw Error('SITEMAP_COMPLETENESS_FAILED');
  measurements.push({name:'sitemap-all-id-chunks',total:unique.size,chunks,median_ms:Number(times[2].toFixed(2)),p95_ms:Number(times[4].toFixed(2)),runs:5});
  results.push({works:count,editions:count,measurements});console.log(JSON.stringify({works:count,measurements:measurements.map(m=>({name:m.name,total:m.total,median_ms:m.median_ms,p95_ms:m.p95_ms,chunks:m.chunks}))}));
 }finally{await db.close();}
}
await fs.writeFile(new URL('../catalog/expansion-5134/scale-results.json',import.meta.url),JSON.stringify({schema:'lumiscore-local-scale-1',engine:'PGlite 0.3.14 / PostgreSQL WASM; local in-memory; no HTTP/network/cover costs',indexes:'Existing V1 indexes plus the ALREADY DEPLOYED editions_work_id_idx and works_author_id_idx; no new index proposal or production changes.',cold_start_excluded:true,results},null,2)+'\n',{flag:'wx'});
