import { isCatalogWorkId } from '../books/book-detail.ts';
import { bookUrlPolicy, type BookLocales } from './book-locales.ts';

export type LegacyBook = { title: string | null; locales: BookLocales['locales'] };

export async function resolveLegacyBook(
  url: Pick<URL, 'pathname' | 'href'>,
  loadBook: (workId: string) => Promise<LegacyBook | null>,
): Promise<Response | 'missing' | null> {
  const match = /^\/books?\/([^/]+)\/?$/.exec(url.pathname);
  if (!match) return null;
  let workId;
  try {
    workId = decodeURIComponent(match[1]);
  } catch {
    return 'missing';
  }
  if (!isCatalogWorkId(workId)) return 'missing';

  let book;
  try {
    book = await loadBook(workId);
  } catch {
    return new Response('Book temporarily unavailable.', {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '5' },
    });
  }
  if (!book) return 'missing';

  const locale = bookUrlPolicy(book.locales, 'en').inSitemap ? 'en'
    : bookUrlPolicy(book.locales, 'nl').inSitemap ? 'nl' : null;
  if (locale) {
    const target = new URL(url.href);
    target.pathname = `/${locale}/book/${workId}`;
    // The redirect is permanent for crawlers; recheck eligibility on future requests.
    return new Response(null, {
      status: 308,
      headers: { Location: target.href, 'Cache-Control': 'private, no-store' },
    });
  }

  // The Work exists, but has no indexable translation to consolidate to.
  const title = (book.title?.trim() || 'Book').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, follow"><title>${title} — LumiScore</title></head><body><main><h1>${title}</h1><p>No eligible English or Dutch edition is available for this book.</p></main></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } },
  );
}
