// Loopback-only synthetic review data; never imported by an application route.
import {books} from './fixture';
import {buildTasteProfile} from '../../lib/taste-test/profile';
import {tasteVector} from '../../lib/taste-test/traits';
import {calculatePersonalMatch} from '../../lib/recommendations/engine';
import type {Locale} from '../../lib/i18n/config';
import type {Book,VerifiedBookDescription} from '../../app/data/books';
const vectors=[tasteVector({thriller_mystery:1}),tasteVector({science_fiction:1}),tasteVector({literary:1})];
const profile=buildTasteProfile({},Array.from({length:12},(_,i)=>({workId:String(800000+i),rating:9,traits:vectors[i%3]})));
export async function loadHomepagePersonalization(locale:Locale='en'){
 return {authenticated:true,hasEvidence:true,ratingCount:12,tasteTestAnsweredCount:10,recommendations:books.slice(0,3).map((book,i)=>({
  book:i===2?{...book,score:null,ratingBand:null}:book,
  ...calculatePersonalMatch({profile,candidate:{traits:vectors[i],coverageLevel:'rich',metadataConfidence:1},workId:book.workId!,locale}),
  collaborativeExplanation:'',
 }))};
}
export async function loadPublicBookDescription(book:Book,locale:Locale):Promise<VerifiedBookDescription|null>{
 if(book.workId==='990003')return null;
 const paragraph=locale==='nl'?'Dit is uitsluitend een synthetische beschrijving om typografie, regelafbreking en de bronvermelding lokaal te beoordelen. Het is geen gepubliceerde boekinhoud.'
  :'This is a synthetic description for local review of typography, line wrapping and attribution. It is not published book content.';
 return {text:[paragraph,paragraph,paragraph,paragraph].join('\n\n'),language:locale,source:book.workId==='990002'?'google_books':'open_library',sourceKey:book.workId==='990002'?'9780441172719':'OL893415W',verifiedAt:'2026-10-15'};
}
