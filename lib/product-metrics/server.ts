import {readServerEnvironment} from '../server-environment.ts';
import {measurementTestTarget,parseMetric,type MetricEnvelope} from './contract.ts';
import {after} from 'next/server';
import {parseMetricContext,type MetricContext} from './contract.ts';
import type {NextRequest} from 'next/server';
import {CHOICE_COOKIE,GRANT_COOKIE,GRANT_HEADER,grantedAnalysisToken} from './consent.ts';
export const metricsEnabled=()=>measurementTestTarget(readServerEnvironment('NEXT_PUBLIC_SUPABASE_URL'));
export function requestAnalysisGrant(request:NextRequest):string|null{
 if(!metricsEnabled()||request.headers.get('dnt')==='1'||request.headers.get('sec-gpc')==='1')return null;
 return grantedAnalysisToken(request.cookies.get(CHOICE_COOKIE)?.value,request.cookies.get(GRANT_COOKIE)?.value);
}
export async function consentOperation(action:'accept'|'revoke'|'status',token:string|null,until?:number):Promise<{active:boolean;token?:string;expires:number;revoked?:boolean}|null>{
 if(!metricsEnabled())return null;
 try{
  const response=await fetch('https://hlvujbrmfdlrfxdjwsmb.supabase.co/rest/v1/rpc/product_analysis_consent_test_v3',{method:'POST',headers:{apikey:readServerEnvironment('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')??'','Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_token:token,p_until:until?new Date(until).toISOString():null}),signal:AbortSignal.timeout(1500),cache:'no-store'});
  if(!response.ok)return null;return await response.json();
 }catch{return null;}
}
/** Test-target-only, public client credential. No service key, cookies or reader data. */
export async function recordMetrics(events:MetricEnvelope[],grant:string):Promise<'counted'|'limited'|'consent_denied'|'unavailable'>{
 if(!metricsEnabled()||!grant||events.length<1||events.length>10||events.some(e=>!parseMetric(e)))return 'unavailable';
 try{
  const response=await fetch('https://hlvujbrmfdlrfxdjwsmb.supabase.co/rest/v1/rpc/record_product_events_test_v1',{
   method:'POST',headers:{apikey:readServerEnvironment('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')??'','Content-Type':'application/json',[GRANT_HEADER]:grant},
   body:JSON.stringify({p_events:events.map(e=>({...e,properties:{source:'direct_unknown',medium:'unknown',campaign:'none',traffic:'synthetic',surface:'other',...e.properties}}))}),signal:AbortSignal.timeout(1000),cache:'no-store',
  });
  if(!response.ok)return 'unavailable';const result=await response.json();
  if(!Array.isArray(result))return 'unavailable';
  if(result.every(x=>x==='counted'||x==='duplicate'))return 'counted';
  if(result.includes('consent_denied'))return 'consent_denied';
  return result.some(x=>['project_rate_limited','grant_rate_limited','busy'].includes(x))?'limited':'unavailable';
 }catch{return 'unavailable';} // Never change a business operation into a retry.
}
export function scheduleSignInMeasurement(token:string,raw:FormDataEntryValue|null,grant:string|null){
 if(!metricsEnabled()||!grant||typeof raw!=='string'||raw.length>512)return;
 let context:MetricContext|null;try{context=parseMetricContext(JSON.parse(raw));}catch{return;}if(!context)return;
 try{after(async()=>{try{
  await fetch('https://hlvujbrmfdlrfxdjwsmb.supabase.co/rest/v1/rpc/record_product_sign_in_test_v1',{
   method:'POST',headers:{apikey:readServerEnvironment('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')??'',Authorization:`Bearer ${token}`,'Content-Type':'application/json',[GRANT_HEADER]:grant},
   body:JSON.stringify({p_dimensions:context}),signal:AbortSignal.timeout(1000),cache:'no-store',
  });
 }catch{/* No retry or credential logging; sign-in is already successful. */}});}catch{/* An unavailable after-response scheduler cannot change sign-in success. */}
}
