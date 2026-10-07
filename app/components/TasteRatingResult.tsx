'use client';

import { LocaleLink } from './LumiScoreLocale';
import { useEffect, useMemo, useState } from 'react';
import type { HeaderAuthState } from '@/lib/auth/header';
import type { RatingResult } from '@/lib/supabase/rating-result';
import { getTraitLabel } from '@/lib/taste-test/traits';
import { topSupportedAffinities } from '@/lib/taste-test/result-presentation';
import { useLumiScoreLocale } from './LumiScoreLocale';
import { DiscoveryPageShell } from './DiscoveryPageShell';
import { BookCard, recommendationMatchLabel } from './LumiScoreHome';
import { useWantToRead } from './useWantToRead';
import { getGuestWantedStorageId } from '@/lib/collections/guest-want-to-read';
const EMPTY_BOOKS: never[] = [];
const ARCHETYPES = {
  worldbuilder:['Wereldbouwer','Worldbuilder'],sleuth:['Speurneus','Sleuth'],
  explorer:['Ontdekkingsreiziger','Explorer'],connector:['Verhalenverbinder','Story connector'],
};
export function TasteRatingResult({authState}: {authState:HeaderAuthState}) {
  const {locale} = useLumiScoreLocale(), nl=locale==='nl';
  const [loaded,setLoaded] = useState<{locale:string;result:RatingResult} | null>(null);
  const [failed,setFailed] = useState(false), [retry,setRetry] = useState(0);
  useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});},[]);
  useEffect(()=>{
    const controller = new AbortController();
    fetch(`/api/taste-test/result?locale=${locale}`,{cache:'no-store',signal:controller.signal}).then(async response=>{
      if (!response.ok) throw new Error();
      const result = await response.json() as RatingResult;
      if (!controller.signal.aborted) {setLoaded({locale,result});setFailed(false);}
    }).catch(()=>{if (!controller.signal.aborted) setFailed(true);});
    return ()=>controller.abort();
  },[locale,retry]);
  const result=loaded?.locale===locale ? loaded.result : null;
  return <DiscoveryPageShell authState={authState} path="/taste-test/result">
    {failed ? <section className="featured-section" role="alert"><h1>{nl?'Je resultaat kon niet laden':'Your result could not load'}</h1>
      <p>{nl?'Dit is een laadfout, geen leeg smaakprofiel. Je opgeslagen beoordelingen blijven behouden.':'This is a loading error, not an empty profile. Your saved ratings remain intact.'}</p>
      <button onClick={()=>{setFailed(false);setLoaded(null);setRetry(x=>x+1);}}>{nl?'Opnieuw proberen':'Try again'}</button></section>
    : !result ? <section className="featured-section" role="status">{nl?'Je persoonlijke resultaat laden…':'Loading your personal result…'}</section>
    : result.kind==='signed-out' ? <section className="featured-section"><h1>{nl?'Je persoonlijke leessmaak':'Your personal reading taste'}</h1><p>{nl?'Meld je aan om je opgeslagen beoordelingen te gebruiken.':'Sign in to use your saved ratings.'}</p><LocaleLink href="/login?next=%2Ftaste-test%2Fresult">{nl?'Aanmelden':'Sign in'}</LocaleLink></section>
    : <TasteResultContent result={result} />}
  </DiscoveryPageShell>;
}
export function TasteResultContent({result}: {result:Extract<RatingResult,{kind:'result'}>}) {
  const {locale}=useLumiScoreLocale(), nl=locale==='nl', {profile}=result;
  const books=useMemo(()=>result.recommendations.length ? result.recommendations.map(x=>x.book) : EMPTY_BOOKS,[result.recommendations]);
  const {wanted,statuses,toggleWanted}=useWantToRead(true,books);
  const preferences=topSupportedAffinities(profile);
  return <section className="featured-section taste-result" aria-labelledby="taste-result-title">
    <div className="taste-profile">
      <span className="eyebrow">{nl?'Jouw leessmaak':'Your reading taste'}</span>
      <h1 id="taste-result-title">{profile.archetype
        ? <><span className="taste-profile-spark" aria-hidden="true">✦</span>{nl ? `Jij bent een ${ARCHETYPES[profile.archetype][0].toLocaleLowerCase('nl')}` : `You are ${profile.archetype==='explorer'?'an':'a'} ${ARCHETYPES[profile.archetype][1].toLocaleLowerCase('en')}`}</>
        : nl?'Nog even ontdekken':'Keep discovering'}</h1>
      {!profile.archetype && <p>{nl?'Beoordeel meer boeken om je smaak te vinden.':'Rate more books to find your reading taste.'}</p>}
      {preferences.length>0 && <ul className="taste-preferences">{preferences.map(x=><li key={x.trait}>
        <span>{getTraitLabel(locale,x.trait)}</span>
        <span className="taste-preference-track" aria-hidden="true"><span style={{width:`${x.score}%`}} /></span>
      </li>)}</ul>}
    </div>
    <h2>{nl?'Boeken voor jou':'Books for you'}</h2>
    {result.recommendations.length===0 ? <p role="status">{nl?'Nu geen passende boeken beschikbaar.':'No suitable books available right now.'}</p>
    : <div className="book-grid">{result.recommendations.map(x=><BookCard key={x.book.workId}
      book={x.book} wanted={wanted.has(getGuestWantedStorageId(x.book))} status={statuses.get(x.book.workId!)} onToggle={toggleWanted}
      resolveMissingCover={false} matchLabel={recommendationMatchLabel(x,locale)} detailReturnContext={{kind:'recommendations',path:'/taste-test/result'}} />)}</div>}
    <nav aria-label={nl?'Volgende stap':'Next step'} className="taste-next-steps"><LocaleLink href="/taste-test">{nl?'Verfijn je smaak':'Refine your taste'}</LocaleLink></nav>
  </section>;
}
