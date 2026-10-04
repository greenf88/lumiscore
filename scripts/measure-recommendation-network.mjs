// Unreleased loader network shape against public metadata only. No writes/ranking.
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { loadRecommendationCatalog } from '../lib/supabase/recommendation-catalog.ts';
let text=await readFile(process.argv[2],'utf8');const config={};
for(const line of text.split(/\r?\n/)) {
  const match=/^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)=(.*)$/.exec(line.trim());
  if(match) config[match[1]]=match[2].trim().replace(/^(['"])(.*)\1$/,'$2');
}
text='';
if(new URL(config.NEXT_PUBLIC_SUPABASE_URL).hostname!=='qvplwejffhjvxaypmjut.supabase.co') throw new Error('Unexpected public target.');
const metrics={requests:0,decodedBytes:0,works:0,evidenceRows:0,rpc:0};
const client=createClient(config.NEXT_PUBLIC_SUPABASE_URL,config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
    const path=new URL(String(input)).pathname;
    if(init?.method&&init.method!=='GET'&&!(init.method==='POST'&&path.endsWith('/rpc/get_work_rating_summaries'))) throw new Error('Write forbidden.');
    metrics.requests++;const response=await fetch(input,init);if(!response.ok) throw new Error('Public measurement unavailable.');
    const body=await response.clone().arrayBuffer();metrics.decodedBytes+=body.byteLength;
    const rows=JSON.parse(Buffer.from(body).toString('utf8'));
    if(path.endsWith('/works')) metrics.works+=rows.length;
    if(path.endsWith('/work_trait_evidence')) metrics.evidenceRows+=rows.length;
    if(path.includes('/rpc/')) metrics.rpc++;
    return response;
  }}});
for(const key of Object.keys(config)) delete config[key];
try {
  const start=performance.now();
  const catalog=await loadRecommendationCatalog(client,rows=>rows.map(row=>({
    id:`work-${row.id}`,source:'supabase',workId:String(row.id),title:row.title,author:row.authors?.name??'',
    score:null,ratingsCount:null,match:null,cover:'orbit',firstPublishYear:row.first_publish_year,
    editionLanguage:row.editions?.[0]?.language,isbn13:row.editions?.[0]?.isbn_13})));
  const report={at:new Date().toISOString(),method:'unreleased public candidate-loader network shape only; no ranking/hydration or cache',
    target:'production public metadata, read-only anonymous client',...metrics,candidates:catalog.candidates.length,
    wallMs:Math.round(performance.now()-start),limitation:'One sample, full wire compression not measured, simplified mapper; NOT deployed production performance improvement.'};
  await mkdir('outputs/performance-review',{recursive:true});await writeFile('outputs/performance-review/candidate-network.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} catch {console.error('Public read-only candidate measurement failed; details withheld.');process.exitCode=1;}
