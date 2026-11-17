'use client';
import {useEffect} from 'react';
import {emitBrowserMetric} from '@/lib/product-metrics/browser';
// Bounded, tab-memory only. Back navigation must not replay a completed search.
const seen = new Set<string>();
export function SearchOutcomeMeasurement({query, count, failed, locale, surface}: {query:string;count:number;failed:boolean;locale:'nl'|'en';surface:'home'|'browse'}) {
 useEffect(()=>{
  if(query.trim().length<2)return;
  const key=`${locale}:${surface}:${query.trim().toLocaleLowerCase()}:${failed?'failed':count}`;
  if(seen.has(key))return;
  if(seen.size>=100)seen.delete(seen.values().next().value!);
  seen.add(key); // Includes denied displays: never replay after consent changes.
  emitBrowserMetric('search_started',{locale,surface});
  emitBrowserMetric(failed?'search_failed':count>0?'search_results':'search_empty',{locale,surface});
 },[query,count,failed,locale,surface]);
 return null;
}
