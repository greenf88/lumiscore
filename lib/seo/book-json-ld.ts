import type { Book } from '../../app/data/books.ts';
import { boundedCoverAttempts } from '../books/cover-delivery.ts';
import { isBookPresentationAllowed } from '../books/strict-edition.ts';
import type { Locale } from '../i18n/config.ts';
import { localizedHref } from '../i18n/paths.ts';
import { breadcrumbJsonLd } from './breadcrumb-json-ld.ts';
import { catalogBreadcrumbs } from './breadcrumbs.ts';
import { LUMISCORE_WEBSITE_ID } from './site-identity.ts';
import { absoluteLumiScoreUrl } from './site-origin.ts';

export function bookPageJsonLd(book: Book, locale: Locale) {
  const path = `/book/${book.workId}`;
  const url = absoluteLumiScoreUrl(localizedHref(path, locale));
  const workId = absoluteLumiScoreUrl(`/#work-${book.workId}`);
  const editionId = book.editionId && isBookPresentationAllowed(book, locale)
    ? absoluteLumiScoreUrl(`/#edition-${encodeURIComponent(book.editionId)}`)
    : null;
  const authorName = book.author.trim();
  const authorId = authorName && authorName !== 'Unknown author'
    ? book.authorId
      ? absoluteLumiScoreUrl(`/#author-${encodeURIComponent(book.authorId)}`)
      : `${workId}-author`
    : null;
  const author = authorId ? { author: { '@id': authorId } } : {};
  const { itemListElement } = breadcrumbJsonLd(catalogBreadcrumbs('book', book.title, path, locale), locale);
  const breadcrumbId = `${url}#breadcrumb`;

  const page = {
    '@type': 'WebPage', '@id': `${url}#webpage`, url, name: book.title, inLanguage: locale,
    isPartOf: { '@id': LUMISCORE_WEBSITE_ID },
    mainEntity: { '@id': editionId ?? workId },
    breadcrumb: { '@id': breadcrumbId },
  };
  const work = {
    '@type': 'Book', '@id': workId, ...author,
    // Avoid giving one shared Work ID different translated names or unseen text.
    ...(book.workTitle === book.title || !editionId ? { name: book.title } : {}),
    ...(book.firstPublishYear ? { datePublished: String(book.firstPublishYear) } : {}),
    ...(editionId ? { workExample: { '@id': editionId } } : {}),
  };
  const graph: Record<string, unknown>[] = [page, work];
  if (editionId) {
    const isbn = book.isbn13 || book.isbn10;
    const cover = book.coverUrls?.map(url => boundedCoverAttempts(url,'detail')[0]?.src).find(Boolean);
    graph.push({
      '@type': 'Book', '@id': editionId, url, name: book.title, inLanguage: locale,
      exampleOfWork: { '@id': workId }, ...author,
      ...(isbn ? { isbn } : {}),
      ...(cover ? { image: absoluteLumiScoreUrl(cover) } : {}),
    });
  }
  if (authorId) graph.push({ '@type': 'Person', '@id': authorId, name: authorName });
  graph.push({ '@type': 'BreadcrumbList', '@id': breadcrumbId, itemListElement });
  return { '@context': 'https://schema.org', '@graph': graph };
}
