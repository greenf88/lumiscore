'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useLumiScoreLocale } from './LumiScoreLocale';
import { browserMetricContext, browserMetricsEnabled, emitBrowserMetric, flushBrowserMetrics } from '@/lib/product-metrics/browser';
import { metricSurfaceForPath } from '@/lib/product-metrics/contract';

/** No visible UI, cookies, visitor identifiers or third-party tracker. */
export function ProductMeasurements() {
  const pathname = usePathname(), { locale } = useLumiScoreLocale(), last = useRef({key:'',markerSent:false});
  useEffect(() => {
    if (!browserMetricsEnabled()) return;
    const key = `${locale}:${pathname}`;
    const surface = metricSurfaceForPath(location.pathname);
    if(last.current.key!==key){last.current={key,markerSent:false};emitBrowserMetric('page_opened', { locale, surface });}
    const entry=last.current;
    const observeContent=()=>{
      if(entry.markerSent)return true;
      const editorial=document.querySelector<HTMLElement>('[data-product-list]');
      const detail=document.querySelector<HTMLElement>('[data-product-work]');
      if(surface==='editorial'&&editorial&&location.pathname.endsWith('/'+editorial.dataset.productList)){
        entry.markerSent=true;emitBrowserMetric('editorial_list_opened',{locale,surface,list_id:editorial.dataset.productList==='dystopie-vanaf-1990'?'dystopie-vanaf-1990':'other'});return true;
      }
      if(surface==='book_detail'&&detail&&location.pathname.replace(/\/$/,'').endsWith('/'+detail.dataset.productWork)){
        entry.markerSent=true;emitBrowserMetric('book_detail_opened',{locale,surface,work_id:Number(detail.dataset.productWork)});return true;
      }
      return surface!=='editorial'&&surface!=='book_detail';
    };
    if(observeContent())return;
    const observer=new MutationObserver(()=>{if(observeContent())observer.disconnect();});
    observer.observe(document.body,{childList:true,subtree:true});
    const stop=setTimeout(()=>observer.disconnect(),10000);
    return()=>{observer.disconnect();clearTimeout(stop);};
  }, [locale, pathname]);
  useEffect(() => {
    if (!browserMetricsEnabled()) return;
    const activated = new WeakMap<HTMLAnchorElement, number>();
    const click = (event: MouseEvent) => {
      if ((event.type === 'click' && event.button !== 0) || (event.type === 'auxclick' && event.button !== 1)) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.origin !== location.origin) return;
      const match = /^\/(?:nl|en)\/books?\/(\d+)$/.exec(anchor.pathname);
      if (!match) return;
      const previous = activated.get(anchor);
      if (previous !== undefined && performance.now() - previous < 750) return;
      activated.set(anchor, performance.now());
      const surface = metricSurfaceForPath(location.pathname);
      emitBrowserMetric('book_card_opened', { locale, surface, work_id: Number(match[1]), list_id: location.pathname.endsWith('/dystopie-vanaf-1990') ? 'dystopie-vanaf-1990' : 'other' });
      flushBrowserMetrics(); // keepalive; never prevent native/keyboard/middle-click navigation.
    };
    document.addEventListener('click', click, true);
    document.addEventListener('auxclick', click, true);
    window.addEventListener('pagehide', flushBrowserMetrics);
    return () => { document.removeEventListener('click', click, true); document.removeEventListener('auxclick', click, true); window.removeEventListener('pagehide', flushBrowserMetrics); };
  }, [locale]);
  return null;
}

export function MeasurementFormContext() {
  const { locale } = useLumiScoreLocale();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const context = browserMetricContext(locale, 'login');
    if (input.current) input.current.value = context ? JSON.stringify(context) : '';
  }, [locale]);
  return <input ref={input} type="hidden" name="productContext" defaultValue="" />;
}
