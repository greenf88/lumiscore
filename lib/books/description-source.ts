import type { VerifiedBookDescription } from '@/app/data/books';
import { reviewedDescriptionSource } from './reviewed-descriptions.ts';
import type { Locale } from '../i18n/config.ts';

export function descriptionLanguageAllowed(description: VerifiedBookDescription, locale: Locale, englishEditionFallback: boolean): boolean {
  const expected = locale === 'nl' && englishEditionFallback ? 'en' : locale;
  return description.language === expected || (locale === 'nl' && description.language === 'nl' &&
    description.source === 'official_publisher' && reviewedDescriptionSource(description.sourceKey) !== null);
}

export function publicDescriptionSource(description: VerifiedBookDescription): { name: string; href: string } | null {
  if (description.source === 'official_publisher') return reviewedDescriptionSource(description.sourceKey);
  if (description.source === 'open_library' && /^OL\d+[WM]$/.test(description.sourceKey)) return {
    name: 'Open Library', href: `https://openlibrary.org/${description.sourceKey.endsWith('W') ? 'works' : 'books'}/${description.sourceKey}`,
  };
  if (description.source === 'google_books' && /^\d{13}$/.test(description.sourceKey)) return {
    name: 'Google Books', href: `https://books.google.com/books?vid=ISBN${description.sourceKey}`,
  };
  return null;
}
