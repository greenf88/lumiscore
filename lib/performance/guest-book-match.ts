import type {PersonalMatchResult} from '../recommendations/engine.ts';
import type {BookDetailPersonalization} from '../supabase/taste-test.ts';
import type {Locale} from '../i18n/config.ts';

/** Optional personalisation must not hydrate its calculation graph for a new
 * visitor without answers. The exact existing algorithm and inputs are retained. */
export async function loadGuestBookMatch(raw:string|null,candidate:NonNullable<BookDetailPersonalization['candidate']>,workId:string,locale:Locale):Promise<{hasEvidence:boolean;match:PersonalMatchResult|null}> {
 if(!raw?.trim()||raw.trim()==='{}')return {hasEvidence:false,match:null};
 const {parseGuestTasteTestAnswers}=await import('../taste-test/guest-storage.ts');
 const answers=parseGuestTasteTestAnswers(raw);
 if(!Object.keys(answers).length)return {hasEvidence:false,match:null};
 const [{buildTasteProfile},{calculatePersonalMatch}]=await Promise.all([import('../taste-test/profile.ts'),import('../recommendations/engine.ts')]);
 const profile=buildTasteProfile(answers,[],locale),hasEvidence=profile.selectedCount>0;
 return {hasEvidence,match:hasEvidence?calculatePersonalMatch({profile,candidate,workId,locale}):null};
}
