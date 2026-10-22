import test from 'node:test';
import assert from 'node:assert/strict';
import {browserMetricContext,browserMetricsEnabled,measurementHeaders,emitBrowserMetric,flushBrowserMetrics} from './browser.ts';
test('client transport batches observations, bounds attribution, honors privacy and never sends identity or server successes',async()=>{
 const names=['window','navigator','location','document','sessionStorage','fetch'] as const;
 const previous=new Map(names.map(n=>[n,Object.getOwnPropertyDescriptor(globalThis,n)]));
 const env=process.env.NEXT_PUBLIC_SUPABASE_URL,storage=new Map<string,string>(),sent:Array<Record<string,unknown>>=[];
 const install=(name:string,value:unknown)=>Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});
 try{
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://hlvujbrmfdlrfxdjwsmb.supabase.co';
  install('window',{});install('navigator',{doNotTrack:'0'});
  install('location',new URL('https://preview.invalid/nl/toplijsten/dystopie-vanaf-1990?utm_source=facebook&utm_medium=organic_social&utm_campaign=dystopie_202610&token=PRIVATE'));
  install('document',{referrer:''});install('sessionStorage',{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)});
  install('fetch',async(url:string,options:RequestInit)=>{sent.push({url,body:JSON.parse(String(options.body))});return new Response('{}',{status:202});});
  assert.equal(browserMetricsEnabled(),true);
  assert.equal(browserMetricContext('nl')?.campaign,'dystopie_202610');
  install('location',new URL('https://preview.invalid/en/book/114?returnTo=PRIVATE'));
  assert.equal(browserMetricContext('en')?.campaign,'dystopie_202610');
  assert.equal(JSON.parse(measurementHeaders('en')['x-lumiscore-product-context']).surface,'book_detail');
  emitBrowserMetric('page_opened',{locale:'en',surface:'book_detail'});emitBrowserMetric('book_detail_opened',{locale:'en',surface:'book_detail',work_id:114});
  emitBrowserMetric('rating_saved',{locale:'en',surface:'book_detail',work_id:114,operation:'new'});
  flushBrowserMetrics();assert.equal(sent.length,1);
  assert.equal((sent[0].body as {events:unknown[]}).events.length,2);
  assert.doesNotMatch(JSON.stringify(sent),/PRIVATE|token|returnTo|user_id|email|password|rating_saved/);
  install('navigator',{doNotTrack:'1'});assert.equal(browserMetricsEnabled(),false);assert.deepEqual(measurementHeaders('en'),{});
  emitBrowserMetric('page_opened',{locale:'en',surface:'home'});flushBrowserMetrics();assert.equal(sent.length,1);
  install('navigator',{globalPrivacyControl:true});assert.equal(browserMetricsEnabled(),false);
  install('navigator',{});process.env.NEXT_PUBLIC_SUPABASE_URL='https://qvplwejffhjvxaypmjut.supabase.co';assert.equal(browserMetricsEnabled(),false);
 }finally{
  flushBrowserMetrics();if(env===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=env;
  for(const n of names){const descriptor=previous.get(n);if(descriptor)Object.defineProperty(globalThis,n,descriptor);else Reflect.deleteProperty(globalThis,n);}
 }
});
