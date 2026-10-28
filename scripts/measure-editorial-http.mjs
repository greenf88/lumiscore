// Bounded guest HTTP measurements through the caller's existing official Vercel CLI access.
// No authentication values, response bodies, account actions or writes are recorded.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const [cli, target] = process.argv.slice(2);
const url = new URL(target);
if (url.protocol !== 'https:' || !/^lumiscore-[a-z0-9]+-rgkgroeneveld-9102\.vercel\.app$/.test(url.hostname) || url.search || url.username || url.password) throw new Error('Expected the exact team test-Preview origin');
const measurements=[];
for (const locale of ['nl','en']) for (const slug of ['dystopie-vanaf-1990','na-project-hail-mary','fantasy-om-mee-te-beginnen']) {
  for (let attempt=0;attempt<3;attempt++) {
    const path='/'+locale+'/toplijsten/'+slug;
    const {stdout}=await run(process.execPath,[cli,'curl',path,'--deployment',url.origin,'--scope','rgkgroeneveld-9102','--','--silent','--show-error','--max-time','25','--output','NUL','--write-out','%{http_code} %{time_starttransfer} %{time_total} %{size_download}'],{timeout:40000,maxBuffer:20000});
    const match=stdout.trim().match(/(\d{3}) ([\d.]+) ([\d.]+) (\d+)$/);
    if(!match)throw new Error('No bounded HTTP measurement; stop rather than retry');
    const row={path,attempt:attempt+1,status:+match[1],ttfbMs:Math.round(+match[2]*1000),responseCompleteMs:Math.round(+match[3]*1000),bytes:+match[4]};
    measurements.push(row);
    if(row.status!==200)throw new Error('Unexpected HTTP status '+row.status);
  }
}
console.log(JSON.stringify({target:url.origin,profile:'Windows HTTP client, unthrottled connection, guest, three sequential separate connections per URL; first-in-sample is not guaranteed platform-cold',note:'CLI/tool startup excluded from curl timers. HTML completion is not browser paint or LCP. No production-speed comparison.',measurements}));
