import {readServerEnvironment} from '../server-environment.ts';
import {measurementTarget,parseMetric,type MetricEnvelope} from './contract.ts';
import {after} from 'next/server';
import {parseMetricContext,type MetricContext} from './contract.ts';
import type {NextRequest} from 'next/server';
import {CHOICE_COOKIE,GRANT_COOKIE,GRANT_HEADER,grantedAnalysisToken} from './consent.ts';
const target=()=>measurementTarget(readServerEnvironment('NEXT_PUBLIC_SUPABASE_URL'),readServerEnvironment('NEXT_PUBLIC_PRODUCT_ANALYSIS_ENABLED'));
export const metricsEnabled=()=>target()!==null;
export function requestAnalysisGrant(request:NextRequest):string|null{
 if(!metricsEnabled()||request.headers.get('dnt')==='1'||request.headers.get('sec-gpc')==='1')return null;
 return grantedAnalysisToken(request.cookies.get(CHOICE_COOKIE)?.value,request.cookies.get(GRANT_COOKIE)?.value);
}
export async function consentOperation(action:'accept'|'revoke'|'status',token:string|null,until?:number):Promise<{active:boolean;token?:string;expires:number;revoked?:boolean}|null>{
 const destination=target();if(!destination)return null;
 try{
  const response=await fetch(`${destination.origin}/rest/v1/rpc/product_analysis_consent${destination.suffix}_v3`,{method:'POST',headers:{apikey:readServerEnvironment('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')??'','Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_token:token,p_until:until?new Date(until).toISOString():null}),signal:AbortSignal.timeout(1500),cache:'no-store'});
  if(!response.ok)return null;return await response.json();
 }catch{return null;}
}
/** Exact allowlisted target, public client credential. No service key or reader data. */
export async function recordMetrics(events:MetricEnvelope[],grant:string):Promise<'counted'|'limited'|'consent_denied'|'unavailable'>{
 const destination=target();
 if(!destination||!grant||events.length<1||events.length>10||events.some(e=>!parseMetric(e)||e.properties.traffic!==destination.traffic))return 'unavailable';
 try{
  const response=await fetch(`${destination.origin}/rest/v1/rpc/record_product_events${destination.suffix}_v1`,{
   method:'POST',headers:{apikey:readServerEnvironment('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')??'','Content-Type':'application/json',[GRANT_HEADER]:grant},
   body:JSON.stringify({p_events:events.map(e=>({...e,properties:{source:'direct_unknown',medium:'unknown',campaign:'none',surface:'other',...e.properties,traffic:destination.traffic}}))}),signal:AbortSignal.timeout(1000),cache:'no-store',
  });
  if(!response.ok)return 'unavailable';const result=await response.json();
  if(!Array.isArray(result))return 'unavailable';
  if(result.every(x=>x==='counted'||x==='duplicate'))return 'counted';
  if(result.includes('consent_denied'))return 'consent_denied';
  return result.some(x=>['project_rate_limited','grant_rate_limited','busy'].includes(x))?'limited':'unavailable';
 }catch{return 'unavailable';} // Never change a business operation into a retry.
}
export function scheduleSignInMeasurement(token:string,raw:FormDataEntryValue|null,grant:string|null){
 const destination=target();if(!destination||!grant||typeof raw!=='string'||raw.length>512)return;
 let context:MetricContext|null;try{context=parseMetricContext(JSON.parse(raw));}catch{return;}if(!context||context.traffic!==destination.traffic)return;
 try{after(async()=>{try{
  await fetch(`${destination.origin}/rest/v1/rpc/record_product_sign_in${destination.suffix}_v1`,{
   method:'POST',headers:{apikey:readServerEnvironment('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')??'',Authorization:`Bearer ${token}`,'Content-Type':'application/json',[GRANT_HEADER]:grant},
   body:JSON.stringify({p_dimensions:context}),signal:AbortSignal.timeout(1000),cache:'no-store',
  });
 }catch{/* No retry or credential logging; sign-in is already successful. */}});}catch{/* An unavailable after-response scheduler cannot change sign-in success. */}
}
