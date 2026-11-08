// Existing official CLI authorization only. No credential extraction/export.
import{readFile,writeFile,mkdir,unlink}from'node:fs/promises';import{createHash}from'node:crypto';
import{execFile}from'node:child_process';import{promisify}from'node:util';
const run=promisify(execFile),origin='https://lumiscore-ae6yeffmi-rgkgroeneveld-9102.vercel.app';
const cli=process.env.VERCEL_CLI_ENTRY??'C:/Users/rickg/AppData/Roaming/npm/node_modules/vercel/dist/vc.js';
const uas={desktop:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',mobile:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',googlebot:'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'};
const paths=['/nl','/en','/en/browse','/nl/browse','/en/browse?page=2','/en/book/928100001','/nl/book/928100001','/en/collection/dune','/nl/collection/dune','/nl/taste-test','/en/taste-test','/en/book/999999999'];
const out='outputs/seo-reliability-20261107/hosted-http';await mkdir(out+'/responses',{recursive:true});const rows=[];
for(const path of paths)for(const[ua,userAgent]of Object.entries(uas)){
 const file='responses/'+createHash('sha256').update(path+ua).digest('hex').slice(0,18)+'.html',headersFile=out+'/current-headers.tmp',start=performance.now();
 await run(process.execPath,[cli,'curl',origin+path,'--scope','rgkgroeneveld-9102','--','--silent','--show-error','--max-time','30','--user-agent',userAgent,'--dump-header',headersFile,'--output',out+'/'+file],{windowsHide:true,timeout:45000,maxBuffer:100000});
 const raw=await readFile(headersFile,'utf8');await unlink(headersFile);const status=Number([...raw.matchAll(/^HTTP\/\S+ (\d+)/gm)].at(-1)?.[1]);
 const headers=Object.fromEntries(raw.split(/\r?\n/).filter(l=>/^(x-robots-tag|x-vercel-cache):/i.test(l)).map(l=>{const i=l.indexOf(':');return[l.slice(0,i).toLowerCase(),l.slice(i+1).trim()];}));
 const text=await readFile(out+'/'+file,'utf8');if(![200,404].includes(status)||text.includes('Log in to Vercel'))throw Error('Protected request unavailable '+status+' '+path);
 rows.push({path,ua,requestUserAgent:userAgent,status,ms:performance.now()-start,previewXRobots:headers['x-robots-tag']??null,cache:headers['x-vercel-cache']??null,file,sha256:createHash('sha256').update(text).digest('hex')});
}
await writeFile(out+'/responses.json',JSON.stringify({applicationSha:'63a1902aca4113c28380d4a8128ffda101ccbab2',origin,at:new Date().toISOString(),method:'Complete original HTML; authorized protected TEST Preview; app guest; UA simulations only; protection header separate from application robots.',rows},null,2));console.log(JSON.stringify({requests:rows.length,origin}));
