// Read-only, bounded investigation; existing Vercel CLI auth. No env/secret exports.
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
const out=new URL('../../outputs/seo-cause-20261104/',import.meta.url);await fs.mkdir(out,{recursive:true});
const cli='C:/Users/rickg/AppData/Roaming/npm/node_modules/vercel/dist/vc.js';
const base=['--scope','rgkgroeneveld-9102','--project','prj_44WeKduJU042ZAI85eAifSWwoY0i','--environment','production','--since','2026-10-18T00:00:00Z','--until','2026-11-01T00:00:00Z','--granularity','1d','--limit','100','--json'];
const targets=['/nl','/en','/en/zo-werkt-het','/en/imdb-for-books','/en/book/8856','/book/8856','/nl/book/7220','/nl/collection/suzanne-vermeer','/nl/toplijsten/fantasy-om-mee-te-beginnen','/nl/toplijsten/na-project-hail-mary'];
const jobs=[
 ['google-day-status',['vercel.request.count','--aggregation','count','--query','botName:googlebot','--group-by','botVerified','--group-by','httpStatus','--group-by','deploymentId']],
 ['google-source-ips',['vercel.request.count','--aggregation','count','--query','botName:googlebot','--group-by','clientIp','--group-by','botVerified']],
 ['google-priority-paths',['vercel.request.count','--aggregation','count','--query','botName:googlebot','--query','('+targets.map(x=>'requestPath:"'+x+'"').join(' OR ')+')','--group-by','requestPath','--group-by','httpStatus','--group-by','wafAction','--group-by','cacheResult','--group-by','deploymentId']],
 ['google-ua-status',['vercel.request.count','--aggregation','count','--query','clientUserAgent:*Googlebot*','--group-by','botName','--group-by','botVerified','--group-by','httpStatus','--group-by','wafAction']],
 ['inspection-ua-status',['vercel.request.count','--aggregation','count','--query','clientUserAgent:*Google-InspectionTool*','--group-by','botName','--group-by','botVerified','--group-by','httpStatus']],
 ['all-status',['vercel.request.count','--aggregation','count','--group-by','httpStatus','--group-by','deploymentId']],
 ['google-transfer-bytes',['vercel.request.fdt_out_bytes','--aggregation','sum','--query','botName:googlebot','--group-by','httpStatus']]
];
for(const[name,options]of jobs){const args=['metrics',...options,...base];const r=await new Promise(resolve=>{const c=spawn(process.execPath,[cli,...args],{stdio:['ignore','pipe','pipe'],windowsHide:true});let stdout='',stderr='';c.stdout.on('data',b=>stdout+=b);c.stderr.on('data',b=>stderr+=b);c.on('error',e=>resolve({error:String(e)}));c.on('close',code=>{try{resolve({code,data:JSON.parse(stdout)})}catch{resolve({code,error:stderr.slice(-1800)})}})});await fs.writeFile(new URL(name+'.json',out),JSON.stringify({collectedAt:new Date().toISOString(),args,...r},null,2));console.log(JSON.stringify({name,code:r.code,error:r.error,groups:r.data?.summary?.length,rows:r.data?.data?.length}));}
