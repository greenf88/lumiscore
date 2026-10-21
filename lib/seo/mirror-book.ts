import type { Book } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import { localizedHref } from '../i18n/paths.ts';
import { getReviewedDescription } from '../books/reviewed-descriptions.ts';
import { getReviewedCoverOverride } from '../books/reviewed-cover-overrides.ts';
import { normalizeIsbn13 } from '../books/covers.ts';
import { absoluteLumiScoreUrl } from './site-origin.ts';

// Exact edition dates from the reviewed catalogue packet, not the Work year.
const EDITIONS: Record<string, { datePublished: string; publisher: string }> = {
  '9781250462039': { datePublished: '2026-09-22', publisher: 'Flatiron Books' },
  '9781399641777': { datePublished: '2026-09-29', publisher: 'Orion' },
};

/** Public, reviewed bibliographic facts only; no remote calls or personal state. */
export function getMirrorBookSeo(book: Book, locale: Locale) {
  const isbn = normalizeIsbn13(book.isbn13);
  const edition = isbn ? EDITIONS[isbn] : undefined;
  if (book.workId !== '10138' || !book.editionId?.trim() || book.editionAvailable === false || !edition) return null;
  if (book.editionPublisher && book.editionPublisher.trim().toLowerCase() !== edition.publisher.toLowerCase()) return null;
  // Reuse the existing strict Work/title/author/ISBN/edition-language identity gate.
  const description = getReviewedDescription(book, locale);
  const cover = getReviewedCoverOverride(book);
  if (!description || !cover) return null;

  const url = absoluteLumiScoreUrl(localizedHref('/book/10138', locale));
  return {
    description: locale === 'nl'
      ? 'Ontdek de geïllustreerde companion bij Once Upon a Broken Heart van Stephanie Garber, met illustraties van Lotusbubble. Bekijk en beoordeel het boek op LumiScore.'
      : 'Explore Stephanie Garber’s illustrated Once Upon a Broken Heart companion, with artwork by Lotusbubble. Discover and rate the book on LumiScore.',
    image: cover.coverUrl,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Book',
      '@id': absoluteLumiScoreUrl(`/#book-10138-edition-${isbn}`),
      name: book.editionTitle!,
      url,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url, inLanguage: locale },
      author: { '@type': 'Person', name: book.author },
      illustrator: { '@type': 'Person', name: 'Lotusbubble' },
      isbn,
      inLanguage: 'en', // A Dutch page/own summary does not make this a Dutch edition.
      datePublished: edition.datePublished,
      publisher: { '@type': 'Organization', name: edition.publisher },
      isPartOf: { '@type': 'BookSeries', name: 'Once Upon a Broken Heart' },
      image: cover.coverUrl,
      description: description.text,
    },
  };
}

export function serializeMirrorBookJsonLd(book: Book, locale: Locale): string | null {
  const seo = getMirrorBookSeo(book, locale);
  return seo ? JSON.stringify(seo.jsonLd).replaceAll('<', '\\u003c') : null;
}
