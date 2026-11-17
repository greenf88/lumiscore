'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {HeaderAuthState} from '@/lib/auth/header';
import type {Book} from '@/app/data/books';
import {draftKey,DRAFT_TTL,readBufferedDraft,type BufferedDecision,type BufferedRound} from '@/lib/taste-test/buffered-round';
import {isBookPresentationAllowed} from '@/lib/books/strict-edition';
import {localizedHref} from '@/lib/i18n/paths';
import {NEW_ROUND_GOALS} from '@/lib/taste-test/rating-round';
import {LocaleLink,useLumiScoreLocale} from './LumiScoreLocale';
import {DiscoveryPageShell} from './DiscoveryPageShell';
import {DirectRatingScores} from './DirectRatingScores';
import {BookCover} from './LumiScoreHome';
import {EditionPresentationLabel} from './EditionPresentationLabel';
import {TastePainting} from './TastePainting';

export function BufferedRatingTasteTest({authState}:{authState:HeaderAuthState}){
  const {locale,t}=useLumiScoreLocale(),nl=locale==='nl';
  const [data,setData]=useState<BufferedRound|null>(null),[draft,setDraft]=useState<BufferedDecision[]>([]);
  const draftRef=useRef(draft),busy=useRef(false),lastDecision=useRef(0);
  const [pending,setPending]=useState(false),[error,setError]=useState(''),[paused,setPaused]=useState(false),[storageFailed,setStorageFailed]=useState(false),[conflict,setConflict]=useState(false);
  const [chosen,setChosen]=useState<Book|null>(null),[query,setQuery]=useState(''),[searchOpen,setSearchOpen]=useState(false),[results,setResults]=useState<Book[]>([]),[searchError,setSearchError]=useState(false);
  const heading=useRef<HTMLHeadingElement>(null),searchInput=useRef<HTMLInputElement>(null),focusNext=useRef(false),expires=useRef(0);
  const round=data?.state?.round,key=data?.owner&&round?draftKey(data.owner,round.id):null;
  const rated=(round?.ratedCount??0)+draft.filter(d=>d.score!==null).length,goal=round?.goal??10;
  const book=(chosen&&!draft.some(d=>d.workId===chosen.workId)?chosen:null)??data?.books.find(b=>!draft.some(d=>d.workId===b.workId)&&isBookPresentationAllowed(b,locale));
  const finished=rated>=goal&&draft.length>0;
  const writeDraft=(next:BufferedDecision[])=>{
    draftRef.current=next;setDraft(next);
    if(key)try{sessionStorage.setItem(key,JSON.stringify({decisions:next,expires:expires.current}));}catch{setStorageFailed(true);}
  };
  const load=useCallback(async(signal?:AbortSignal)=>{
    const response=await fetch(`/api/taste-test/batch?locale=${locale}`,{cache:'no-store',signal});
    if(!response.ok)throw new Error();
    const next=await response.json() as BufferedRound&{decided?:BufferedDecision[]};if(signal?.aborted)return;
    let decisions:BufferedDecision[]=[]; expires.current=Date.now()+DRAFT_TTL;
    if(next.owner&&next.state?.round){
      const id=draftKey(next.owner,next.state.round.id);
      try{
        // Expired drafts are not restored. Keep each account/round separate.
        for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k?.startsWith('lumiscore-round-draft-v1:')&&!readBufferedDraft(sessionStorage.getItem(k)))sessionStorage.removeItem(k);}
        const saved=readBufferedDraft(sessionStorage.getItem(id));
        if(saved){expires.current=saved.expires;decisions=saved.decisions.filter(d=>!next.decided?.some(x=>x.workId===d.workId&&x.score===d.score));}
        sessionStorage.setItem(id,JSON.stringify({expires:expires.current,decisions}));
      }catch{setStorageFailed(true);}
    }
    draftRef.current=decisions;setDraft(decisions);setData(next);setChosen(null);setError('');
  },[locale]);
  useEffect(()=>{const controller=new AbortController();Promise.resolve().then(()=>load(controller.signal)).catch(()=>{if(!controller.signal.aborted)setError(nl?'De test kon niet laden. Probeer het opnieuw.':'The test could not load. Please try again.');});return()=>controller.abort();},[load,nl]);
  useEffect(()=>{if(focusNext.current&&book){heading.current?.focus({preventScroll:true});heading.current?.closest('article')?.scrollIntoView({block:'nearest',behavior:'instant'});focusNext.current=false;}},[book]);
  useEffect(()=>{if(searchOpen)searchInput.current?.focus();},[searchOpen]);
  useEffect(()=>{
    if(!draft.length)return;
    const warn=(event:BeforeUnloadEvent)=>{if(draftRef.current.length){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[draft.length]);
  useEffect(()=>{
    if(!searchOpen||query.trim().length<2)return;
    const controller=new AbortController();const timer=setTimeout(()=>{
      fetch(`/api/taste-test/candidates?q=${encodeURIComponent(query)}&locale=${locale}`,{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error();const value=await r.json() as {results?:Book[]};if(!controller.signal.aborted){setResults(value.results??[]);setSearchError(false);}}).catch(()=>{if(!controller.signal.aborted)setSearchError(true);});
    },250);return()=>{clearTimeout(timer);controller.abort();};
  },[query,searchOpen,locale]);
  const save=async(pause=false)=>{
    if(busy.current||!round||!data?.owner)return;
    if(!draftRef.current.length){setPaused(pause);if(!pause)await load().catch(()=>setError(nl?'Nieuwe boeken laden lukte niet.':'Could not load more books.'));return;}
    busy.current=true;setPending(true);setError('');setConflict(false);
    try{
      const response=await fetch('/api/taste-test/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:data.owner,roundId:round.id,decisions:draftRef.current})});
      if(!response.ok){setConflict(response.status===409);throw new Error(response.status===409?'conflict':'save');}
      const saved=await response.json() as {state:NonNullable<BufferedRound['state']>};
      if(key)try{sessionStorage.removeItem(key);sessionStorage.setItem('lumiscore-rating-changed','1');}catch{/* Optional cache invalidation. */}
      draftRef.current=[];setDraft([]);
      if(saved.state?.round?.complete){setData({...data,state:saved.state});window.location.assign(localizedHref('/taste-test/result',locale));return;}
      await load();setPaused(pause);
    }catch(e){setError((e as Error).message==='conflict'?(nl?'Deze ronde is intussen gewijzigd. Je tijdelijke antwoorden zijn behouden. Herlaad de ronde om de opgeslagen voortgang te controleren.':'This round has changed. Your temporary answers are kept. Reload the round to check saved progress.'):(nl?'Opslaan lukte niet. Je antwoorden staan nog klaar. Probeer het opnieuw.':'Saving did not work. Your answers are still here. Please try again.'));}
    finally{busy.current=false;setPending(false);}
  };
  // Only an explicit final rating starts saving. Restored finished drafts offer
  // an explicit retry, so mounting or switching accounts never writes ratings.
  const decide=(score:number|null)=>{
    if(busy.current||!book?.workId||finished||draftRef.current.length>=120||draftRef.current.some(d=>d.workId===book.workId)||performance.now()-lastDecision.current<250)return;
    lastDecision.current=performance.now();
    const next=[...draftRef.current,{workId:book.workId,score}];writeDraft(next);setChosen(null);focusNext.current=true;
    if((round?.ratedCount??0)+next.filter(d=>d.score!==null).length>=goal)void save();
  };
  const start=async(goal:number)=>{
    if(busy.current)return;busy.current=true;setPending(true);setError('');
    try{const r=await fetch(`/api/taste-test/rounds?locale=${locale}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start',language:locale,goal})});if(!r.ok)throw new Error();await load();setPaused(false);}
    catch{setError(nl?'Starten lukte niet. Probeer het opnieuw.':'Starting did not work. Please try again.');}finally{busy.current=false;setPending(false);}
  };
  return <DiscoveryPageShell authState={authState} path="/taste-test"><section className="featured-section taste-rating-test taste-direct-test" aria-labelledby="buffered-taste-title" aria-busy={pending}>
    <div className="taste-round-heading"><h1 id="buffered-taste-title">{t('directTaste.label')}</h1>{round&&!round.complete&&!paused&&<button disabled={pending} onClick={()=>void save(true)}>{nl?'Opslaan en pauzeren':'Save and pause'}</button>}</div>
    {error&&<div role="alert" className="taste-action-error"><p>{error}</p>{draft.length>0&&<button disabled={pending} onClick={()=>void save()}>{nl?'Opnieuw opslaan':'Retry saving'}</button>}<button disabled={pending} onClick={()=>void load().catch(()=>setError(nl?'Opnieuw laden lukte niet.':'Reload failed.'))}>{nl?'Ronde herladen':'Reload round'}</button>{conflict&&<button disabled={pending} onClick={()=>{if(!window.confirm(nl?'Tijdelijke antwoorden wissen? Je al opgeslagen beoordelingen blijven behouden.':'Clear temporary answers? Your saved ratings will be kept.'))return;writeDraft([]);setConflict(false);void load().catch(()=>setError(nl?'Herlaad de pagina om verder te gaan.':'Reload the page to continue.'));}}>{nl?'Tijdelijke antwoorden wissen en herladen':'Clear temporary answers and reload'}</button>}</div>}
    {!data&&!error&&<p role="status">{t('directTaste.loading')}</p>}
    {data&&!data.authenticated?<div><p>{t('directTaste.signInCopy')}</p><LocaleLink className="primary-cta" href="/taste-test/preferences">{t('directTaste.guest')}</LocaleLink><LocaleLink href="/login?next=%2Ftaste-test">{t('directTaste.signIn')}</LocaleLink></div>:data&&!data.available?<p>{t('directTaste.unavailable')}</p>:data&&<>
      {(!round||round.complete)&&!pending&&<div className="taste-start-screen"><h2>{t('directTaste.question')}</h2><div className="taste-start-choices">{NEW_ROUND_GOALS.map(n=><button key={n} disabled={pending} onClick={()=>void start(n)}><strong>{n}</strong><span>{t('directTaste.books')}</span></button>)}</div></div>}
      {pending&&finished?<TastePainting/>:pending?<p role="status">{nl?'Je ronde klaarmaken…':'Preparing your round…'}</p>:round&&!round.complete&&<>
        <div className="taste-direct-progress" role="status"><span>{t('directTaste.progress',{rated,goal})}</span><div role="progressbar" aria-label={t('directTaste.ratedBooks')} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(rated,goal)}><span style={{width:`${Math.min(100,rated/goal*100)}%`}}/></div></div>
        {storageFailed&&<p role="status">{nl?'Deze browser kan je antwoorden niet tijdelijk bewaren. Houd dit tabblad open tot je hebt opgeslagen.':'This browser cannot keep a temporary copy. Keep this tab open until you have saved.'}</p>}
        {paused?<div className="taste-paused"><p>{nl?'Je beoordelingen zijn opgeslagen.':'Your ratings are saved.'}</p><button className="primary-cta" onClick={()=>setPaused(false)}>{t('directTaste.resume')}</button></div>:finished?<button className="primary-cta" onClick={()=>void save()}>{nl?'Opslaan en mijn resultaat bekijken':'Save and see my result'}</button>:<>
          <p className="taste-buffer-note">{nl?'Beoordeel wat je kent. Onbekend? Sla over. We slaan alles samen op als je klaar bent.':'Rate what you know. Unfamiliar? Skip it. We’ll save everything together when you finish.'}</p>
          {book&&<article className="book-card taste-rating-card" key={book.workId}><div className="taste-book-identity"><BookCover book={book} presentation="taste"/><div className="book-card-body"><h2 ref={heading} tabIndex={-1}>{book.title}</h2><p>{book.author}</p><EditionPresentationLabel book={book}/></div></div><div className="taste-rating-actions"><DirectRatingScores workId={book.workId!} pending={false} selection={null} onRate={decide}/><button className="taste-skip-button" onClick={e=>{if(e.detail<=1)decide(null);}}>{t('directTaste.skip')}</button></div></article>}
          {(!book||draft.length>=120)&&<div role="status"><p>{nl?'Tijd voor een nieuwe stapel boeken.':'Time for a fresh stack of books.'}</p><button onClick={()=>void save()}>{nl?'Voortgang opslaan en meer boeken laden':'Save progress and load more books'}</button></div>}
          <button className="taste-search-toggle" aria-expanded={searchOpen} aria-controls="buffered-book-search" onClick={()=>setSearchOpen(x=>!x)}>{t('directTaste.find')}</button>
          {searchOpen&&<div className="taste-book-search" id="buffered-book-search"><label htmlFor="buffered-query">{t('directTaste.searchLabel')}</label><input ref={searchInput} id="buffered-query" value={query} maxLength={100} onChange={e=>{setQuery(e.target.value);setResults([]);setSearchError(false);}}/>{searchError&&<p role="status">{t('directTaste.searchError')}</p>}<ul className="taste-search-results">{results.filter(b=>b.workId&&!draft.some(d=>d.workId===b.workId)&&isBookPresentationAllowed(b,locale)).map(b=><li key={b.workId}><button onClick={()=>{setChosen(b);setSearchOpen(false);setQuery('');setResults([]);focusNext.current=true;}}>{b.title} — {b.author}</button></li>)}</ul></div>}
        </>}
      </>}
      {(Boolean(round?.complete)||Boolean(round?.ratedCount))&&<LocaleLink className="taste-result-link" href="/taste-test/result">{t('directTaste.result')}</LocaleLink>}
    </>}
  </section></DiscoveryPageShell>;
}
