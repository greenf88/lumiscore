import type { Locale } from '../i18n/config.ts';
import { guestRatingRecommendations, type GuestRatingInput } from '../taste-test/guest-rating-result.ts';
import { createServerSupabaseClient } from './server.ts';
import { loadGuestRecommendationCatalog, hydratePublicRecommendations } from './taste-test.ts';
import { loadWorkTraitEvidenceBatched } from './work-trait-evidence.ts';
import { reliableProfileTraits, buildEffectiveWorkTraitVector } from '../recommendations/work-trait-evidence.ts';
import { getReviewedWorkTraitCorrection } from '../recommendations/reviewed-work-trait-corrections.ts';
import { publicBook } from '../books/public-book.ts';
import { isBookPresentationAllowed } from '../books/strict-edition.ts';

/** Read-only: guest ratings never enter public ratings or another reader's profile. */
export async function loadGuestRatingResult(ratings: GuestRatingInput[], excluded: string[], locale: Locale) {
  const client = await createServerSupabaseClient();
  const [catalog, evidence] = await Promise.all([
    loadGuestRecommendationCatalog(client, locale),
    loadWorkTraitEvidenceBatched(client, ratings.map(x => x.workId)),
  ]);
  const result = guestRatingRecommendations(ratings.map(row => ({ ...row,
    traits: reliableProfileTraits(buildEffectiveWorkTraitVector(evidence.get(row.workId) ?? [], getReviewedWorkTraitCorrection(row.workId))),
  })), catalog.candidates, excluded, locale);
  const hydrated = await hydratePublicRecommendations(result.recommendations, locale);
  return { profile: result.profile, recommendations: await Promise.all(hydrated
    .filter(x => isBookPresentationAllowed(x.book, locale))
    .map(async x => ({ ...x, book: await publicBook(x.book) }))) };
}
