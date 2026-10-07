// LOCAL ONLY: synthetic public API adapter for the visitor route; never contacts Supabase.
// No Auth sessions, hosted keys or public write endpoints. Synthetic raters exist only in memory.
import { createServer } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { setupDiscoveryFixture } from './discovery-test-fixture.mjs';
const content=JSON.parse(await readFile(new URL('../lib/catalog/top-lists.json',import.meta.url),'utf8'));
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
  grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
await setupDiscoveryFixture(db);
const works=content.books.map((b,i)=>({id:Number(b.workId),title:b.title,first_publish_year:b.originalYear,
  open_library_id:b.source.split('/').at(-1),source_type:'open_library',work_type:'novel',cover_id:null,author_id:i+1,
  authors:{id:i+1,name:b.author},editions:[{id:9900000+i,work_id:Number(b.workId),language:'eng',title:b.title,isbn_13:null,isbn_10:null,open_library_edition_id:null,publisher:'Local visitor fixture'}]}));
// Identical, deterministic local data for before/after measurements; never production writes.
for(const work of works){
  await db.query('insert into public.authors(id,name) values ($1,$2) on conflict(id) do update set name=excluded.name',[work.author_id,work.authors.name]);
  await db.query("insert into public.works(id,title,first_publish_year,author_id,source_type,work_type,native_identity_key) values ($1,$2,$3,$4,'lumiscore_native','novel',$5) on conflict(id) do update set title=excluded.title,first_publish_year=excluded.first_publish_year,author_id=excluded.author_id",[work.id,work.title,work.first_publish_year,work.author_id,'local-ui-'+work.id]);
}
for(let i=1;i<=5;i++){
  const id='cccccccc-0000-4000-8000-'+String(i).padStart(12,'0');
  await db.query('insert into auth.users(id) values ($1) on conflict do nothing',[id]);
  for(const [index,work] of works.entries())await db.query('insert into public.ratings(user_id,work_id,rating) values($1,$2,$3) on conflict(user_id,work_id) do update set rating=excluded.rating',[id,work.id,10-index%6]);
}
let metrics={requests:0,bytes:0,routes:{}};
const json=(res,data,status=200)=>{const body=JSON.stringify(data); metrics.bytes+=Buffer.byteLength(body??''); res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type,x-client-info','Access-Control-Allow-Methods':'GET,HEAD,POST,OPTIONS','Cache-Control':'no-store'});res.end(body);};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1:55441'),table=url.pathname.split('/').at(-1);
    if(url.pathname==='/__metrics'&&req.method==='GET'){const snapshot=structuredClone(metrics);return json(res,snapshot);}
    if(url.pathname==='/__metrics/reset'&&req.method==='POST'){metrics={requests:0,bytes:0,routes:{}};return json(res,{reset:true});}
    metrics.requests++;metrics.routes[req.method+' '+url.pathname]=(metrics.routes[req.method+' '+url.pathname]??0)+1;
    if(req.method==='OPTIONS') return json(res,null,204);
    if(url.pathname.startsWith('/auth/')) return json(res,{message:'No authenticated local visitor',code:'bad_jwt'},401);
    if(url.pathname.startsWith('/rest/v1/rpc/')){
      if(req.method!=='POST'||!['get_work_rating_summaries_v2','get_work_rating_summaries','get_work_rating_summary','catalog_discovery_page'].includes(table))
        return json(res,{code:'PGRST202',message:'Not supported by public visitor fixture'},404);
      let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return json(res,{message:'bounded fixture request'},413);}
      const args=JSON.parse(body);
      if(table==='catalog_discovery_page')return json(res,(await db.query('select public.catalog_discovery_page($1,$2,$3,$4,$5,$6,$7,$8,$9) as result',[args.p_query??'',args.p_categories??[],args.p_selection??'',args.p_languages??[],args.p_sort??'az',args.p_page??1,args.p_page_size??32,args.p_alias_ids??[],args.p_author_id??null])).rows[0].result);
      const query=table==='get_work_rating_summary'?'select * from public.get_work_rating_summary($1::bigint)':
        'select * from public.'+table+'($1::bigint[])';
      const data=(await db.query(query,[args.target_work_id??args.target_work_ids])).rows;
      return json(res,req.headers.accept?.includes('vnd.pgrst.object')?(data[0]??null):data);
    }
    if(!['GET','HEAD'].includes(req.method))return json(res,{message:'Writes forbidden'},405);
    let data=table==='works'?works:table==='authors'?works.map(w=>w.authors):[];
    const filter=url.searchParams.get('id');
    if(filter?.startsWith('eq.'))data=data.filter(row=>String(row.id)===filter.slice(3));
    if(filter?.startsWith('in.('))data=data.filter(row=>filter.slice(4,-1).split(',').includes(String(row.id)));
    if(table==='works'&&req.headers.prefer?.includes('count=exact'))res.setHeader('Content-Range','0-'+Math.max(0,data.length-1)+'/'+data.length);
    const columns=url.searchParams.get('select');
    if(columns==='id,title')data=data.map(({id,title})=>({id,title}));
    if(req.headers.accept?.includes('vnd.pgrst.object'))return json(res,data[0]??null);
    return json(res,data);
  } catch { return json(res,{message:'Local visitor fixture failed'},500); }
});
server.listen(55441,'127.0.0.1',()=>console.log('LOCAL SYNTHETIC READ-ONLY VISITOR API — http://127.0.0.1:55441 — NO HOSTED CONNECTION'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await db.close();process.exit(0);}));
