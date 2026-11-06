import type { CollectionBook, CollectionSummary } from '../collections/model.ts';
import { getBookHref } from '../books/book-navigation.ts';
import type { Locale } from '../i18n/config.ts';
import { localizedHref } from '../i18n/paths.ts';
import { absoluteLumiScoreUrl } from './site-origin.ts';
import { LUMISCORE_WEBSITE_ID } from './site-identity.ts';

export function collectionPageJsonLd(
  collection: CollectionSummary, books: readonly CollectionBook[], locale: Locale, name = collection.name,
) {
  const url = absoluteLumiScoreUrl(localizedHref('/collection/' + collection.slug, locale));
  const listId = url + '#books';
  const seen = new Set<string>();
  const visible = books.flatMap(({ book, sequenceNumber }) => {
    const path = getBookHref(book);
    if (!path || !book.workId || seen.has(path)) return [];
    seen.add(path);
    return [{
      name: book.title,
      url: absoluteLumiScoreUrl(localizedHref(path, locale)),
      work: { '@id': absoluteLumiScoreUrl('/#work-' + book.workId) },
      sequenceNumber,
    }];
  });
  const seriesParts = visible.filter(item => item.sequenceNumber !== null);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', '@id': url + '#webpage', url, name, inLanguage: locale,
        isPartOf: { '@id': LUMISCORE_WEBSITE_ID },
        ...(visible.length ? { mainEntity: { '@id': listId } } : {}),
        ...(collection.collectionType === 'series' && seriesParts.length ? { about: { '@id': url + '#series' } } : {}),
      },
      ...(visible.length ? [{
        '@type': 'ItemList', '@id': listId, numberOfItems: visible.length,
        itemListElement: visible.map((entry, index) => ({
          '@type': 'ListItem', position: index + 1, name: entry.name, url: entry.url, item: entry.work,
        })),
      }] : []),
      ...(collection.collectionType === 'series' && seriesParts.length ? [{
        '@type': 'BookSeries', '@id': url + '#series', name: collection.name, url,
        hasPart: seriesParts.map(entry => entry.work),
      }] : []),
    ],
  };
}
