import type { Locale } from '../i18n/config.ts';
import { languageAlternates } from '../i18n/paths.ts';
import { getLandingGuide } from '../editorial/landing-guides.ts';
import type { BookLocales } from './book-locales.ts';

export type SitemapCollection = { id: string | number; slug: string };
export type CollectionMembership = { collection_id: string | number; work_id: string | number };

/** An existing collection is never deleted because a translation is missing.
 * Admit a locale when it has a usable book or a substantive editorial guide.
 * Covers, scores, popularity and GSC exclusion status are not eligibility tests. */
export function selectCollectionLocales(
  collections: readonly SitemapCollection[], memberships: readonly CollectionMembership[], books: readonly BookLocales[],
): Map<string, readonly Locale[]> {
  const bookLocales = new Map(books.map(book => [book.workId, book.locales]));
  const available = new Map<string, Set<Locale>>();
  for (const member of memberships) {
    const id = String(member.collection_id);
    const locales = available.get(id) ?? new Set<Locale>();
    for (const locale of bookLocales.get(String(member.work_id)) ?? []) locales.add(locale);
    available.set(id, locales);
  }
  return new Map(collections.map(collection => [collection.slug, (['en', 'nl'] as const).filter(locale =>
    available.get(String(collection.id))?.has(locale) || Boolean(getLandingGuide('/collection/' + collection.slug, locale)),
  )]));
}

export function collectionLanguageAlternates(slug: string, locales: readonly Locale[]): Record<string, string> {
  return locales.includes('en') && locales.includes('nl') ? languageAlternates('/collection/' + slug) : {};
}
