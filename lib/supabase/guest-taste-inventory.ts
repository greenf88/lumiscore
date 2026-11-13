import type { Locale } from '../i18n/config.ts';
import { buildEffectiveWorkTraitVector, reliableProfileTraits } from '../recommendations/work-trait-evidence.ts';
import { getReviewedWorkTraitCorrection } from '../recommendations/reviewed-work-trait-corrections.ts';
import { selectGuestBooks, type GuestInventoryRow, type GuestOffer } from '../taste-test/guest-round.ts';
import { supabase } from './client.ts';
import { loadCatalogBooksByIdsWithStoredCovers } from './books.ts';
import { loadWorkTraitEvidenceBatched } from './work-trait-evidence.ts';

export async function loadGuestTasteInventory(locale: Locale): Promise<GuestOffer[]> {
  const { data, error } = await supabase.rpc('guest_taste_inventory', { p_language: locale })
    .abortSignal(AbortSignal.timeout(5_000));
  if (error) throw error;
  if (!Array.isArray(data) || data.length > 120 || data.some(row =>
    !Number.isSafeInteger(row.work_id) || row.work_id < 1 || !Array.isArray(row.series_ids)
    || row.series_ids.some((id: unknown) => !Number.isSafeInteger(id))
  )) throw new Error('Invalid guest taste inventory');
  const inventory = data as GuestInventoryRow[];
  if (new Set(inventory.map(row => row.work_id)).size !== inventory.length) throw new Error('Duplicate guest taste inventory');

  const books = inventory.length
    ? await loadCatalogBooksByIdsWithStoredCovers(inventory.map(row => String(row.work_id)), undefined, locale)
    : [];
  // Without the presentation bindings we cannot verify the chosen edition.
  if (books.some(book => book.storedPresentationUnavailable)) throw new Error('Guest taste editions unavailable');
  const selected = selectGuestBooks(inventory, books, locale);
  const evidence = await loadWorkTraitEvidenceBatched(supabase, selected.map(book => book.workId));
  return selected.map(book => ({
    book,
    traits: reliableProfileTraits(buildEffectiveWorkTraitVector(
      evidence.get(book.workId) ?? [], getReviewedWorkTraitCorrection(book.workId),
    )),
  }));
}
