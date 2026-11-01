'use client';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {useLumiScoreLocale} from './LumiScoreLocale';
import {ANALYSIS_VERSION,parseAnalysisReply,type AnalysisChoice} from '@/lib/product-metrics/consent';
import {analysisRevision,serverAnalysisRevision,subscribeAnalysis,applyAnalysisPermission,browserMetricsEnabled} from '@/lib/product-metrics/browser';

export function ProductAnalysisConsent(){
 const {locale}=useLumiScoreLocale(),nl=locale==='nl';
 const [choice,setChoice]=useState<AnalysisChoice>('unknown'),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[storedMessage,setMessage]=useState<'off'|'on'|'unavailable'|'pending'>('off');
 const button=useRef<HTMLButtonElement>(null),heading=useRef<HTMLHeadingElement>(null),channel=useRef<BroadcastChannel|null>(null),generation=useRef(0);
 useSyncExternalStore(subscribeAnalysis,analysisRevision,serverAnalysisRevision);
 const message=storedMessage==='on'&&!browserMetricsEnabled()?'off':storedMessage;
 useEffect(()=>{
  const controller=new AbortController();
  const restore=async()=>{const initial=generation.current;try{const r=await fetch('/api/product-analysis-consent',{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();const s=parseAnalysisReply(await r.json());if(generation.current!==initial)return;
   const c:AnalysisChoice=['accepted','denied'].includes(s.choice)?s.choice:'unknown';setChoice(c);applyAnalysisPermission(s.active===true,Number(s.expires),'restored');setMessage(s.active?'on':c==='accepted'?'unavailable':'off');if(c==='unknown')setOpen(true);
  }catch{if(!controller.signal.aborted){applyAnalysisPermission(false);setMessage('unavailable');}}};
  void restore();
  if(typeof BroadcastChannel!=='undefined'){const ch=new BroadcastChannel('lumiscore-analysis-choice-v1');channel.current=ch;ch.onmessage=()=>{generation.current++;applyAnalysisPermission(false);setChoice('denied');setMessage('off');};}
  const visibility=()=>{if(document.visibilityState==='visible')void restore();};document.addEventListener('visibilitychange',visibility);
  return()=>{controller.abort();channel.current?.close();channel.current=null;document.removeEventListener('visibilitychange',visibility);};
 },[]);
 async function choose(next:'accepted'|'denied'){
  const operation=++generation.current;applyAnalysisPermission(false);setBusy(true);setMessage('off');if(next==='denied')channel.current?.postMessage('stop');
  try{const r=await fetch('/api/product-analysis-consent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({choice:next,version:ANALYSIS_VERSION}),cache:'no-store'});if(!r.ok)throw Error();const s=parseAnalysisReply(await r.json());
   if(generation.current!==operation){applyAnalysisPermission(false);if(next==='accepted')await fetch('/api/product-analysis-consent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({choice:'denied',version:ANALYSIS_VERSION}),cache:'no-store'});return;}
   setChoice(next);applyAnalysisPermission(s.active===true,Number(s.expires),next==='accepted'?'accepted':'revoked');setMessage(s.pending?'pending':s.active?'on':next==='accepted'?'unavailable':'off');}
  catch{setMessage(next==='denied'?'pending':'unavailable');}finally{setBusy(false);}
 }
 const close=()=>{setOpen(false);button.current?.focus();};
 return <aside className="product-analysis-settings" aria-label={nl?'Analysevoorkeuren':'Analytics preferences'}>
  <button ref={button} type="button" className="ui-control ui-secondary" aria-expanded={open} aria-controls="product-analysis-panel" onClick={()=>{setOpen(x=>!x);if(!open)requestAnimationFrame(()=>heading.current?.focus());}}>{nl?'Analysevoorkeuren':'Analytics preferences'}</button>
  {open?<section id="product-analysis-panel" aria-labelledby="product-analysis-heading" onKeyDown={e=>{if(e.key==='Escape')close();}}>
   <h2 ref={heading} tabIndex={-1} id="product-analysis-heading">{nl?'Help LumiScore verbeteren':'Help improve LumiScore'}</h2>
   <p>{nl?'Optioneel meten we gebruik en campagneherkomst, zonder namen, e-mailadressen of zoekteksten. Zonder jouw toestemming blijft dit uit. Beoordelen en aanmelden werken ook als je weigert.':'Optional measurements help us understand usage and campaign sources, without names, email addresses or search text. They stay off without your consent. Rating and signing in also work if you decline.'}</p>
   <p>{nl?'Je keuze is 90 dagen geldig. Je kunt hier altijd intrekken. Eerdere totalen worden niet aan een bezoeker gekoppeld; intrekken verwijdert die niet.':'Your choice lasts 90 days. You can withdraw here at any time. Earlier totals are not linked to a visitor; withdrawing does not delete them.'}</p>
   <div className="product-analysis-actions">
    <button type="button" className="ui-control ui-secondary" disabled={busy} onClick={()=>void choose('accepted')}>{nl?'Accepteren':'Accept'}</button>
    <button type="button" className="ui-control ui-secondary" disabled={busy} onClick={()=>void choose('denied')}>{choice==='accepted'?(nl?'Toestemming intrekken':'Withdraw consent'):(nl?'Weigeren':'Decline')}</button>
   </div>
   <p role="status">{message==='on'?(nl?'Optionele metingen staan aan.':'Optional measurements are on.'):message==='pending'?(nl?'Lokaal staat meten uit. Intrekking op de server is nog niet bevestigd; probeer opnieuw. Reeds verwerkte verzoeken kunnen niet worden teruggehaald.':'Local measurement is off. Server withdrawal is not yet confirmed; try again. Already processed requests cannot be recalled.'):message==='unavailable'?(nl?'Metingen staan uit: de meetdienst is nog niet beschikbaar of je browser blokkeert metingen.':'Measurements are off: the measurement service is unavailable or your browser blocks measurement.'):(nl?'Optionele metingen staan uit.':'Optional measurements are off.')}</p>
   <button type="button" className="ui-control ui-secondary" onClick={close}>{nl?'Sluiten':'Close'}</button>
  </section>:null}
 </aside>;
}
