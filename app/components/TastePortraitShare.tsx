'use client';
import {useEffect,useState} from 'react';
import type {SharePortrait} from '@/lib/taste-test/share-portrait';
export function TastePortraitShare({portrait}:{portrait:SharePortrait}) {
  const [file,setFile]=useState<File|null>(null),[status,setStatus]=useState('');
  const [failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  const nl=portrait.locale==='nl';
  useEffect(()=>{
    let active=true;
    import('@/lib/taste-test/share-portrait').then(({renderSharePortrait})=>renderSharePortrait(portrait))
      .then(blob=>{if(active){setFile(new File([blob],'lumiscore-leespersonage.png',{type:'image/png'}));setFailed(false);}})
      .catch(()=>{if(active)setFailed(true);});
    return()=>{active=false;};
  },[portrait,retry]);
  const download=()=>{
    if(!file)return;
    const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=file.name;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
    setStatus(nl?'Je afbeelding is klaar om te delen.':'Your image is ready to share.');
  };
  const share=async()=>{
    if(!file)return;
    if(!navigator.canShare?.({files:[file]})){download();return;}
    try{await navigator.share({files:[file],title:portrait.title});setStatus('');}
    catch(error){if((error as Error).name!=='AbortError')setStatus(nl?'Delen lukte niet. Je kunt de afbeelding ook downloaden.':'Sharing did not work. You can download the image instead.');}
  };
  return <div className="taste-portrait-share">
    {failed?<button onClick={()=>{setFailed(false);setRetry(x=>x+1);}}>{nl?'Deelafbeelding opnieuw maken':'Retry share image'}</button>:<>
      <button className="primary-cta" type="button" disabled={!file} onClick={share}>{file?(nl?'Deel je leespersonage':'Share your reading character'):(nl?'Deelafbeelding maken…':'Preparing your share image…')}</button>
      {file&&<button className="taste-download" type="button" onClick={download}>{nl?'Download afbeelding':'Download image'}</button>}</>}
    {status&&<p role="status">{status}</p>}
  </div>;
}
