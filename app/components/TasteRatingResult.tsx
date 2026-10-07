'use client';
import { useEffect, useMemo, useState } from 'react';
import type { HeaderAuthState } from '@/lib/auth/header';
import type { RatingResult } from '@/lib/supabase/rating-result';
import { getTraitLabel } from '@/lib/taste-test/traits';
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
const ARCHETYPE_COPY = {
  worldbuilder:['Je positieve beoordelingen laten een voorkeur voor fantasy zien.','Your positive ratings show an affinity for fantasy.'],
  sleuth:['Je positieve beoordelingen laten een voorkeur voor spannende verhalen zien.','Your positive ratings show an affinity for thrillers and mysteries.'],
  explorer:['Je positieve beoordelingen laten een voorkeur voor sciencefiction zien.','Your positive ratings show an affinity for science fiction.'],
  connector:['Je positieve beoordelingen laten een voorkeur voor verhalen over relaties zien.','Your positive ratings show an affinity for relationship-driven stories.'],
};
export function TasteRatingResult({authState}: {authState:HeaderAuthState}) {
  const {locale} = useLumiScoreLocale(), nl=locale==='nl';
  const [loaded,setLoaded] = useState<{locale:string;result:RatingResult} | null>(null);
  const [failed,setFailed] = useState(false), [retry,setRetry] = useState(0);
  useEffect(()=>{
    const controller = new AbortController();
    fetch('/api/taste-test/result',{cache:'no-store',signal:controller.signal}).then(async response=>{
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
    : result.kind==='signed-out' ? <section className="featured-section"><h1>{nl?'Je persoonlijke leessmaak':'Your personal reading taste'}</h1><p>{nl?'Meld je aan om je opgeslagen beoordelingen te gebruiken.':'Sign in to use your saved ratings.'}</p><a href="/login?next=%2Ftaste-test%2Fresult">{nl?'Aanmelden':'Sign in'}</a></section>
    : <TasteResultContent result={result} />}
  </DiscoveryPageShell>;
}
export function TasteResultContent({result}: {result:Extract<RatingResult,{kind:'result'}>}) {
  const {locale}=useLumiScoreLocale(), nl=locale==='nl', {profile}=result;
  const books=useMemo(()=>result.recommendations.length ? result.recommendations.map(x=>x.book) : EMPTY_BOOKS,[result.recommendations]);
  const {wanted,statuses,toggleWanted}=useWantToRead(true,books);
  return <section className="featured-section taste-result" aria-labelledby="taste-result-title">
    <span className="eyebrow">{nl?'Jouw leessmaak':'Your reading taste'} · {profile.provisional ? nl?'Voorlopig profiel':'Provisional profile' : nl?'Op basis van beoordelingen':'Based on ratings'}</span>
    <h1 id="taste-result-title">{profile.archetype ? nl ? `Jij bent een ${ARCHETYPES[profile.archetype][0]}.` : `You are ${profile.archetype==='explorer'?'an':'a'} ${ARCHETYPES[profile.archetype][1]}.` : nl?'Je leessmaak krijgt vorm.':'Your reading taste is taking shape.'}</h1>
    {profile.archetype && <p>{ARCHETYPE_COPY[profile.archetype][nl?0:1]}</p>}
    <p>{nl ? `Dit resultaat gebruikt je ${profile.ratingCount} expliciete beoordelingen, waarvan ${profile.classifiedCount} boeken betrouwbare kenmerken hebben. Hoge én lage scores tellen mee.` : `This result uses your ${profile.ratingCount} explicit ratings; ${profile.classifiedCount} books have reliable traits. Both high and low scores contribute.`}</p>
    {!profile.archetype && <p>{nl?'Nog onvoldoende of gemengde informatie voor één lezersarchetype. Dat is geen fout: je hoeft niet in één hokje te passen.':'There is not enough, or mixed, evidence for one reader archetype. That is not a failure: you do not need to fit one label.'}</p>}
    {result.partial && <p role="status">{nl?`Tussenresultaat: ${result.roundRatedCount} nieuwe antwoorden in deze ronde; eerdere ratings tellen alleen mee in je totale profiel.`:`Partial result: ${result.roundRatedCount} new answers this round; earlier ratings only contribute to your overall profile.`}</p>}
    {profile.missingCount>0 && <p>{nl?`${profile.missingCount} beoordeelde boeken missen betrouwbare kenmerken; we vullen deze niet met aannames in.`:`${profile.missingCount} rated books lack reliable traits; we do not fill them with assumptions.`}</p>}
    <h2>{nl?'Je smaakprofiel':'Your taste profile'}</h2>
    <p>{nl?'Affiniteit 0–100, geen kanspercentage en geen verdeling die samen 100 is. Minstens drie boeken per getoonde score; beperkt bewijs blijft dicht bij neutraal.':'Affinity 0–100, not a probability or a distribution adding to 100. Each score needs at least three books; sparse evidence stays close to neutral.'}</p>
    <div className="taste-facets">{(['genre','style','era'] as const).map(facet=><div className="taste-facet" key={facet}><h3>{facet==='genre'?'Genre':facet==='style'?nl?'Verhaal en stijl':'Story and style':nl?'Publicatieperiode':'Publication era'}</h3>
      {profile.affinities.filter(x=>x.facet===facet).length ? <ul>{profile.affinities.filter(x=>x.facet===facet).map(x=><li key={x.trait}>
        <span>{getTraitLabel(locale,x.trait)} · {x.books} {nl?'boeken':'books'}</span>
        {x.score===null ? <span>{nl?'Nog onvoldoende informatie':'Not enough information yet'}</span> : <><span>{x.score}/100</span><meter min={0} max={100} value={x.score} aria-label={getTraitLabel(locale,x.trait)} /></>}
      </li>)}</ul> : <p>{nl?'Nog geen betrouwbare informatie.':'No reliable evidence yet.'}</p>}</div>)}</div>
    <p>{nl?'Onderwerpen (zoals geschiedenis en oorlog) en doelgroep: nog geen goedgekeurde kenmerken beschikbaar. Publicatieperiode is geen verhaalonderwerp.':'Subjects (such as history and war) and audience: no approved traits available yet. Publication era is not a story subject.'}</p>
    <h2>{nl?'Boeken om verder te ontdekken':'Books to discover next'}</h2>
    {result.recommendations.length===0 ? <p role="status">{nl?'Geen geschikte, beschikbare, nog niet gelezen boeken met betrouwbare kenmerken in deze taal. We verzinnen geen matches.':'No suitable, available unread books with reliable traits in this language. We do not invent matches.'} <a href="/browse">{nl?'Alle boeken bekijken':'Browse all books'}</a></p>
    : <div className="book-grid">{result.recommendations.map(x=><BookCard key={x.book.workId}
      book={x.book} wanted={wanted.has(getGuestWantedStorageId(x.book))} status={statuses.get(x.book.workId!)} onToggle={toggleWanted}
      resolveMissingCover={false} matchLabel={recommendationMatchLabel(x,locale)} detailReturnContext={{kind:'recommendations',path:'/taste-test/result'}} />)}</div>}
    <nav aria-label={nl?'Volgende stappen':'Next steps'} className="taste-next-steps"><a className="primary-cta" href="/taste-test">{nl?'Vrijwillig meer beoordelen':'Rate more, if you like'}</a><a href="/my-books">{nl?'Mijn profiel en boeken':'My profile and books'}</a></nav>
    <p>{nl?'Meer beoordelingen helpen je profiel verfijnen, vooral wanneer betrouwbare kenmerken beschikbaar zijn.':'More ratings help refine your profile, especially when reliable traits are available.'}</p>
  </section>;
}
