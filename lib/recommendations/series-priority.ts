import type { Book } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import { calculateSeriesProgress, type CollectionBook, type ReadingStatus } from '../collections/model.ts';
import { getReviewedSeriesMetadata } from '../collections/reviewed-series-metadata.ts';
import type { TasteMembership } from '../taste-test/eligibility.ts';
import type { PersonalizedRecommendation } from './engine.ts';

export type SeriesPriority = {book:Book;slug:string;starterTitle:string;rating:number;updatedAt:string|null};
export function seriesPriorities(input:{
  memberships:ReadonlyMap<string,readonly TasteMembership[]>; books:ReadonlyMap<string,Book>;
  ratings:readonly {workId:string;rating:number;updatedAt?:string|null}[];
  statuses:ReadonlyMap<string,ReadingStatus>;language:Locale;
}):SeriesPriority[]{
  const grouped=new Map<string,{workId:string;member:TasteMembership}[]>();
  for(const [workId,members] of input.memberships)for(const member of members)if(member.type==='series'){
    grouped.set(member.slug,[...(grouped.get(member.slug)??[]),{workId,member}]);
  }
  const ratedIds=new Set(input.ratings.map(r=>r.workId)),result:SeriesPriority[]=[];
  for(const [slug,rows] of grouped){
    const meta=getReviewedSeriesMetadata(slug);if(!meta)continue;
    if(rows.some(r=>r.member.expectedTotal!==meta.expectedMainSeriesTotal||r.member.sequence===null||(r.member.subgroup!==null&&r.member.subgroup!=='main')))continue;
    const first=rows.find(r=>r.member.sequence===1);if(!first||rows.filter(r=>r.member.sequence===1).length!==1)continue;
    const rating=input.ratings.find(r=>r.workId===first.workId);if(!rating||![9,10].includes(rating.rating))continue;
    // Placeholder identities retain missing positions. Never remove a missing edition
    // and then pick a later translated volume.
    const ordered:CollectionBook[]=rows.map(r=>({workId:r.workId,sequenceNumber:r.member.sequence,publicationOrder:null,subgroup:r.member.subgroup,
      book:input.books.get(r.workId)??{id:r.workId,source:'supabase',workId:r.workId,title:'',author:'',score:null,ratingsCount:null,match:null,cover:'orbit'}}));
    const progress=calculateSeriesProgress(ordered,input.statuses,meta.expectedMainSeriesTotal,ratedIds);
    const target=progress.sequenceComplete?progress.nextBook:null;if(!target)continue;
    const book=input.books.get(target.workId);
    if(!book||book.strictEditionLanguage!==input.language)continue;
    result.push({book,slug,starterTitle:first.member.name,rating:rating.rating,updatedAt:rating.updatedAt??null});
  }
  // Higher starter rating, then most recent rating, then stable series slug/Work ID.
  const time=(s:string|null)=>s&&Number.isFinite(Date.parse(s))?Date.parse(s):0;
  return result.sort((a,b)=>b.rating-a.rating||time(b.updatedAt)-time(a.updatedAt)||(a.slug<b.slug?-1:a.slug>b.slug?1:0)||Number(a.book.workId)-Number(b.book.workId));
}
export function prioritizeSeriesRecommendations(base:readonly PersonalizedRecommendation[],priorities:readonly SeriesPriority[],locale:Locale,limit=20):PersonalizedRecommendation[]{
  const seen=new Set<string>(),result:PersonalizedRecommendation[]=[];
  for(const p of priorities){
    if(!p.book.workId||seen.has(p.book.workId))continue;seen.add(p.book.workId);
    result.push({book:p.book,matchScore:null,matchLabel:null,matchConfidence:'low',coverageLevel:'none',metadataConfidence:0,collaborativeExplanation:'',
      explanation:locale==='nl'?`Je gaf het eerste hoofddeel van ${p.starterTitle} een ${p.rating}/10. Dit is het volgende ongelezen hoofddeel.`:`You rated the first main volume of ${p.starterTitle} ${p.rating}/10. This is the next unread main volume.`});
  }
  for(const rec of base){if(!rec.book.workId||seen.has(rec.book.workId))continue;seen.add(rec.book.workId);result.push(rec);}
  return result.slice(0,limit);
}
