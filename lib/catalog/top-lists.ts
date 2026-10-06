import data from './top-lists.json' with { type: 'json' };
import type { Book } from '../../app/data/books.ts';
export const editorialTopLists = data.lists;
export const editorialTopBooks = data.books;
export function getEditorialTopList(slug: string) { return editorialTopLists.find(list => list.slug === slug); }
export function getEditorialTopBook(id: string) { return editorialTopBooks.find(book => book.workId === id)!; }
export function topListBook(book: typeof editorialTopBooks[number]): Book {
  return { id: 'work-'+book.workId, source: 'supabase', workId: book.workId, title: book.title, author: book.author,
    firstPublishYear: book.originalYear, score: null, ratingsCount: null, ratingBand: null, match: null,
    cover: 'orbit', coverUrls: book.coverUrl ? [book.coverUrl] : [], openLibraryWorkId: book.source.split('/').at(-1) };
}
export function topListBookHref(workId: string, slug: string) {
  if (!/^[1-9]\d*$/.test(workId) || !getEditorialTopList(slug)) throw new Error('Invalid editorial identity');
  return '/book/'+workId+'?returnTo='+encodeURIComponent('/toplijsten/'+slug);
}
