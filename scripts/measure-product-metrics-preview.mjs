// Official Vercel protected-Preview HTTP timings; not browser paint/LCP or production evidence.
import {execFileSync} from 'node:child_process';
const deployment=process.argv[2],cli=process.env.VERCEL_CLI_PATH;
if(!deployment||!cli||!new URL(deployment).hostname.endsWith('.vercel.app'))throw Error('Explicit Preview and existing CLI required');
const routes=[['nl-list','/nl/toplijsten/dystopie-vanaf-1990?utm_source=facebook&utm_medium=organic_social&utm_campaign=dystopie_202610'],['en-list','/en/toplijsten/dystopie-vanaf-1990'],['nl-detail','/nl/book/921100102'],['en-detail','/en/book/921100102']];
const measurements=[];
for(const [name,path] of routes){
 const runs=[];
 for(let run=1;run<=3;run++){
  const raw=execFileSync(process.execPath,[cli,'curl',path,'--deployment',deployment,'--scope','rgkgroeneveld-9102','--','-sS','-o',process.platform==='win32'?'NUL':'/dev/null','-w','%{json}','--max-time','35'],{encoding:'utf8',timeout:50000,windowsHide:true,maxBuffer:1e6,stdio:['ignore','pipe','pipe']});
  const r=JSON.parse(raw.slice(raw.indexOf('{')));if(r.http_code!==200)throw Error(`${name}: HTTP ${r.http_code}`);
  runs.push({run,status:r.http_code,ttfbMs:r.time_starttransfer*1000,totalMs:r.time_total*1000,bytes:r.size_download});
 }
 const summary=key=>{const n=runs.map(r=>r[key]).sort((a,b)=>a-b);return {median:n[1],min:n[0],max:n[2]};};
 measurements.push({name,runs,ttfbMs:summary('ttfbMs'),totalMs:summary('totalMs')});
}
console.log(JSON.stringify({deployment,profile:'Windows desktop curl, existing network, sequential same region/Preview; no throttle, no forced cold-cache, CLI startup excluded',limitations:['HTTP only, not first-visible-card or LCP','First observed request is not proof of a cold function','Missing SQL collector; no hosted observer overhead or storage proof','No comparable untreated Preview baseline; do not infer performance improvement'],measurements},null,2));
