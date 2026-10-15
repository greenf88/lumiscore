import type {SupabaseClient} from '@supabase/supabase-js';
import {cache} from 'react';
import {loadReaderRows} from './reader-rows.ts';
import {loadWorkTraitEvidenceBatched} from './work-trait-evidence.ts';
import {buildEffectiveWorkTraitVector} from '../recommendations/work-trait-evidence.ts';
import {getReviewedWorkTraitCorrection} from '../recommendations/reviewed-work-trait-corrections.ts';
import {buildRatingResultProfile} from '../taste-test/rating-result.ts';
import {TASTE_TEST_QUESTIONS,TASTE_TEST_VERSION,type TasteTestAnswers,type TasteTestChoice} from '../taste-test/config.ts';
import type {Locale} from '../i18n/config.ts';

export type ReaderRatingRow={work_id:number|string;rating:number;updated_at?:string|null};
export type ReaderStatusRow={work_id:number|string;status:string};
export function rowsToTasteAnswers(rows:readonly {question_key:string;choice:string}[]):TasteTestAnswers{
  const answers:TasteTestAnswers={};
  for(const row of rows)if(TASTE_TEST_QUESTIONS.some(q=>q.key===row.question_key)&&['left','right','neither'].includes(row.choice))answers[row.question_key as keyof TasteTestAnswers]=row.choice as TasteTestChoice;
  return answers;
}
// The caller supplies only the already verified owner. Request-local React cache;
// never a public/module personal cache. No catalog hydration or ranking here.
export const loadReaderTasteProfile=cache(async(client:SupabaseClient,userId:string,locale:Locale='en')=>{
  const [ratings,statuses,responses]=await Promise.all([
    loadReaderRows<ReaderRatingRow>(client,'ratings','work_id,rating,updated_at',userId),
    loadReaderRows<ReaderStatusRow>(client,'user_book_status','work_id,status',userId),
    client.from('taste_test_responses').select('question_key,choice').eq('user_id',userId).eq('quiz_version',TASTE_TEST_VERSION).in('question_key',TASTE_TEST_QUESTIONS.map(q=>q.key)).order('question_key'),
  ]);
  if(responses.error)throw responses.error;if(!Array.isArray(responses.data))throw new Error('Taste answers unavailable.');
  const answers=rowsToTasteAnswers(responses.data);
  const raw=await loadWorkTraitEvidenceBatched(client,ratings.map(r=>String(r.work_id)));
  const evidence=new Map(ratings.map(r=>{const id=String(r.work_id);return [id,buildEffectiveWorkTraitVector(raw.get(id)??[],getReviewedWorkTraitCorrection(id))] as const;}));
  const profile=buildRatingResultProfile(ratings.map(r=>({workId:String(r.work_id),rating:r.rating,updatedAt:r.updated_at})),evidence,answers,locale);
  return {ratings,statuses,answers,profile};
});
