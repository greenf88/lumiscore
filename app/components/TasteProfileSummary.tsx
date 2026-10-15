'use client';
import type {RatingResultProfile} from '@/lib/taste-test/rating-result';
import {topSupportedAffinities} from '@/lib/taste-test/result-presentation';
import {getTraitLabel} from '@/lib/taste-test/traits';
import {PROFILE_POLICY} from '@/lib/taste-test/profile-policy';
import {useLumiScoreLocale} from './LumiScoreLocale';
const ARCHETYPES={worldbuilder:['Wereldbouwer','Worldbuilder'],sleuth:['Speurneus','Sleuth'],explorer:['Ontdekkingsreiziger','Explorer'],connector:['Verhalenverbinder','Story connector']};
export function TasteProfileSummary({profile,headingId,level=1}:{profile:RatingResultProfile;headingId:string;level?:1|2}){
  const {locale}=useLumiScoreLocale(),nl=locale==='nl',Heading=level===1?'h1':'h2';
  const preferences=topSupportedAffinities(profile),sparse=profile.ratingCount>0&&profile.coverage.contentRatio<PROFILE_POLICY.minimumContentCoverage;
  return <div className="taste-profile">
    <span className="eyebrow">{nl?'Jouw leessmaak':'Your reading taste'}</span>
    <Heading id={headingId}>{profile.archetype
      ? <><span className="taste-profile-spark" aria-hidden="true">✦</span>{nl?`Jij bent een ${ARCHETYPES[profile.archetype][0].toLocaleLowerCase('nl')}`:`You are ${profile.archetype==='explorer'?'an':'a'} ${ARCHETYPES[profile.archetype][1].toLocaleLowerCase('en')}`}</>
      : nl?'Nog even ontdekken':'Keep discovering'}</Heading>
    {!profile.archetype&&<p>{sparse?(nl?'Voor veel van deze boeken missen nog inhoudelijke kenmerken.':'Many of these books still lack usable content traits.'):(nl?'Beoordeel meer boeken om je smaak te vinden.':'Rate more books to find your reading taste.')}</p>}
    {preferences.length>0&&<ul className="taste-preferences">{preferences.map(x=><li key={x.trait}>
      <span>{getTraitLabel(locale,x.trait)}</span><span className="taste-preference-track" aria-hidden="true"><span style={{width:`${x.score}%`}} /></span>
    </li>)}</ul>}
  </div>;
}
