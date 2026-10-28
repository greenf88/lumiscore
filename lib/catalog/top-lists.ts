import data from './top-lists.json' with { type: 'json' };
import campaigns from './editorial-campaigns-20261028.json' with { type: 'json' };
type LocalizedText = { nl: string; en: string };
export type EditorialList = {
  slug: string; title: LocalizedText; description: LocalizedText; workIds: string[];
  criteria?: LocalizedText; notes?: Partial<Record<string, LocalizedText>>; related?: string[]; shareImage?: string;
};
export const editorialTopLists: EditorialList[] = [...data.lists, ...campaigns.lists];
export const editorialTopBooks = [...data.books, ...campaigns.books.filter(book => !data.books.some(existing => existing.workId === book.workId))];
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
