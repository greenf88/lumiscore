import { selectBookEdition } from '../books/edition-presentation.ts';
import type { StrictEditionRow } from '../books/strict-edition.ts';
import type { Locale } from '../i18n/config.ts';
import { languageAlternates } from '../i18n/paths.ts';

export type SitemapWork = { id: string | number; title: string | null };
export type BookLocales = { workId: string; locales: readonly Locale[] };
export type BookUrlStatus = 'indexable' | 'noindex' | 'retired';

export function bookUrlStatus(locales: readonly Locale[] | null, locale: Locale): BookUrlStatus {
  if (!locales) return 'retired';
  return locales.includes(locale) ? 'indexable' : 'noindex';
}

export function resolveBookLifecycle(work: SitemapWork | null, editions: readonly StrictEditionRow[], locale: Locale) {
  if (!work) return { status: 'retired', edition: null } as const;
  const edition = selectBookEdition(String(work.id), work.title ?? '', editions, locale);
  return edition ? { status: 'indexable', edition } as const : { status: 'noindex', edition: null } as const;
}

// The public detail route has no cross-language edition fallback. Keeping a
// direct link usable without an edition does not make it a locale equivalent.
export function getBookLocales(workId: string, title: string, editions: readonly StrictEditionRow[]): Locale[] {
  return (['en', 'nl'] as const).filter(locale => resolveBookLifecycle({ id: workId, title }, editions, locale).status === 'indexable');
}

export function selectSitemapBookLocales(works: readonly SitemapWork[], editions: readonly StrictEditionRow[]): BookLocales[] {
  const byWork = new Map<string, StrictEditionRow[]>();
  for (const edition of editions) {
    if (edition.work_id == null) continue;
    const id = String(edition.work_id);
    const existing = byWork.get(id);
    if (existing) existing.push(edition);
    else byWork.set(id, [edition]);
  }
  return works.flatMap(work => {
    const workId = String(work.id);
    if (!/^[1-9]\d*$/.test(workId)) return [];
    const locales = getBookLocales(workId, work.title ?? '', byWork.get(workId) ?? []);
    return locales.length ? [{ workId, locales }] : [];
  });
}

export function bookLanguageAlternates(path: string, locales: readonly Locale[]): Record<string, string> {
  // hreflang describes equivalent pages; no set is needed for a single locale.
  // When there is a pair, retain English as the established x-default.
  return locales.includes('en') && locales.includes('nl') ? languageAlternates(path) : {};
}
