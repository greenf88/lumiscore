// Actual built app against existing PUBLIC metadata. Only allowlisted reads.
// External optional providers are failed locally, never faulted on production.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
const mode=process.argv[2];if(!['test','production'].includes(mode))throw Error('Expected read-only environment');
const config=Object.fromEntries((await readFile(mode==='test'?'.env.test-readonly.local':'.env.readonly.local','utf8')).split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const at=l.indexOf('=');return[l.slice(0,at),l.slice(at+1).replace(/^['"]|['"]$/g,'')];}));
const origin=config.NEXT_PUBLIC_SUPABASE_URL,key=config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(new URL(origin).hostname!==(mode==='test'?'hlvujbrmfdlrfxdjwsmb':'qvplwejffhjvxaypmjut')+'.supabase.co'||!key)throw Error('Wrong public project');
const networkFetch=globalThis.fetch;
const api=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1:45431'),method=req.method??'GET';
 const readonlyRpc=['/rest/v1/rpc/catalog_browse_page_v3','/rest/v1/rpc/get_work_rating_summaries_v2'];
 const publicTables=['works','editions','authors','collections','collection_books','catalog_categories','catalog_work_categories','catalog_edition_metadata','catalog_work_descriptions','catalog_description_snapshots','cover_resolutions','work_traits','trait_definitions','work_series','series'];
 if(!(method==='GET'&&publicTables.includes(url.pathname.split('/').at(-1)))&&!(method==='POST'&&readonlyRpc.includes(url.pathname)))throw Error('Blocked nonallowlisted operation '+method+' '+url.pathname);
 let body='';for await(const chunk of req)body+=chunk;
 const r=await networkFetch(origin+url.pathname+url.search,{method,headers:{apikey:key,Authorization:'Bearer '+key,'content-type':'application/json',accept:req.headers.accept??'application/json'},body:method==='POST'?body:undefined,signal:AbortSignal.timeout(15000)});
 res.writeHead(r.status,{'content-type':r.headers.get('content-type')??'application/json'});res.end(await r.text());
 }catch(error){res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({message:String(error.message).slice(0,150)}));}});
await new Promise(r=>api.listen(45431,'127.0.0.1',r));
globalThis.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(url.hostname==='127.0.0.1')return networkFetch(input,init);
 return Promise.resolve(new Response(JSON.stringify({error:'Isolated optional-provider fault simulation'}),{status:503,headers:{'content-type':'application/json'}}));};
const app=(await import('../.vercel/output/functions/__server.func/index.mjs')).default;
const server=createServer(async(req,res)=>{try{
 const response=await app.fetch(new Request('http://127.0.0.1:45432'+req.url,{method:'GET',headers:req.headers}),{waitUntil:p=>p.catch(()=>{})});
 res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end();
 }catch{res.writeHead(500);res.end('Read-only fixture failure');}});
await new Promise(r=>server.listen(45432,'127.0.0.1',r));
console.log('READONLY_BUILT_READY '+mode);
