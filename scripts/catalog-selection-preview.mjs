// Test-only read-only PostgREST-shaped adapter for the persistent local PGlite DB.
// Bound to loopback. Unknown endpoints fail; no production credentials are read.
import http from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { localDirectory } from './catalog-selection-local.mjs';
const db=new PGlite(localDirectory(process.argv[2]));
await db.waitReady;
const server=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  res.setHeader('Access-Control-Allow-Origin','http://localhost:3982');
  res.setHeader('Access-Control-Allow-Headers','apikey,authorization,content-type,x-client-info');
  if(req.method==='OPTIONS'){res.end();return;}
  const url=new URL(req.url,'http://127.0.0.1:3970');
  const send=(data,status=200)=>{res.statusCode=status;res.end(JSON.stringify(data));};
  try {
    if(url.pathname==='/rest/v1/rpc/catalog_editorial_page' && req.method==='POST'){
      let text='';for await(const chunk of req){text+=chunk;if(text.length>20000)throw new Error('Body too large');}
      const p=JSON.parse(text);
      const result=await db.query('select public.catalog_editorial_page($1,$2,$3,$4,$5,$6,$7,$8) as data',
        [p.p_query,p.p_categories,p.p_selection,p.p_languages,p.p_sort,p.p_page,p.p_page_size,p.p_alias_ids]);
      send(result.rows[0].data);return;
    }
    if(url.pathname==='/rest/v1/rpc/get_work_rating_summaries'){send([]);return;}
    if(url.pathname==='/rest/v1/works' && req.method==='GET'){
      const filter=url.searchParams.get('id')??'';
      const ids=filter.replace(/^(in\.\(|eq\.)/,'').replace(/\)$/,'').split(',').map(Number).filter(n=>Number.isSafeInteger(n)&&n>0);
      if(!ids.length){send({message:'Preview only serves explicit Work IDs'},400);return;}
      const result=await db.query(`select w.*,jsonb_build_object('id',a.id,'name',a.name) as authors,
        coalesce((select jsonb_agg(to_jsonb(e)) from public.editions e where e.work_id=w.id),'[]'::jsonb) as editions
        from public.works w left join public.authors a on a.id=w.author_id where w.id=any($1)`,[ids]);
      if(req.headers.accept?.includes('vnd.pgrst.object'))send(result.rows[0]??null);
      else send(result.rows);
      return;
    }
    // Optional cover records and user-related lookups deliberately empty in this fixture.
    if(req.method==='GET'&&['/rest/v1/work_cover_resolutions','/rest/v1/book_cover_resolutions','/rest/v1/editions','/rest/v1/works_metadata','/rest/v1/work_metadata','/rest/v1/work_descriptions','/rest/v1/collection_items'].includes(url.pathname)){send([]);return;}
    console.log('UNSUPPORTED_PREVIEW',req.method,url.pathname);
    send({message:'Local preview endpoint not implemented',code:'PGRST202'},404);
  } catch(error){console.error('PREVIEW_ERROR',error.message);send({message:error.message},500);}
});
server.listen(3970,'127.0.0.1',()=>console.log('Local catalog preview adapter: http://127.0.0.1:3970 (read-only)'));
process.on('SIGINT',async()=>{server.close();await db.close();process.exit(0);});
