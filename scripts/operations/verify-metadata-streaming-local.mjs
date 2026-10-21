// Run against seo-critical-local.mjs --slow-cover --slow-description only.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { inspectServerHtml } from '../../lib/seo/server-html.ts';
const [target,output]=process.argv.slice(2);
if(new URL(target).hostname!=='127.0.0.1')throw Error('Loopback-only synthetic verification');
const rows=[];
for(let attempt=0;attempt<5;attempt++){
 const start=performance.now();const bot=attempt===4;
 const response=await fetch(target,{headers:{'User-Agent':bot?'facebookexternalhit/1.1':'Mozilla/5.0'},signal:AbortSignal.timeout(30000)});
 const ttfbMs=performance.now()-start;let html='',h1Ms=null;
 for await(const chunk of response.body){html+=new TextDecoder().decode(chunk);if(h1Ms===null&&html.includes('<h1'))h1Ms=performance.now()-start;}
 const metadata=inspectServerHtml(html);
 const row={attempt,compileWarmup:attempt===0,bot,http:response.status,ttfbMs,h1Ms,totalMs:performance.now()-start,ogImage:metadata.metadata['og:image']};
 rows.push(row);console.log(JSON.stringify(row));
 assert.equal(response.status,200);
 assert.deepEqual(row.ogImage,['https://example.invalid/reviewed-cover.jpg']);
 if(attempt>0&&!bot)assert.ok(h1Ms<1500,'visible main should precede the 2000ms optional cover/description');
 assert.ok(row.totalMs>=1900,'test actually waited for the late verified cover');
}
await writeFile(output,JSON.stringify(rows,null,2));
