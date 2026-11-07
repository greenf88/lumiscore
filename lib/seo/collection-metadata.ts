import type { CollectionSummary } from '../collections/model.ts';
import type { Locale } from '../i18n/config.ts';

export function collectionMetadataDescription(
  collection: Pick<CollectionSummary, 'name' | 'description' | 'collectionType'>,
  locale: Locale,
) {
  const name = collection.name.trim() || (locale === 'nl' ? 'deze collectie' : 'this collection');
  const description = collection.description?.replace(/\s+/g, ' ').trim();
  if (locale === 'en' && description && description.toLowerCase() !== name.toLowerCase()) {
    return description;
  }
  if (locale === 'nl') {
    if (collection.collectionType === 'series') return `Bekijk de leesvolgorde van ${name}, ontdek de boeken en houd bij welke delen je hebt gelezen.`;
    if (collection.collectionType === 'author_collection') return `Ontdek de boeken in ${name}. Bekijk de titels en lezersscores en houd je leesvoortgang bij.`;
    return `Verken ${name} via de boeken in deze collectie. Bekijk de titels en lezersscores en kies wat je wilt lezen.`;
  }
  if (collection.collectionType === 'series') return `Explore the reading order for ${name}, see the books in the series and keep track of the volumes you have read.`;
  if (collection.collectionType === 'author_collection') return `Explore the books in ${name}. Find titles, check reader ratings and keep track of your reading.`;
  return `Explore ${name} through the books in this collection. See the titles, check reader ratings and choose what to read next.`;
}

/** Locale-specific purpose, rather than an identical bare series name in both locales. */
export function collectionMetadataTitle(collection: Pick<CollectionSummary, 'name' | 'collectionType'>, locale: Locale) {
  const name = collection.name.trim() || (locale === 'nl' ? 'Collectie' : 'Collection');
  if (collection.collectionType === 'series') return `${name}: ${locale === 'nl' ? 'leesvolgorde en boeken' : 'reading order and books'} — LumiScore`;
  return `${name}: ${locale === 'nl' ? 'boeken en lezersscores' : 'books and reader ratings'} — LumiScore`;
}
