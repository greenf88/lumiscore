'use client';
import {useEffect,useMemo,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import type { HeaderAuthState } from '@/lib/auth/header';
import {advice,nextCard,parseSession,storageKey,substantiveCount,swipeDecision,type MatchCard,type MatchSession,type InterestChoice} from '@/lib/bookmatch/model';
import {TASTE_TRAITS,getTraitLabel} from '@/lib/taste-test/traits';
import type {Locale} from '@/lib/i18n/config';
import type {Book} from '../data/books';
import {isReadingStatus,type ReadingStatus} from '@/lib/collections/model';
import {GUEST_WANTED_STORAGE_KEY,parseGuestWantedIds,getGuestWantedStorageId} from '@/lib/collections/guest-want-to-read';
import {useLumiScoreLocale} from './LumiScoreLocale';
import {DiscoveryPageShell} from './DiscoveryPageShell';
import {BookCard} from './LumiScoreHome';

const fresh=(history:string[]=[]):MatchSession=>({version:1,seed:crypto.randomUUID(),history,choices:[]});
export function Bookmatch({owner,authState}:{owner:string;authState:HeaderAuthState}) {
  const {locale}=useLumiScoreLocale();
  return <DiscoveryPageShell path="/bookmatch" authState={authState}><BookmatchRound key={`${owner}:${locale}`} owner={owner} locale={locale} authenticated={authState.authenticated}/></DiscoveryPageShell>;
}
function BookmatchRound({owner,locale,authenticated}:{owner:string;locale:Locale;authenticated:boolean}) {
  const nl=locale==='nl',key=storageKey(owner,locale);
  const [session,setSession]=useState<MatchSession|null>(null),[cards,setCards]=useState<MatchCard[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(false),[storageUnavailable,setStorageUnavailable]=useState(false);
  const activeRequest=useRef<AbortController|null>(null),pointer=useRef<{id:number;x:number;y:number}|null>(null),swiped=useRef(false);
  async function load(next:MatchSession,signal:AbortSignal) {
    setLoading(true);setError(false);
    try {
      const response=await fetch(`/api/bookmatch?seed=${next.seed}&seen=${encodeURIComponent(next.history.join(','))}`,{cache:'no-store',signal});
      if(!response.ok) throw new Error();
      const deck=await response.json() as {owner:string;cards:MatchCard[]};
      if(deck.owner!==owner) throw new Error(); // Never reuse an old owner's response.
      if(!signal.aborted) {setCards(deck.cards);setSession(next);setLoading(false);}
    } catch {if(!signal.aborted) {setError(true);setLoading(false);}}
  }
  useEffect(()=>{
    const controller=new AbortController();activeRequest.current=controller;
    void Promise.resolve().then(()=>{
      if(controller.signal.aborted) return;
      let initial:MatchSession|null=null;
      try {initial=parseSession(sessionStorage.getItem(key));} catch {setStorageUnavailable(true);}
      return load(initial??fresh(),controller.signal);
    });
    return ()=>{controller.abort();activeRequest.current?.abort();};
    // Owner/language remount the complete session and invalidate its old requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key]);
  function persist(next:MatchSession) {
    setSession(next);
    try {sessionStorage.setItem(key,JSON.stringify(next));} catch {setStorageUnavailable(true);}
  }
  const count=session?substantiveCount(session.choices):0;
  const current=session?nextCard(cards,session.choices):undefined;
  const finished=count>=10 || (!!session && !current);
  const suggestion=useMemo(()=>session && finished ? advice(cards,session.choices,locale):null,[cards,session,finished,locale]);
  function choose(decision:InterestChoice['decision']) {
    if(!session || !current?.book.workId || finished || loading || error) return;
    persist({...session,choices:[...session.choices,{workId:current.book.workId,decision}]});
  }
  function undo() {if(session && session.choices.length) persist({...session,choices:session.choices.slice(0,-1)});}
  function restart() {
    if(!session) return;
    const history=[...new Set([...session.history,...session.choices.map(x=>x.workId),...(suggestion?.card.book.workId?[suggestion.card.book.workId]:[])])];
    if(history.length>1000) {setError(true);return;}
    const next=fresh(history);persist(next);activeRequest.current?.abort();
    const controller=new AbortController();activeRequest.current=controller;void load(next,controller.signal);
  }
  function keyboard(event:KeyboardEvent<HTMLElement>) {
    if((event.target as HTMLElement).closest('button,a,input,select,textarea')) return;
    const action={ArrowRight:'interested',ArrowLeft:'not-for-me',ArrowDown:'skip'}[event.key] as InterestChoice['decision']|undefined;
    if(action) {event.preventDefault();choose(action);} else if(event.key==='Backspace') {event.preventDefault();undo();}
  }
  function down(event:PointerEvent<HTMLElement>) {swiped.current=false;if(!(event.target as HTMLElement).closest('button')) pointer.current={id:event.pointerId,x:event.clientX,y:event.clientY};}
  function move(event:PointerEvent<HTMLElement>) {
    const start=pointer.current;
    if(start && start.id===event.pointerId && Math.abs(event.clientX-start.x)>15 && Math.abs(event.clientX-start.x)>Math.abs(event.clientY-start.y)*1.5) event.currentTarget.setPointerCapture(event.pointerId);
  }
  function up(event:PointerEvent<HTMLElement>) {
    const start=pointer.current;pointer.current=null;
    if(!start || start.id!==event.pointerId) return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    const decision=swipeDecision(dx,dy);
    if(decision) {swiped.current=true;choose(decision);}
  }
  return <section className="featured-section bookmatch" aria-labelledby="bookmatch-title">
    <span className="eyebrow">{nl?'Boekmatch · Experimenteel prototype':'Bookmatch · Experimental prototype'}</span>
    <h1 id="bookmatch-title">{nl?'Tien swipes. Eén volgend boek.':'Ten swipes. One next book.'}</h1>
    <p>{nl?'Kies wat je aanspreekt. Dit zijn interesses, geen beoordelingen of gelezenstatussen. Alleen lokaal/Preview.':'Choose what interests you. These are interests, not ratings or read statuses. Local/Preview only.'}</p>
    {storageUnavailable && <p role="status">{nl?'Lokale sessieopslag is niet beschikbaar; verversen kan je keuzes verliezen.':'Session storage is unavailable; refreshing may lose your choices.'}</p>}
    <div className="bookmatch-stage" aria-busy={loading}>
    {loading ? <p role="status">{nl?'Beschikbare boeken laden…':'Loading available books…'}</p> : error ? <div role="alert"><h2>{nl?'Boekmatch kon niet laden':'Bookmatch could not load'}</h2><p>{nl?'Dit is een laadfout, geen lege catalogus. Bij 1.000 eerdere kaarten is de prototypesessie begrensd.':'This is a loading error, not an empty catalog. The prototype session is bounded at 1,000 earlier cards.'}</p><button onClick={()=>{activeRequest.current?.abort();const c=new AbortController();activeRequest.current=c;void load(session??fresh(),c.signal);}}>{nl?'Opnieuw proberen':'Retry'}</button></div>
    : session && <>
      <p role="status">{count}/10 {nl?'inhoudelijke keuzes':'substantive choices'} · {session.choices.filter(x=>x.decision==='skip').length} {nl?'overgeslagen':'skipped'}</p>
      <button disabled={!session.choices.length} onClick={undo}>{nl?'Vorige keuze herstellen':'Undo previous choice'}</button>
      {!finished && current ? <div className="bookmatch-card" role="group" aria-label={nl?'Boek kiezen; pijltjestoetsen links/rechts, omlaag overslaan':'Choose a book; left/right arrows, down to skip'} tabIndex={0} onKeyDown={keyboard} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{pointer.current=null;swiped.current=false;}} onDragStart={event=>event.preventDefault()} onClickCapture={event=>{if(swiped.current) {event.preventDefault();event.stopPropagation();swiped.current=false;}}}>
        <BookCard book={current.book} wanted={false} onToggle={()=>{}} hideWishlistAction resolveMissingCover={false} detailReturnContext={{kind:'recommendations',path:'/bookmatch'}}/>
        <p>{TASTE_TRAITS.filter(t=>current.traits[t]>0).map(t=>getTraitLabel(locale,t)).join(' · ')}</p>
        <div className="bookmatch-actions"><button onClick={()=>choose('not-for-me')}>{nl?'Niet voor mij':'Not for me'}</button><button onClick={()=>choose('interested')}>{nl?'Spreekt me aan':'Interested'}</button><button onClick={()=>choose('skip')}>{nl?'Overslaan':'Skip'}</button></div>
        <p className="bookmatch-help">{nl?'Swipe links/rechts of gebruik de knoppen. Focus op de kaart: ← / → kiezen, ↓ overslaan, Backspace herstellen.':'Swipe left/right or use buttons. Focus the card: ← / → choose, ↓ skip, Backspace undo.'}</p>
      </div> : <div className="bookmatch-advice"><h2>{nl?count>=10?'Jouw volgende boek':'Je tussenresultaat':count>=10?'Your next book':'Your interim result'}</h2>
        {count<10 && <p>{nl?'Niet genoeg nieuwe geschikte kaarten voor tien keuzes. We tellen geen skips of fictieve antwoorden mee.':'Not enough new suitable cards for ten choices. Skips or fictitious answers do not count.'}</p>}
        {suggestion ? <><WishlistAdvice book={suggestion.card.book} authenticated={authenticated} locale={locale}/><p>{suggestion.reason}</p></> : <p>{nl?'Geen ongekozen beschikbaar boek over voor een advies. Probeer een andere taal of later opnieuw.':'No unchosen available book remains for advice. Try another language or return later.'}</p>}
        <button onClick={restart}>{nl?'Opnieuw ontdekken':'Discover again'}</button>
      </div>}
    </>}
    </div>
  </section>;
}
// Interest events never call this writer. Only an explicit wishlist click does.
function WishlistAdvice({book,authenticated,locale}:{book:Book;authenticated:boolean;locale:Locale}) {
  const [status,setStatus]=useState<ReadingStatus|null>(null),[ready,setReady]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    if(!authenticated) {
      void Promise.resolve().then(()=>{
        if(controller.signal.aborted) return;
        try {setStatus(parseGuestWantedIds(localStorage.getItem(GUEST_WANTED_STORAGE_KEY)).includes(getGuestWantedStorageId(book))?'want_to_read':null);setReady(true);} catch {setError(true);}
      });
      return ()=>controller.abort();
    }
    fetch(`/api/book-status?workIds=${book.workId}`,{cache:'no-store',signal:controller.signal}).then(async r=>{
      if(!r.ok) throw new Error();const payload=await r.json() as {statuses?:Record<string,string>};const value=payload.statuses?.[book.workId!];
      if(!controller.signal.aborted) {setStatus(isReadingStatus(value)?value:null);setReady(true);}
    }).catch(()=>{if(!controller.signal.aborted) setError(true);});
    return ()=>controller.abort();
  },[book,authenticated]);
  async function save() {
    if(!ready || saving || status) return;
    setSaving(true);setError(false);
    try {
      if(authenticated) {
        const r=await fetch('/api/bookmatch/wishlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workId:book.workId})});
        if(!r.ok) throw new Error();const result=await r.json() as {status?:string};
        if(!isReadingStatus(result.status)) throw new Error();
        setStatus(result.status);return;
      }
      else {const ids=parseGuestWantedIds(localStorage.getItem(GUEST_WANTED_STORAGE_KEY));localStorage.setItem(GUEST_WANTED_STORAGE_KEY,JSON.stringify([...new Set([...ids,getGuestWantedStorageId(book)])]));}
      setStatus('want_to_read');
    } catch {setError(true);} finally {setSaving(false);}
  }
  return <><BookCard book={book} wanted={false} onToggle={()=>{}} hideWishlistAction resolveMissingCover={false} detailReturnContext={{kind:'recommendations',path:'/bookmatch'}}/>
    <button disabled={!ready || saving || !!status} onClick={()=>void save()}>{status==='want_to_read'?locale==='nl'?'Bewaard op je leeslijst':'Saved to your reading list':status?locale==='nl'?'Bestaande leesstatus behouden':'Existing reading status preserved':locale==='nl'?'Bewaren op leeslijst':'Save to reading list'}</button>
    {error && <p role="alert">{locale==='nl'?'Leeslijst kon niet worden gecontroleerd of opgeslagen. Er is geen succes bevestigd.':'The reading list could not be checked or saved. Success has not been confirmed.'}</p>}</>;
}
