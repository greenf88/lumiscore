'use client';
import type {RatingResultProfile} from '@/lib/taste-test/rating-result';
import {readingTastePortrait} from '@/lib/taste-test/result-presentation';
import {getTraitLabel} from '@/lib/taste-test/traits';
import {LocaleLink,useLumiScoreLocale} from './LumiScoreLocale';
export type TasteAnchor = {workId:string;title:string;rating:number};
export function TasteProfileSummary({profile,headingId,level=1,anchors=[],showInsufficient=false}:{profile:RatingResultProfile;headingId:string;level?:1|2;anchors?:TasteAnchor[];showInsufficient?:boolean}){
  const {locale}=useLumiScoreLocale(),nl=locale==='nl',Heading=level===1?'h1':'h2';
  const {title,summary,evidence,preferences,clearLeader}=readingTastePortrait(profile,locale);
  const [leading,...additional]=preferences;
  if (!showInsufficient && !profile.archetype && preferences.length===0) return null;
  return <div className="taste-profile">
    <span className="eyebrow">{nl?'Jouw leessmaak':'Your reading taste'}</span>
    <div className={leading?'taste-profile-leading':undefined}>
      {leading&&<span className="taste-leading-label">{clearLeader?(nl?'Je sterkste voorkeur':'Your strongest preference'):(nl?'Voorop in je leessmaak':'Leading your reading taste')}</span>}
      <Heading id={headingId}><span className="taste-profile-spark" aria-hidden="true">✦</span>{leading?getTraitLabel(locale,leading.trait).replace(/^./u,c=>c.toLocaleUpperCase(locale)):title}</Heading>
      <p>{leading?(clearLeader?(nl?'Deze voorkeur komt het duidelijkst terug in je positieve beoordelingen en keuzes.':'This preference stands out most in your positive ratings and choices.'):(nl?'Je belangrijkste voorkeuren liggen dicht bij elkaar. Deze leesrichting komt als eerste naar voren.':'Your leading preferences are close together. This reading direction comes first.')):summary}</p>
    </div>
    {additional.length>0&&<div className="taste-profile-additional"><strong>{nl?'Ook passend bij jouw smaak':'Also part of your reading taste'}</strong><ul className="taste-preferences">{additional.map(x=><li key={x.trait}>{getTraitLabel(locale,x.trait)}</li>)}</ul></div>}
    {anchors.length>0&&<div className="taste-profile-anchors"><strong>{nl?'Boeken die jij hoog beoordeelde':'Books you rated highly'}</strong>
      <ul>{anchors.map(book=><li key={book.workId}><LocaleLink href={`/book/${book.workId}`}>{book.title}</LocaleLink> <span>{book.rating}/10</span></li>)}</ul>
    </div>}
    <p className="taste-profile-evidence">{evidence}</p>
  </div>;
}
