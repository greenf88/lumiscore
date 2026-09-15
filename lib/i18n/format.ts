import type { Locale } from './config.ts';
import { translate } from './translations.ts';

export function formatLocalizedList(locale: Locale, items: readonly string[]): string {
  if (items.length === 0) return '';
  return new Intl.ListFormat(locale === 'nl' ? 'nl-NL' : 'en-US', {
    style: 'long',
    type: 'conjunction',
  }).format(items);
}

export function formatLocalizedCount(
  locale: Locale,
  count: number,
  singularKey: 'common.rating' | 'common.book',
  pluralKey: 'common.ratings' | 'common.books',
): string {
  const value = count.toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-US');
  return `${value} ${translate(locale, count === 1 ? singularKey : pluralKey)}`;
}
