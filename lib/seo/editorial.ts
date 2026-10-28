import type { EditorialList } from '../catalog/top-lists.ts';
import type { Book } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import { localizedHref } from '../i18n/paths.ts';
import { absoluteLumiScoreUrl } from './site-origin.ts';
import { LUMISCORE_WEBSITE_ID } from './site-identity.ts';

/** Only verified, actually rendered catalogue identities enter the structured list. */
export function editorialPageJsonLd(list: EditorialList, books: readonly Book[], locale: Locale) {
  const path = '/toplijsten/' + list.slug;
  const url = absoluteLumiScoreUrl(localizedHref(path, locale));
  const available = books.filter(book => book.editionAvailable !== false && /^[1-9]\d*$/.test(book.workId ?? ''));
  return { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', '@id': url + '#webpage', url, name: list.title[locale], description: list.description[locale], inLanguage: locale,
      isPartOf: { '@id': LUMISCORE_WEBSITE_ID }, mainEntity: { '@id': url + '#selection' } },
    { '@type': 'ItemList', '@id': url + '#selection', name: list.title[locale], numberOfItems: available.length,
      itemListElement: available.map((book, index) => ({ '@type': 'ListItem', position: index + 1, item: { '@type': 'Book',
        name: book.title, url: absoluteLumiScoreUrl(localizedHref('/book/' + book.workId, locale)),
        author: { '@type': 'Person', name: book.author } } })) },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'LumiScore', item: absoluteLumiScoreUrl(localizedHref('/', locale)) },
      { '@type': 'ListItem', position: 2, name: locale === 'nl' ? 'Leesroutes' : 'Reading routes', item: absoluteLumiScoreUrl(localizedHref('/toplijsten', locale)) },
      { '@type': 'ListItem', position: 3, name: list.title[locale], item: url },
    ] },
  ] };
}
