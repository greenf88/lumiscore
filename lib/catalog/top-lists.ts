import data from './top-lists.json' with { type: 'json' };
import campaigns from './editorial-campaigns-20261028.json' with { type: 'json' };
import dutch from './nl-reading-lists-20261116.json' with { type: 'json' };
import seasonal from './seasonal-lists-20261128.json' with { type: 'json' };
import type { Locale } from '../i18n/config.ts';
type LocalizedText = { nl: string; en: string };
export type EditorialList = {
  slug: string; title: LocalizedText; description: LocalizedText; workIds: string[];
  criteria?: LocalizedText; notes?: Partial<Record<string, LocalizedText>>; related?: string[]; shareImage?: string;
};
export const seasonalTopListSlugs: readonly string[] = seasonal.lists.map(list => list.slug);
export const editorialTopLists: EditorialList[] = [...data.lists, ...campaigns.lists, ...seasonal.lists];
export const editorialTopBooks = [...data.books, ...campaigns.books.filter(book => !data.books.some(existing => existing.workId === book.workId)), ...dutch.books, ...seasonal.books];
/** Adapt a route to verified Dutch editions without changing the original selection. */
export function localizeEditorialList(list: EditorialList, locale: Locale): EditorialList {
  if (locale !== 'nl') return list;
  const replacements = ({...dutch.replacements,...seasonal.replacements} as Record<string, Record<string, string>>)[list.slug];
  return replacements ? { ...list, workIds: list.workIds.map(id => replacements[id] ?? id) } : list;
}
export function getEditorialTopList(slug: string) { return editorialTopLists.find(list => list.slug === slug); }
export function getEditorialTopBook(id: string) { return editorialTopBooks.find(book => book.workId === id)!; }
/** The public source identity is portable; a database's numeric IDs are not. */
export function getEditorialWorkSourceId(id: string): string {
  const source=getEditorialTopBook(id)?.source;
  const match=source?.match(/^https:\/\/openlibrary\.org\/works\/(OL\d+W)$/);
  if(!match) throw new Error('Invalid editorial source identity');
  return match[1];
}
export function topListBookHref(workId: string, slug: string) {
  if (!/^[1-9]\d*$/.test(workId) || !getEditorialTopList(slug)) throw new Error('Invalid editorial identity');
  return '/book/'+workId+'?returnTo='+encodeURIComponent('/toplijsten/'+slug);
}
