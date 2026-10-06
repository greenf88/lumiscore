// LOCAL ONLY: synthetic public API adapter for the visitor route; never contacts Supabase.
// No users/sessions, no hosted keys, no write endpoints. Actual privacy RPC bodies use PGlite.
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
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type,x-client-info','Access-Control-Allow-Methods':'GET,HEAD,POST,OPTIONS','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1:55441'),table=url.pathname.split('/').at(-1);
    if(req.method==='OPTIONS') return json(res,null,204);
    if(url.pathname.startsWith('/auth/')) return json(res,{message:'No authenticated local visitor',code:'bad_jwt'},401);
    if(url.pathname.startsWith('/rest/v1/rpc/')){
      if(req.method!=='POST'||!['get_work_rating_summaries_v2','get_work_rating_summaries','get_work_rating_summary'].includes(table))
        return json(res,{code:'PGRST202',message:'Not supported by public visitor fixture'},404);
      let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return json(res,{message:'bounded fixture request'},413);}
      const args=JSON.parse(body);
      const query=table==='get_work_rating_summary'?'select * from public.get_work_rating_summary($1::bigint)':
        'select * from public.'+table+'($1::bigint[])';
      const data=(await db.query(query,[args.target_work_id??args.target_work_ids])).rows;
      return json(res,req.headers.accept?.includes('vnd.pgrst.object')?(data[0]??null):data);
    }
    if(!['GET','HEAD'].includes(req.method))return json(res,{message:'Writes forbidden'},405);
    let data=table==='works'?works:table==='authors'?works.map(w=>w.authors):[];
    const filter=url.searchParams.get('id');
    if(filter?.startsWith('eq.'))data=data.filter(row=>String(row.id)===filter.slice(3));
    if(filter?.startsWith('in.'))data=data.filter(row=>filter.slice(3,-1).split(',').includes(String(row.id)));
    if(req.headers.accept?.includes('vnd.pgrst.object'))return json(res,data[0]??null);
    return json(res,data);
  } catch { return json(res,{message:'Local visitor fixture failed'},500); }
});
server.listen(55441,'127.0.0.1',()=>console.log('LOCAL SYNTHETIC READ-ONLY VISITOR API — http://127.0.0.1:55441 — NO HOSTED CONNECTION'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await db.close();process.exit(0);}));
