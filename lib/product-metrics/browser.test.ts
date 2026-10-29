import test from 'node:test';
import assert from 'node:assert/strict';
import {browserMetricContext,browserMetricsEnabled,measurementHeaders,emitBrowserMetric,flushBrowserMetrics,applyAnalysisPermission,CAMPAIGN_STORAGE_KEY,browserTransportStatus} from './browser.ts';
import {analysisChoiceValue,parseAnalysisChoice,parseAnalysisGrant,grantedAnalysisToken} from './consent.ts';

test('versioned necessary choice is not an analytics ID; missing/invalid/expired grants default off',()=>{
 const now=Date.now(),token=crypto.randomUUID();assert.equal(parseAnalysisChoice(undefined,now),'unknown');
 assert.equal(parseAnalysisChoice('2.a.'+(now+1000),now),'unknown');assert.equal(parseAnalysisChoice(analysisChoiceValue('accepted',now-90*86400_000),now),'unknown');
 assert.equal(parseAnalysisChoice(analysisChoiceValue('denied',now),now),'denied');
 assert.equal(grantedAnalysisToken(analysisChoiceValue('denied',now),`${token}.${now+1000}`,now),null);
 assert.equal(parseAnalysisGrant(`${token}.${now+1800_001}`,now),null);assert.equal(parseAnalysisGrant(`${token}.${now}`,now),null);
 assert.equal(grantedAnalysisToken(analysisChoiceValue('accepted',now),`${token}.${now+1000}`,now),token);
});

test('no pre-consent IDs, attribution or replay; bounded batches; revocation aborts and clears; privacy wins',async()=>{
 const names=['window','navigator','location','document','sessionStorage','fetch'] as const;
 const previous=new Map(names.map(n=>[n,Object.getOwnPropertyDescriptor(globalThis,n)]));
 const env=process.env.NEXT_PUBLIC_SUPABASE_URL,flag=process.env.NEXT_PUBLIC_PRODUCT_ANALYSIS_ENABLED,storage=new Map<string,string>(),sent:Array<{body:{events:unknown[]};signal:AbortSignal}>=[];
 const install=(name:string,value:unknown)=>Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});
 try{
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://hlvujbrmfdlrfxdjwsmb.supabase.co';install('window',{});install('navigator',{doNotTrack:'0'});
  install('location',new URL('https://preview.invalid/nl/toplijsten/dystopie-vanaf-1990?utm_source=facebook&utm_medium=organic_social&utm_campaign=dystopie_202610&token=PRIVATE'));
  install('document',{referrer:''});install('sessionStorage',{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)});
  install('fetch',async(_url:string,options:RequestInit)=>{sent.push({body:JSON.parse(String(options.body)),signal:options.signal as AbortSignal});return new Response('{}',{status:202});});
  const emit=()=>emitBrowserMetric('page_opened',{locale:'nl',surface:'editorial'});
  assert.equal(browserMetricsEnabled(),false);assert.equal(browserMetricContext('nl'),null);assert.deepEqual(measurementHeaders('nl'),{});emit();flushBrowserMetrics();assert.equal(sent.length,0);assert.equal(storage.size,0);
  applyAnalysisPermission(false);emit();flushBrowserMetrics();assert.equal(sent.length,0); // Refusal.
  applyAnalysisPermission(true,Date.now()+60_000,'accepted');flushBrowserMetrics();assert.equal(sent.length,0); // No historical queue.
  assert.equal(browserMetricContext('nl')?.campaign,'dystopie_202610');assert.ok(storage.has(CAMPAIGN_STORAGE_KEY));
  install('location',new URL('https://preview.invalid/en/book/114?returnTo=PRIVATE'));assert.equal(browserMetricContext('en')?.campaign,'dystopie_202610');
  for(let i=0;i<25;i++)emit();emitBrowserMetric('rating_saved',{locale:'nl',surface:'book_detail',work_id:114,operation:'new'});
  assert.equal(browserTransportStatus().queueDropped,5);flushBrowserMetrics();assert.equal(sent.length,1);assert.equal(sent[0].body.events.length,10);
  applyAnalysisPermission(false);assert.ok(sent[0].signal.aborted);assert.equal(storage.size,0);flushBrowserMetrics();assert.equal(sent.length,1);
  applyAnalysisPermission(true,Date.now()+60_000,'accepted');flushBrowserMetrics();assert.equal(sent.length,1); // Discarded remainder stays discarded.
  install('fetch',()=>new Promise(()=>{}));for(let batch=0;batch<3;batch++){emit();flushBrowserMetrics();}
  assert.equal(browserTransportStatus().pending,2);assert.equal(browserTransportStatus().queueDropped,1);applyAnalysisPermission(false);assert.equal(browserTransportStatus().pending,0);
  assert.doesNotMatch(JSON.stringify(sent),/PRIVATE|returnTo|user_id|email|password|rating_saved/);
  install('navigator',{doNotTrack:'1'});assert.equal(browserMetricsEnabled(),false);assert.deepEqual(measurementHeaders('en'),{});
  install('navigator',{globalPrivacyControl:true});assert.equal(browserMetricsEnabled(),false);
  install('navigator',{});process.env.NEXT_PUBLIC_SUPABASE_URL='https://qvplwejffhjvxaypmjut.supabase.co';delete process.env.NEXT_PUBLIC_PRODUCT_ANALYSIS_ENABLED;
  applyAnalysisPermission(true,Date.now()+60_000,'accepted');assert.equal(browserMetricsEnabled(),false);
  process.env.NEXT_PUBLIC_PRODUCT_ANALYSIS_ENABLED='true';assert.equal(browserMetricsEnabled(),true);
  assert.equal(browserMetricContext('nl')?.traffic,'production');
  applyAnalysisPermission(false);assert.equal(browserMetricsEnabled(),false);assert.equal(storage.size,0);
 }finally{
  applyAnalysisPermission(false);if(env===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=env;
  if(flag===undefined)delete process.env.NEXT_PUBLIC_PRODUCT_ANALYSIS_ENABLED;else process.env.NEXT_PUBLIC_PRODUCT_ANALYSIS_ENABLED=flag;
  for(const n of names){const descriptor=previous.get(n);if(descriptor)Object.defineProperty(globalThis,n,descriptor);else Reflect.deleteProperty(globalThis,n);}
 }
});
