'use client';
import {useEffect,useRef,type ReactNode,type MouseEvent} from 'react';
import {impressionTimer,measurementTestTarget,parseMetric,RANKER_VERSION,type MetricProperties} from '@/lib/product-metrics/contract';
import {emitBrowserMetric} from '@/lib/product-metrics/browser';
const enabled=()=>measurementTestTarget(process.env.NEXT_PUBLIC_SUPABASE_URL);
export function RecommendationMeasurement({workId,position,locale,surface,children}:{workId:string|null|undefined;position:number;locale:'nl'|'en';surface:'home'|'recommendations'|'taste_result';children:ReactNode}){
 const host=useRef<HTMLDivElement>(null),impressed=useRef(false),opened=useRef(false);
 const emit=(event:'recommendation_impression'|'recommendation_open')=>{
  if(!enabled())return;
  const properties:MetricProperties={locale,surface,work_id:Number(workId),position,ranker_version:RANKER_VERSION};
  const envelope=parseMetric({event_id:crypto.randomUUID(),event,properties});if(!envelope)return;
  emitBrowserMetric(event,properties,envelope.event_id);
 };
 const emitRef=useRef(emit);useEffect(()=>{emitRef.current=emit;});
 useEffect(()=>{
  if(!enabled()||impressed.current)return;
  const element=host.current?.firstElementChild;if(!element)return;
  const timer=impressionTimer(()=>{impressed.current=true;emitRef.current('recommendation_impression');});
  const observer=new IntersectionObserver(entries=>timer.visible(document.visibilityState==='visible'?(entries[0]?.intersectionRatio??0):0),{threshold:[0,.5,1]});
  const hidden=()=>{if(document.visibilityState!=='visible')timer.visible(0);else{observer.unobserve(element);observer.observe(element);}};
  observer.observe(element);document.addEventListener('visibilitychange',hidden);
  return()=>{timer.stop();observer.disconnect();document.removeEventListener('visibilitychange',hidden);};
 },[]);
 const open=(event:MouseEvent)=>{if((event.type==='click'&&event.button!==0)||(event.type==='auxclick'&&event.button!==1))return;
  if(impressed.current&&!opened.current&&event.target instanceof Element&&event.target.closest('a[href]')){opened.current=true;emitRef.current('recommendation_open');}};
 return <div ref={host} style={{display:'contents'}} onClickCapture={open} onAuxClickCapture={open}>{children}</div>;
}
