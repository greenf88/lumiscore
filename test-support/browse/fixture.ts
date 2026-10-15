// Loopback review only. Never imported by an application route or production build.
import type { Book } from '../../app/data/books';
import type { EditorialQuery } from '../../lib/catalog/editorial-query';
import type { EditorialPage } from '../../lib/supabase/editorial-catalog';
import { editorialCategories } from '../../lib/catalog/editorial-query';

export const categories = editorialCategories.filter(c => ['fiction_fantasy', 'fiction_thriller_suspense', 'nonfiction_cooking_food'].includes(c.id));
export const authors = [{ id: '1', name: 'Ada Vermeer' }, { id: '2', name: 'James North' }, { id: '3', name: 'Een uitzonderlijk lange synthetische auteursnaam met meerdere woorden' }];
export const books: Book[] = Array.from({ length: 160 }, (_, i) => ({
  id: `browse-synthetic-${i + 1}`, source: 'supabase', workId: String(990100 + i), editionId: String(990100 + i),
  title: i === 0 ? 'Aan de overkant van de stilte' : i === 1 ? 'De bibliotheek van alle ongeschreven verhalen aan het einde van de wereld'
    : i === 2 ? 'A quiet chapter' : `Boek ${String(i + 1).padStart(3, '0')} — een nieuwe horizon`,
  author: authors[i % authors.length].name, firstPublishYear: 1980 + i % 45,
  score: i % 3 === 0 ? 9.2 - (i % 10) / 10 : null, ratingsCount: null,
  ratingBand: i % 3 === 0 ? '3–4' : null, match: null, cover: ['orbit', 'road', 'laurel'][i % 3],
  coverUrls: i % 4 === 0 ? ['/browse-review-cover.svg'] : [],
}));
const category = (book: Book) => Number(book.workId) % 2 ? 'fiction_thriller_suspense' : 'fiction_fantasy';
const authorId = (book: Book) => authors.find(a => a.name === book.author)?.id;
const languages = (book: Book) => Number(book.workId) % 3 === 0 ? ['en'] : ['nl', 'en'];
const selected = (book: Book) => Number(book.workId) % 3 !== 0;
export function unavailableEditorialPage(state: EditorialQuery): EditorialPage {
  return { books: [], total: 0, page: 1, pageSize: state.pageSize, pageCount: 1, sort: state.sort,
    facets: {}, selectionCount: null, available: false, categories: [], selectedAuthor: null, discoveryAvailable: true };
}
export async function loadEditorialCatalog(state: EditorialQuery): Promise<EditorialPage> {
  // Explicit error fixture exercises the real page's existing honest error boundary.
  if (state.query === 'fixture-load-error') throw new Error('Synthetic catalog unavailable');
  let rows = books.filter(book => (!state.query || `${book.title} ${book.author}`.toLocaleLowerCase().includes(state.query.toLocaleLowerCase()))
    && (!state.author || authorId(book) === state.author) && (!state.selection || selected(book))
    && (!state.languages.length || state.languages.some(value => languages(book).includes(value)))
    && (!state.categories.length || state.categories.includes(category(book))));
  rows = rows.toSorted((a, b) => (state.sort === 'newest' ? b.firstPublishYear! - a.firstPublishYear!
    : state.sort === 'highest' ? (b.score ?? -1) - (a.score ?? -1) : 0) || a.title.toLocaleLowerCase().localeCompare(b.title.toLocaleLowerCase()) || Number(a.workId) - Number(b.workId));
  const total = rows.length, pageCount = Math.max(1, Math.ceil(total / state.pageSize)), page = Math.min(state.page, pageCount);
  return { books: rows.slice((page - 1) * state.pageSize, page * state.pageSize), total, page, pageSize: state.pageSize,
    pageCount, sort: state.sort, available: true, categories, selectedAuthor: authors.find(a => a.id === state.author) ?? null,
    discoveryAvailable: true, selectionCount: books.filter(selected).length,
    facets: Object.fromEntries(categories.map(c => [c.id, rows.filter(book => category(book) === c.id).length])) };
}
export async function loadCatalogBook(id: string) { return books.find(book => book.workId === id) ?? null; }
export async function loadCatalogBooksByIds(ids: string[]) { return books.filter(book => ids.includes(book.workId!)); }
export const loadCatalogBooksByIdsWithStoredCovers = loadCatalogBooksByIds;
export async function loadHighestRatedCatalog(limit: number) { return { books: books.filter(b => b.score !== null).slice(0, limit), total: books.length }; }
