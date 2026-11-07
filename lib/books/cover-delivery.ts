import type { CoverPresentation } from './covers.ts';

export const COVER_WIDTHS = [64, 96, 160, 256, 384, 640] as const;
// Only this existing, public Covers API currently has verified cache guidance.
// No arbitrary remote URLs, cookies, SVGs, query-string credentials.
export function canOptimizeCover(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname === 'covers.openlibrary.org' && !u.port && !u.username && !u.password
      && /^\/b\/(?:id\/[1-9]\d*|isbn\/\d{13}|olid\/OL\d+M)-[SML]\.jpg$/.test(u.pathname)
      && (!u.search || u.search === '?default=false') && !u.hash;
  } catch { return false; }
}
export const coverSizes: Record<CoverPresentation, string> = {
  compact: '72px',
  taste: '(max-width: 430px) 119px, 190px',
  card: '(max-width: 760px) calc((100vw - 92px) / 2), (max-width: 1200px) calc((100vw - 172px) / 3), 200px',
  detail: '(max-width: 780px) min(calc(78vw - 40px), 250px), 312px',
};
export function optimizedCover(url: string, presentation: CoverPresentation, enabled: boolean) {
  if (!enabled || !canOptimizeCover(url)) return null;
  // Resize the one verified identity; never replace it with an ISBN/Work guess.
  const original = new URL(url); original.pathname = original.pathname.replace(/-[SML]\.jpg$/, '-L.jpg');
  original.search = '?default=false';
  const source = original.href;
  const href = (width: number) => '/_vercel/image?' + new URLSearchParams({url:source,w:String(width),q:'75'});
  const widths = presentation === 'compact' ? COVER_WIDTHS.slice(0, 3) : COVER_WIDTHS;
  return {src:href(presentation === 'compact' ? 96 : presentation === 'detail' ? 384 : 256),
    srcSet:widths.map(width => `${href(width)} ${width}w`).join(', '),sizes:coverSizes[presentation],upstream:source};
}
export const coverImageConfiguration = {
  sizes: [...COVER_WIDTHS], domains: [], localPatterns: [], qualities: [75], minimumCacheTTL: 3600,
  formats: ['image/avif' as const, 'image/webp' as const], dangerouslyAllowSVG: false,
  contentSecurityPolicy: "default-src 'none'; sandbox;", contentDispositionType: 'inline' as const,
  remotePatterns: [{ protocol:'https' as const,hostname:'^covers\\.openlibrary\\.org$',port:'',
    pathname:'^/b/(?:id/[1-9][0-9]*|isbn/[0-9]{13}|olid/OL[0-9]+M)-[SML]\\.jpg$',search:'?default=false' }],
};

/** These slots follow the current CSS grid, including Browse's 320px single
 * column. Width descriptors are actual optimizer widths, never guessed S/M/L sizes. */
export const responsiveCoverSizes = {
  browse: '(max-width: 359px) calc(100vw - 62px), (max-width: 760px) calc((100vw - 100px) / 2), (max-width: 873px) calc((100vw - 170px) / 3), (max-width: 1085px) calc((100vw - 218px) / 4), (max-width: 1297px) calc((100vw - 266px) / 5), 169px',
  collection: '(max-width: 760px) calc((100vw - 92px) / 2), (max-width: 1047px) calc((100vw - 120px) / 2), (max-width: 1387px) calc((100vw - 166px) / 3), 304px',
};
