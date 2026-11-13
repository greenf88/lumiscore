// Loopback only, same existing isolated test data for both built versions.
// This is a lab bridge, never an app route or deployment proxy.
import {createServer} from 'node:http';import{readFile,stat}from'node:fs/promises';import{resolve,sep}from'node:path';import{pathToFileURL}from'node:url';import{Readable}from'node:stream';
import{canOptimizeCover,COVER_WIDTHS}from'../lib/books/cover-delivery.ts';
import{brotliCompressSync,createGzip,constants}from'node:zlib';
const label=process.argv[2];if(!['baseline','candidate'].includes(label))throw Error('Unexpected version');
const settings=Object.fromEntries((await readFile('.env.test-readonly.local','utf8')).split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
const origin=settings.NEXT_PUBLIC_SUPABASE_URL,key=settings.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(new URL(origin).hostname!=='hlvujbrmfdlrfxdjwsmb.supabase.co'||!key)throw Error('Only the existing test public configuration');
const networkFetch=globalThis.fetch;
if(label==='baseline'){
 const api=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1'),method=req.method??'GET';
 const tables=['works','editions','authors','collections','collection_books','catalog_categories','catalog_work_categories','catalog_edition_metadata','catalog_work_descriptions','catalog_description_snapshots','cover_resolutions','work_traits','trait_definitions','work_series','series'];
 if(!(method==='GET'&&tables.includes(u.pathname.split('/').at(-1)))&&!(method==='POST'&&['/rest/v1/rpc/catalog_browse_page_v3','/rest/v1/rpc/get_work_rating_summaries_v2'].includes(u.pathname)))throw Error('Read-only bridge refused operation');
 let body='';for await(const c of req)body+=c;const r=await networkFetch(origin+u.pathname+u.search,{method,headers:{apikey:key,Authorization:'Bearer '+key,'content-type':'application/json',accept:req.headers.accept??'application/json'},body:method==='POST'?body:undefined,signal:AbortSignal.timeout(15000)});
 res.writeHead(r.status,{'content-type':r.headers.get('content-type')??'application/json'});res.end(await r.text());
 }catch{res.writeHead(502);res.end('{}');}});await new Promise(r=>api.listen(45431,'127.0.0.1',r));
}
globalThis.fetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);return u.hostname==='127.0.0.1'?networkFetch(input,init):Promise.resolve(new Response('{}',{status:503}));};
const build=resolve(label==='baseline'?'outputs/seo-next-20261108/baseline-output':'.vercel/output'),pub=resolve(build,'static');
const app=(await import(pathToFileURL(resolve(build,'functions/__server.func/index.mjs')).href)).default,port=label==='baseline'?45432:45433;
const staticCache=new Map();
const types={'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.avif':'image/avif','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1:'+port);
 if(u.pathname==='/_vercel/image'){
  if(!canOptimizeCover(u.searchParams.get('url')??'')||!COVER_WIDTHS.includes(Number(u.searchParams.get('w')))||u.searchParams.get('q')!=='75')throw Error('Not an allowed existing optimizer request');
  const r=await networkFetch('https://lumisco.re'+u.pathname+u.search,{headers:{accept:req.headers.accept??'image/avif,image/webp'},signal:AbortSignal.timeout(15000)});res.writeHead(r.status,{'content-type':r.headers.get('content-type')??'image/jpeg','cache-control':'public,max-age=3600'});res.end(Buffer.from(await r.arrayBuffer()));return;
 }
 const file=resolve(pub,'.'+decodeURIComponent(u.pathname));if(file.startsWith(pub+sep)){try{if((await stat(file)).isFile()){const ext=file.slice(file.lastIndexOf('.')),compressed=['.js','.css','.svg'].includes(ext)&&req.headers['accept-encoding']?.includes('br'),cacheKey=file+compressed;
 let bytes=staticCache.get(cacheKey);if(!bytes){bytes=await readFile(file);if(compressed)bytes=brotliCompressSync(bytes);staticCache.set(cacheKey,bytes);}
 res.writeHead(200,{'content-type':types[ext]??'application/octet-stream','cache-control':'public,max-age=3600',...(compressed?{'content-encoding':'br','vary':'accept-encoding'}:{})});res.end(bytes);return;}}catch{}}
 const response=await app.fetch(new Request(u,{method:'GET',headers:req.headers}),{waitUntil:p=>p.catch(()=>{})});const headers=Object.fromEntries(response.headers),compressed=response.body&&req.headers['accept-encoding']?.includes('gzip');
 if(compressed){headers['content-encoding']='gzip';delete headers['content-length'];headers.vary='accept-encoding';}res.writeHead(response.status,headers);if(response.body){const body=Readable.fromWeb(response.body);if(compressed)body.pipe(createGzip({flush:constants.Z_SYNC_FLUSH})).pipe(res);else body.pipe(res);}else res.end();
 }catch{res.writeHead(500);res.end('Isolated lab unavailable');}}).listen(port,'127.0.0.1',()=>console.log('READONLY_LAB '+label+' '+port));
