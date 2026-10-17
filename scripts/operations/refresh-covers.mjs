// Explicit, bounded cache refresh through the existing production resolver.
// No direct SQL updates, identity changes or arbitrary endpoint input.
import {readFile,writeFile} from 'node:fs/promises';
const args=process.argv.slice(2);
if(args.length!==3 || args[0]!=='--refresh') throw new Error('Usage: refresh-covers.mjs --refresh PRIVATE_QUEUE.json PRIVATE_RESULT.json');
const queue=JSON.parse(await readFile(args[1],'utf8'));
if(!Array.isArray(queue)||queue.length>24||new Set(queue.map(x=>x.id)).size!==queue.length
  ||queue.some(x=>!Number.isSafeInteger(x.id)||x.id<=0||typeof x.title!=='string'||typeof x.author!=='string'))
  throw new Error('Invalid bounded exact-Work queue.');
const results=[];
for(const work of queue){
  const params=new URLSearchParams({title:work.title,author:work.author,lumiScoreWorkId:String(work.id)});
  const olid=work.open_library_id?.split('/').at(-1);
  if(/^OL\d+W$/i.test(olid??''))params.set('workId',olid);
  if(/^\d{13}$/.test(work.isbn13??''))params.set('isbn13',work.isbn13);
  if(work.first_publish_year)params.set('year',String(work.first_publish_year));
  if(!params.has('workId')&&!params.has('isbn13')){results.push({workId:work.id,status:'no-exact-lookup'});continue;}
  try{
    const response=await fetch('https://lumisco.re/api/open-library/covers?'+params,{
      signal:AbortSignal.timeout(35_000),headers:{'User-Agent':'LumiScore-Automation/1.0 (bounded cover-cache maintenance)'}});
    const body=await response.json();
    results.push({workId:work.id,httpStatus:response.status,state:body.state??null,
      coverUrls:Array.isArray(body.coverUrls)?body.coverUrls:[],cache:response.headers.get('x-vercel-cache')});
  }catch(error){results.push({workId:work.id,status:'request-failed',error:error.name});}
  await writeFile(args[2],JSON.stringify({capturedAt:new Date().toISOString(),kind:'existing-resolver-cache-refresh',results},null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify(results.at(-1)));
  await new Promise(resolve=>setTimeout(resolve,750));
}
await writeFile(args[2],JSON.stringify({capturedAt:new Date().toISOString(),kind:'existing-resolver-cache-refresh',results},null,2)+'\n',{mode:0o600});
