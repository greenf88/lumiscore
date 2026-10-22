import {readServerEnvironment} from '../server-environment.ts';
import {measurementTestTarget,parseMetric,type MetricEnvelope} from './contract.ts';
import {after} from 'next/server';
import {parseMetricContext,type MetricContext} from './contract.ts';
export const metricsEnabled=()=>measurementTestTarget(readServerEnvironment('NEXT_PUBLIC_SUPABASE_URL'));
/** Test-target-only, public client credential. No service key, cookies or reader data. */
export async function recordMetrics(events:MetricEnvelope[]):Promise<boolean>{
 if(!metricsEnabled()||events.length<1||events.length>10||events.some(e=>!parseMetric(e)))return false;
 try{
  const response=await fetch('https://hlvujbrmfdlrfxdjwsmb.supabase.co/rest/v1/rpc/record_product_events_test_v1',{
   method:'POST',headers:{apikey:readServerEnvironment('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')??'','Content-Type':'application/json'},
   body:JSON.stringify({p_events:events.map(e=>({...e,properties:{source:'direct_unknown',medium:'unknown',campaign:'none',traffic:'synthetic',surface:'other',...e.properties}}))}),signal:AbortSignal.timeout(1000),cache:'no-store',
  });
  if(!response.ok)return false;const result=await response.json();return Array.isArray(result)&&result.every(x=>x==='counted'||x==='duplicate');
 }catch{return false;} // Metrics must never change a successful app operation into a retry.
}
export function scheduleSignInMeasurement(token:string,raw:FormDataEntryValue|null){
 if(!metricsEnabled()||typeof raw!=='string'||raw.length>512)return;
 let context:MetricContext|null;try{context=parseMetricContext(JSON.parse(raw));}catch{return;}if(!context)return;
 try{after(async()=>{try{
  await fetch('https://hlvujbrmfdlrfxdjwsmb.supabase.co/rest/v1/rpc/record_product_sign_in_test_v1',{
   method:'POST',headers:{apikey:readServerEnvironment('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')??'',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
   body:JSON.stringify({p_dimensions:context}),signal:AbortSignal.timeout(1000),cache:'no-store',
  });
 }catch{/* No retry or credential logging; sign-in is already successful. */}});}catch{/* An unavailable after-response scheduler cannot change sign-in success. */}
}
