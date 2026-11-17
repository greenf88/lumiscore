'use client';

import { LocaleLink } from './LumiScoreLocale';
import { useEffect, useMemo, useState } from 'react';
import type { HeaderAuthState } from '@/lib/auth/header';
import type { RatingResult } from '@/lib/supabase/rating-result';
import { TasteProfileSummary } from './TasteProfileSummary';
import { useLumiScoreLocale } from './LumiScoreLocale';
import { DiscoveryPageShell } from './DiscoveryPageShell';
import { BookCard, recommendationMatchLabel } from './LumiScoreHome';
import { useWantToRead } from './useWantToRead';
import { getGuestWantedStorageId } from '@/lib/collections/guest-want-to-read';
import {RecommendationMeasurement} from './RecommendationMeasurement';
import {emitBrowserMetric} from '@/lib/product-metrics/browser';
import {useRef} from 'react';
const EMPTY_BOOKS: never[] = [];
export function TasteResultLoading({authState}:{authState:HeaderAuthState}) {
  const {locale}=useLumiScoreLocale();
  return <DiscoveryPageShell authState={authState} path="/taste-test/result"><section className="featured-section" role="status">{locale==='nl'?'Je persoonlijke resultaat laden…':'Loading your personal result…'}</section></DiscoveryPageShell>;
}
export function TasteRatingResult({authState,initialResult=null,initialLocale,initialFailed=false}: {authState:HeaderAuthState;initialResult?:RatingResult|null;initialLocale?:string;initialFailed?:boolean}) {
  const {locale} = useLumiScoreLocale(), nl=locale==='nl';
  const [loaded,setLoaded] = useState<{locale:string;result:RatingResult} | null>(()=>initialResult&&initialLocale?{locale:initialLocale,result:initialResult}:null);
  const [failed,setFailed] = useState(initialFailed), [retry,setRetry] = useState(0);
  const useInitial=retry===0 && initialLocale===locale && Boolean(initialResult||initialFailed);
  useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});},[]);
  useEffect(()=>{
    if (useInitial) return;
    const controller = new AbortController();
    fetch(`/api/taste-test/result?locale=${locale}`,{cache:'no-store',signal:controller.signal}).then(async response=>{
      if (!response.ok) throw new Error();
      const result = await response.json() as RatingResult;
      if (!controller.signal.aborted) {setLoaded({locale,result});setFailed(false);}
    }).catch(()=>{if (!controller.signal.aborted) setFailed(true);});
    return ()=>controller.abort();
  },[locale,retry,useInitial]);
  const result=useInitial?initialResult:loaded?.locale===locale ? loaded.result : null;
  const resultFailed=useInitial?initialFailed:failed;
  return <DiscoveryPageShell authState={authState} path="/taste-test/result">
    {resultFailed ? <section className="featured-section" role="alert"><h1>{nl?'Je resultaat kon niet laden':'Your result could not load'}</h1>
      <p>{nl?'Dit is een laadfout, geen leeg smaakprofiel. Je opgeslagen beoordelingen blijven behouden.':'This is a loading error, not an empty profile. Your saved ratings remain intact.'}</p>
      <button onClick={()=>{setFailed(false);setLoaded(null);setRetry(x=>x+1);}}>{nl?'Opnieuw proberen':'Try again'}</button></section>
    : !result ? <section className="featured-section" role="status">{nl?'Je persoonlijke resultaat laden…':'Loading your personal result…'}</section>
    : result.kind==='signed-out' ? <section className="featured-section"><h1>{nl?'Je persoonlijke leessmaak':'Your personal reading taste'}</h1><p>{nl?'Meld je aan om je opgeslagen beoordelingen te gebruiken.':'Sign in to use your saved ratings.'}</p><LocaleLink href="/login?next=%2Ftaste-test%2Fresult">{nl?'Aanmelden':'Sign in'}</LocaleLink></section>
    : <TasteResultContent result={result} />}
  </DiscoveryPageShell>;
}
export function TasteResultContent({result}: {result:Extract<RatingResult,{kind:'result'}>}) {
  const {locale}=useLumiScoreLocale(), nl=locale==='nl', {profile}=result;
  const measured = useRef(false);
  useEffect(() => { if (!measured.current) { measured.current = true; emitBrowserMetric('taste_result_opened', {locale,surface:'taste_result'}); } }, [locale]);
  const books=useMemo(()=>result.recommendations.length ? result.recommendations.map(x=>x.book) : EMPTY_BOOKS,[result.recommendations]);
  const {wanted,statuses,toggleWanted}=useWantToRead(true,books);
  return <section className="featured-section taste-result" aria-labelledby="taste-result-title">
    <TasteProfileSummary profile={profile} headingId="taste-result-title" anchors={result.anchors} showInsufficient shareable />
    <h2>{nl?'Boeken voor jou':'Books for you'}</h2>
    {result.recommendations.length===0 ? <p role="status">{nl?'Nu geen passende boeken beschikbaar.':'No suitable books available right now.'}</p>
    : <div className="book-grid">{result.recommendations.map((x,index)=><RecommendationMeasurement key={`${locale}:${x.book.workId}`} workId={x.book.workId} locale={locale} surface="taste_result" position={index+1}><div className="taste-recommendation"><BookCard book={x.book}
      wanted={wanted.has(getGuestWantedStorageId(x.book))} status={statuses.get(x.book.workId!)} onToggle={toggleWanted}
      resolveMissingCover matchLabel={recommendationMatchLabel(x,locale)} detailReturnContext={{kind:'recommendations',path:'/taste-test/result'}} /><p className="taste-recommendation-reason">{x.explanation}</p></div></RecommendationMeasurement>)}</div>}
    <nav aria-label={nl?'Volgende stap':'Next step'} className="taste-next-steps"><LocaleLink href="/taste-test">{nl?'Verfijn je smaak':'Refine your taste'}</LocaleLink></nav>
  </section>;
}
