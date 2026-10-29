'use client';
import {BROWSER_METRIC_EVENTS,campaignContext,measurementTarget,METRIC_CONTEXT_HEADER,parseMetric,parseMetricContext,type MetricContext,type MetricEvent,type MetricProperties,type MetricEnvelope} from './contract.ts';
export const CAMPAIGN_STORAGE_KEY='lumiscore-campaign-v1';
const MAX_AGE=30*60_000;
let active=false,expires=0,revision=0;
let reason:'restored'|'accepted'|'revoked'='revoked';
let queue:MetricEnvelope[]=[],scheduled:ReturnType<typeof setTimeout>|null=null,expiryTimer:ReturnType<typeof setTimeout>|null=null;
const listeners=new Set<()=>void>(),pending=new Map<AbortController,ReturnType<typeof setTimeout>>();
let transport={queueDropped:0,failedBatches:0,rejectedBatches:0};
/** In-memory diagnostic totals only; not sent elsewhere or tied to a reader. */
export const browserTransportStatus=()=>({...transport,pending:pending.size,queued:queue.length});
export const subscribeAnalysis=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export const analysisRevision=()=>revision;
export const analysisChangeReason=()=>reason;
export const serverAnalysisRevision=()=>0;
export function stopBrowserAnalysis(preserveCampaign=false){
 active=false;expires=0;queue=[];
 if(scheduled!==null)clearTimeout(scheduled);scheduled=null;
 if(expiryTimer!==null)clearTimeout(expiryTimer);expiryTimer=null;
 for(const [controller,timer] of pending){clearTimeout(timer);controller.abort();}pending.clear();transport={queueDropped:0,failedBatches:0,rejectedBatches:0};
 if(!preserveCampaign)try{sessionStorage.removeItem(CAMPAIGN_STORAGE_KEY);}catch{/* No alternate storage. */}
}
export function applyAnalysisPermission(enabled:boolean,until=0,why:typeof reason='restored'){
 stopBrowserAnalysis(enabled&&why==='restored');reason=enabled?why:'revoked';
 if(enabled&&until>Date.now()&&until<=Date.now()+MAX_AGE){active=true;expires=until;expiryTimer=setTimeout(()=>applyAnalysisPermission(false),until-Date.now());}
 revision++;for(const listener of listeners)listener();
}
export function browserMetricsEnabled():boolean{
 return typeof window!=='undefined'&&active&&Date.now()<expires&&!!measurementTarget(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_PRODUCT_ANALYSIS_ENABLED)&&navigator.doNotTrack!=='1'&&!(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl;
}
export function browserMetricContext(locale:'nl'|'en',surface?:MetricContext['surface']):MetricContext|null{
 if(!browserMetricsEnabled())return null;
 let prior:MetricContext|null=null;
 try{const saved=JSON.parse(sessionStorage.getItem(CAMPAIGN_STORAGE_KEY)??'null');if(saved&&typeof saved.expires==='number'&&saved.expires>Date.now()&&saved.expires<=Date.now()+MAX_AGE)prior=parseMetricContext(saved.context);else sessionStorage.removeItem(CAMPAIGN_STORAGE_KEY);}catch{/* No identifier fallback. */}
 const target=measurementTarget(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_PRODUCT_ANALYSIS_ENABLED);
 if(!target)return null;
 const context=campaignContext(location.href,document.referrer,locale,prior,target.traffic);if(surface)context.surface=surface;
 try{sessionStorage.setItem(CAMPAIGN_STORAGE_KEY,JSON.stringify({expires:Math.min(expires,Date.now()+MAX_AGE),context}));}catch{/* Attribution can be unknown. */}
 return context;
}
export function measurementHeaders(locale:'nl'|'en',surface?:MetricContext['surface']):Record<string,string>{const context=browserMetricContext(locale,surface);return context?{[METRIC_CONTEXT_HEADER]:JSON.stringify(context)}:{};}
export function flushBrowserMetrics(){
 if(scheduled!==null)clearTimeout(scheduled);scheduled=null;
 if(!browserMetricsEnabled()){stopBrowserAnalysis();return;}
 if(pending.size>=2){transport.queueDropped+=queue.length;queue=[];return;}
 const events=queue.splice(0,10);if(!events.length)return;
 const controller=new AbortController(),generation=revision;
 pending.set(controller,setTimeout(()=>controller.abort(),3000));
 // No automatic retry/offline replay. Never prevent native navigation.
 void fetch('/api/product-metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events}),keepalive:true,credentials:'same-origin',signal:controller.signal}).then(r=>{if(generation===revision&&!r.ok)transport.rejectedBatches++;}).catch(()=>{if(generation===revision)transport.failedBatches++;}).finally(()=>{const timer=pending.get(controller);if(timer)clearTimeout(timer);pending.delete(controller);});
 if(queue.length)scheduled=setTimeout(flushBrowserMetrics,100);
}
export function emitBrowserMetric(event:MetricEvent,properties:MetricProperties,eventId?:string){
 if(!browserMetricsEnabled()||!BROWSER_METRIC_EVENTS.includes(event))return;
 const context=browserMetricContext(properties.locale,properties.surface);
 // No UUID, context or buffer is created before consent.
 const envelope=parseMetric({event_id:eventId??crypto.randomUUID(),event,properties:{...context,...properties}});
 if(!envelope)return;if(queue.length>=20){transport.queueDropped++;return;}
 queue.push(envelope);if(scheduled===null)scheduled=setTimeout(flushBrowserMetrics,100);
}
