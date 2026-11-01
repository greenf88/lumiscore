// Official protected-deployment access. No accounts, successful ratings or private reads.
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const deployment=process.argv[2],cli=process.env.VERCEL_CLI_PATH;
if(!deployment||!cli)throw Error('Explicit Preview URL and existing VERCEL_CLI_PATH required');
const origin=new URL(deployment).origin;
if(!origin.endsWith('.vercel.app')||origin==='https://lumisco.re')throw Error('Preview only');
const context={locale:'nl',surface:'editorial',source:'facebook',medium:'organic_social',campaign:'dystopie_202610',traffic:'synthetic'};
const receipt='b0000000-0000-4000-8000-000000000022';
const rows=[];
function request(path,{method='GET',body,originHeader=origin,type='application/json',headers=[]}={}){
 const args=[cli,'curl',path,'--deployment',deployment,'--scope','rgkgroeneveld-9102','--','-sS','-D','-','--max-time','40','-X',method];
 if(method!=='GET')args.push('-H',`Origin: ${originHeader}`,'-H',`Content-Type: ${type}`);
 for(const header of headers)args.push('-H',header);
 if(body!==undefined)args.push('--data-binary','@-');
 const raw=execFileSync(process.execPath,args,{encoding:'utf8',input:body,timeout:55000,windowsHide:true,maxBuffer:4*1024*1024,stdio:['pipe','pipe','pipe']});
 const matches=[...raw.matchAll(/HTTP\/\S+ (\d{3})[^\r\n]*\r?\n/g)],last=matches.at(-1);
 if(!last)throw Error('Missing HTTP response');
 const headerEnd=raw.indexOf('\r\n\r\n',last.index),lfEnd=raw.indexOf('\n\n',last.index),split=headerEnd>=0?headerEnd:lfEnd;
 return {status:Number(last[1]),headers:raw.slice(last.index,split).toLowerCase(),body:raw.slice(split+(headerEnd>=0?4:2))};
}
const check=(name,path,options,status)=>{const r=request(path,options);assert.equal(r.status,status,name);rows.push({name,status:r.status});return r;};
const campaign='?utm_source=facebook&utm_medium=organic_social&utm_campaign=dystopie_202610';
for(const locale of ['nl','en']){
 const r=check(`${locale} campaign list`,`/${locale}/toplijsten/dystopie-vanaf-1990${campaign}`,{},200);
 assert.ok(r.body.includes('editorial-books'));assert.ok(r.body.includes('data-product-list="dystopie-vanaf-1990"'));
 const canonical=r.body.match(/<link[^>]*rel="canonical"[^>]*>/)?.[0]??'';assert.ok(canonical&&!canonical.includes('utm_'));
 assert.ok(/x-robots-tag:[^\n]*noindex/.test(r.headers)||/<meta[^>]+name="robots"[^>]+noindex/.test(r.body));
 const href=r.body.match(new RegExp(`href="(/${locale}/book/\\d+[^" ]*)"`))?.[1];
 if(!href)throw Error('No real test-catalogue book link');
 check(`${locale} real detail`,href.replaceAll('&amp;','&'),{},200);
}
const valid={events:[{event_id:receipt,event:'editorial_list_opened',properties:{...context,list_id:'dystopie-vanaf-1990'}}]};
const before=check('necessary preference defaults off','/api/product-analysis-consent',{},200);assert.equal(JSON.parse(before.body).active,false);
check('no choice: no optional collection','/api/product-metrics',{method:'POST',body:JSON.stringify(valid)},204);
const denied=check('explicit refusal persists without analytics','/api/product-analysis-consent',{method:'POST',body:JSON.stringify({choice:'denied',version:1})},200);assert.equal(JSON.parse(denied.body).active,false);
const accepted=check('acceptance cannot activate an uninstalled collector','/api/product-analysis-consent',{method:'POST',body:JSON.stringify({choice:'accepted',version:1})},200);assert.equal(JSON.parse(accepted.body).active,false);
check('unknown choice version denied','/api/product-analysis-consent',{method:'POST',body:JSON.stringify({choice:'accepted',version:2})},400);
check('bounded consent body','/api/product-analysis-consent',{method:'POST',body:'x'.repeat(129)},400);
check('cross-origin denied','/api/product-metrics',{method:'POST',body:JSON.stringify(valid),originHeader:'https://denied.invalid'},403);
check('no consent: body not processed','/api/product-metrics',{method:'POST',body:'x'.repeat(8193),type:'text/plain'},204);
check('DNT no collection','/api/product-metrics',{method:'POST',body:JSON.stringify(valid),headers:['DNT: 1']},204);
check('GPC no collection','/api/product-metrics',{method:'POST',body:JSON.stringify(valid),headers:['Sec-GPC: 1']},204);
check('invalid rating does not reach storage','/api/ratings/1',{method:'PUT',body:JSON.stringify({rating:0})},400);
check('guest cannot create round or success event','/api/taste-test/rounds?locale=nl',{method:'POST',body:JSON.stringify({action:'start',language:'nl',goal:10})},401);
console.log(JSON.stringify({deployment,storageProof:false,expectedBlocker:'Collector absent after Invalid or expired requestState; no alternate installation attempted',checks:rows},null,2));
