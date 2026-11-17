'use client';
import type {RatingResultProfile} from '@/lib/taste-test/rating-result';
import {readingTastePortrait} from '@/lib/taste-test/result-presentation';
import {getTraitLabel} from '@/lib/taste-test/traits';
import {LocaleLink,useLumiScoreLocale} from './LumiScoreLocale';
export type TasteAnchor = {workId:string;title:string;rating:number};
export function TasteProfileSummary({profile,headingId,level=1,anchors=[]}:{profile:RatingResultProfile;headingId:string;level?:1|2;anchors?:TasteAnchor[]}){
  const {locale}=useLumiScoreLocale(),nl=locale==='nl',Heading=level===1?'h1':'h2';
  const {title,summary,evidence,preferences}=readingTastePortrait(profile,locale);
  return <div className="taste-profile">
    <span className="eyebrow">{nl?'Jouw leessmaak':'Your reading taste'}</span>
    <Heading id={headingId}><span className="taste-profile-spark" aria-hidden="true">✦</span>{title}</Heading>
    <p>{summary}</p>
    {preferences.length>0&&<ul className="taste-preferences">{preferences.map(x=><li key={x.trait}>
      <span>{getTraitLabel(locale,x.trait)}</span><span className="taste-preference-track" aria-hidden="true"><span style={{width:`${x.score}%`}} /></span>
    </li>)}</ul>}
    {anchors.length>0&&<div className="taste-profile-anchors"><strong>{nl?'Boeken die jij hoog beoordeelde':'Books you rated highly'}</strong>
      <ul>{anchors.map(book=><li key={book.workId}><LocaleLink href={`/book/${book.workId}`}>{book.title}</LocaleLink> <span>{book.rating}/10</span></li>)}</ul>
    </div>}
    <p className="taste-profile-evidence">{evidence}</p>
  </div>;
}
