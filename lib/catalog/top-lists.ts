import data from './top-lists.json' with { type: 'json' };
export const editorialTopLists = data.lists;
export const editorialTopBooks = data.books;
export function getEditorialTopList(slug: string) { return editorialTopLists.find(list => list.slug === slug); }
export function getEditorialTopBook(id: string) { return editorialTopBooks.find(book => book.workId === id)!; }
export function topListBookHref(workId: string, slug: string) {
  if (!/^[1-9]\d*$/.test(workId) || !getEditorialTopList(slug)) throw new Error('Invalid editorial identity');
  return '/book/'+workId+'?returnTo='+encodeURIComponent('/toplijsten/'+slug);
}
