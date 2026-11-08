// Loopback-only HTTP-shaped synthetic data. Exercises the actual Vercel/Nitro
// production build, including the response middleware; no loader replacements,
// real credentials, provider requests, DB writes or personal data.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {Readable} from 'node:stream';
const root=process.cwd(), total=6377, calls=new Map();
const works=Array.from({length:total},(_,i)=>({id:i+1,title:`Synthetic book ${i+1}`,author_id:1,authors:{id:1,name:'Synthetic author'},first_publish_year:2000,open_library_id:null}));
const editions=works.flatMap(w=>['eng','nld'].map((language,i)=>({id:w.id*2+i,work_id:w.id,title:w.title,language,isbn_13:null,isbn_10:null,publisher:'Synthetic publisher',open_library_edition_id:null})));
function send(res,body,status=200){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));}
const api=createServer(async(req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1:45431');let raw='';for await(const part of req)raw+=part;
 if(u.pathname==='/rest/v1/rpc/catalog_browse_page_v3'){
  const p=JSON.parse(raw),mode=p.p_query??'',key=JSON.stringify(p),attempt=(calls.get(key)??0)+1;calls.set(key,attempt);
  if(mode==='timeout'){const t=setTimeout(()=>send(res,null,504),7000);t.unref();res.on('close',()=>clearTimeout(t));return;}
  if(mode==='flaky429'&&attempt<3){send(res,{message:'Synthetic quota'},429);return;}
  if(mode==='flaky503'&&attempt<3){send(res,{message:'Synthetic upstream'},503);return;}
  if(mode==='invalidjson'){res.writeHead(200,{'content-type':'application/json'});res.end('{invalid');return;}
  if(mode==='nulltotal'){send(res,{contract:'eligible-browse-v3',locale:p.p_locale,total:null,page:1,pageCount:1,pageSize:p.p_page_size,workIds:[]});return;}
  const n=mode==='emptycatalog'?0:total,pageCount=Math.max(1,Math.ceil(n/p.p_page_size)),page=Math.min(p.p_page,pageCount);
  send(res,{contract:'eligible-browse-v3',locale:p.p_locale,total:n,page,pageCount,pageSize:p.p_page_size,
    workIds:mode==='emptypayload'||n===0?[]:works.slice((page-1)*p.p_page_size,page*p.p_page_size).map(w=>w.id),facets:{},selectionCount:null});return;
 }
 if(u.pathname==='/rest/v1/rpc/get_work_rating_summaries_v2'){send(res,[]);return;}
 if(u.pathname==='/rest/v1/catalog_categories'){send(res,[{id:'fiction',label_nl:'Fictie',label_en:'Fiction'}]);return;}
 if(u.pathname==='/rest/v1/catalog_edition_metadata'){
  send(res,[{edition_id:2,work_id:1,bound_author_id:1,bound_title:'Synthetic book 1',bound_language:'eng',bound_isbn13:null,
   format:'paperback',cover_url:'https://covers.openlibrary.org/b/id/240727-L.jpg?default=false',card_cover_url:null,
   evidence_url:'https://openlibrary.org/books/OL7440033M',review_status:'approved'}]);return;
 }
 const table=u.pathname.split('/').at(-1);let rows=table==='works'?works:table==='editions'?editions:table==='authors'?[{id:1,name:'Synthetic author'}]:[];
 for(const field of ['id','work_id']){const f=u.searchParams.get(field);if(f?.startsWith('in.(')){const ids=f.slice(4,-1).split(',').map(Number);rows=rows.filter(r=>ids.includes(r[field]));}else if(f?.startsWith('gt.'))rows=rows.filter(r=>r[field]>Number(f.slice(3)));else if(f?.startsWith('eq.'))rows=rows.filter(r=>r[field]===Number(f.slice(3)));}
 const start=Number(u.searchParams.get('offset')??0),limit=Number(u.searchParams.get('limit')??1000);rows=rows.slice(start,start+limit);
 send(res,req.headers.accept?.includes('vnd.pgrst.object')?rows[0]??null:rows);
});
await new Promise(r=>api.listen(45431,'127.0.0.1',r));
const app=(await import('../.vercel/output/functions/__server.func/index.mjs')).default;
const server=createServer(async(req,res)=>{
 try {
  const path=new URL(req.url,'http://127.0.0.1:45432').pathname;
  if(path.startsWith('/_next/static/')||path.startsWith('/assets/')||path.startsWith('/fonts/')||path==='/favicon.ico'){
   const target=resolve(root,'.vercel/output/static','.'+decodeURIComponent(path));
   if(!target.startsWith(resolve(root,'.vercel/output/static')+sep)){res.writeHead(400);res.end();return;}
   const data=await readFile(target);const ext=target.split('.').at(-1),types={js:'text/javascript',css:'text/css',woff2:'font/woff2',avif:'image/avif',webp:'image/webp',svg:'image/svg+xml'};
   res.writeHead(200,{'content-type':types[ext]??'application/octet-stream'});res.end(data);return;
  }
  const request=new Request('http://127.0.0.1:45432'+req.url,{method:req.method,headers:req.headers});
  const response=await app.fetch(request,{waitUntil:p=>p.catch(()=>{})});
  res.writeHead(response.status,Object.fromEntries(response.headers));
  if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end();
 } catch {res.writeHead(500);res.end('Synthetic fixture server error');}
});
await new Promise(r=>server.listen(45432,'127.0.0.1',r));
console.log('BUILT_BROWSE_FIXTURE_READY http://127.0.0.1:45432/en/browse');
