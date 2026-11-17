'use client';
import type {RatingResultProfile} from '@/lib/taste-test/rating-result';
import {readingTastePortrait} from '@/lib/taste-test/result-presentation';
import {getTraitLabel} from '@/lib/taste-test/traits';
import {readerPersona} from '@/lib/taste-test/reader-persona';
import {useMemo} from 'react';
import {TastePortraitShare} from './TastePortraitShare';
import {LocaleLink,useLumiScoreLocale} from './LumiScoreLocale';
export type TasteAnchor = {workId:string;title:string;rating:number};
export function TasteProfileSummary({profile,headingId,level=1,anchors=[],showInsufficient=false,shareable=false}:{profile:RatingResultProfile;headingId:string;level?:1|2;anchors?:TasteAnchor[];showInsufficient?:boolean;shareable?:boolean}){
  const {locale}=useLumiScoreLocale(),nl=locale==='nl',Heading=level===1?'h1':'h2';
  const {title,summary,evidence,preferences}=readingTastePortrait(profile,locale);
  const persona=readerPersona(profile,locale);
  const share=useMemo(()=>{const p=readerPersona(profile,locale);return p?{title:p.title,image:p.image,locale,bars:readingTastePortrait(profile,locale).preferences.map(x=>({label:getTraitLabel(locale,x.trait),score:x.score!}))}:null;},[profile,locale]);
  if (!showInsufficient && !profile.archetype && preferences.length===0) return null;
  return <div className="taste-profile">
    <span className="eyebrow">{nl?'Jouw leessmaak':'Your reading taste'}</span>
    <div className="taste-portrait-heading">
      {persona&&<img className="taste-persona-image" src={persona.image} width={640} height={640} alt="" decoding="async" loading={shareable?'eager':'lazy'} />}
      <Heading id={headingId}><span className="taste-profile-spark" aria-hidden="true">✦</span>{persona?.title??title}</Heading>
      <p>{persona?.description??summary}</p>
    </div>
    {preferences.length>0&&<div className="taste-profile-bars"><strong>{nl?'Dit kleurt jouw leessmaak':'The colours of your reading taste'}</strong><ul>{preferences.map((x,index)=><li key={x.trait}><span>{getTraitLabel(locale,x.trait)}</span><div role="meter" aria-label={getTraitLabel(locale,x.trait)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={x.score!} aria-valuetext={nl?`Voorkeurssterkte ${Math.round(x.score!)} op 100`:`Preference strength ${Math.round(x.score!)} out of 100`} className={index===0?'taste-bar-primary':'taste-bar'}><i style={{width:`${x.score}%`}}/></div></li>)}</ul></div>}
    {shareable&&share&&<TastePortraitShare key={JSON.stringify(share)} portrait={share}/>}
    {anchors.length>0&&<div className="taste-profile-anchors"><strong>{nl?'Boeken die jij hoog beoordeelde':'Books you rated highly'}</strong>
      <ul>{anchors.map(book=><li key={book.workId}><LocaleLink href={`/book/${book.workId}`}>{book.title}</LocaleLink> <span>{book.rating}/10</span></li>)}</ul>
    </div>}
    <p className="taste-profile-evidence">{evidence}</p>
  </div>;
}
