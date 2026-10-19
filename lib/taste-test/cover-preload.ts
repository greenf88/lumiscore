import type { Book } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import { normalizeEditionLanguage } from '../books/edition-ranking.ts';
import { getBookCoverImageSource } from '../books/covers.ts';

export type CoverAnchor = { roundId: string; fromWorkId: string; locale: Locale };
export type TasteCoverHint = CoverAnchor & { workId: string; editionId: string; src: string };
const positiveId = (v: unknown): v is string => typeof v === 'string' && /^[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v));
export function parseCoverAnchor(params: URLSearchParams): CoverAnchor | null {
  const roundId = params.get('roundId'), fromWorkId = params.get('workId'), locale = params.get('locale');
  return roundId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roundId)
    && positiveId(fromWorkId) && (locale === 'nl' || locale === 'en') ? { roundId, fromWorkId, locale } : null;
}
function safeImageUrl(src: unknown): src is string {
  if (typeof src !== 'string' || src.length > 2048 || /[\u0000-\u001f\\]/u.test(src)) return false;
  if (src.startsWith('/') && !src.startsWith('//')) return true;
  try { const u = new URL(src); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}
/** Only accepts the existing loader's edition-bound, verified cover; no Work/ISBN guessing. */
export function buildTasteCoverHint(book: Book | undefined, anchor: CoverAnchor): TasteCoverHint | null {
  if (!book || book.source !== 'supabase' || !positiveId(book.workId) || book.workId === anchor.fromWorkId
    || !book.editionId || book.editionAvailable !== true || book.strictEditionLanguage !== anchor.locale || !book.editionTitle) return null;
  const language = normalizeEditionLanguage(book.editionLanguage ?? '');
  if (!(language === normalizeEditionLanguage(anchor.locale)
    || (anchor.locale === 'nl' && language === 'eng' && book.englishEditionFallback === true))) return null;
  const url = book.coverUrls?.[0];
  if (!safeImageUrl(url)) return null;
  return { ...anchor, workId: book.workId, editionId: book.editionId, src: getBookCoverImageSource(url, 'taste').src };
}
export function validateTasteCoverHint(value: unknown, anchor: CoverAnchor): TasteCoverHint | null {
  if (!value || typeof value !== 'object') return null;
  const h = value as Partial<TasteCoverHint>;
  return h.roundId === anchor.roundId && h.fromWorkId === anchor.fromWorkId && h.locale === anchor.locale
    && positiveId(h.workId) && h.workId !== anchor.fromWorkId && typeof h.editionId === 'string' && h.editionId.length > 0
    && safeImageUrl(h.src) ? h as TasteCoverHint : null;
}
export type PreloadImage = Pick<HTMLImageElement, 'src' | 'onload' | 'onerror' | 'decoding' | 'fetchPriority'>;
/** Image-only hint. No action request, progress callback, retry or failure fallback. */
export async function preloadTasteCover(anchor: CoverAnchor, signal: AbortSignal, dependencies: {
  fetcher: typeof fetch; createImage: () => PreloadImage;
}): Promise<void> {
  try {
    const { fetcher } = dependencies; // Do not invoke native window.fetch with the adapter as its receiver.
    const query = new URLSearchParams({ roundId: anchor.roundId, workId: anchor.fromWorkId, locale: anchor.locale });
    const response = await fetcher('/api/taste-test/rounds/cover?' + query, { cache: 'no-store', signal });
    if (!response.ok || signal.aborted) return;
    const body = await response.json() as { cover?: unknown };
    const hint = validateTasteCoverHint(body.cover, anchor);
    if (!hint || signal.aborted) return;
    const image = dependencies.createImage();
    image.decoding = 'async'; image.fetchPriority = 'low';
    const cleanup = () => { image.onload = null; image.onerror = null; signal.removeEventListener('abort', cleanup); };
    image.onload = cleanup; image.onerror = cleanup;
    signal.addEventListener('abort', cleanup, { once: true });
    image.src = hint.src;
  } catch { /* Speculative read/image failures must never affect saving or trigger retries. */ }
}
