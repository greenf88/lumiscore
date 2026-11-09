export const MAX_COVER_BYTES = 300_000;
export const BOUNDED_COVER_PATH = '/api/catalog/cover';
export const COVER_WIDTHS = [96,160,256,384,512,640] as const;
export type CoverWidth = typeof COVER_WIDTHS[number];

const raster = /\.(?:jpe?g|png|webp)$/i;
const coverPaths: Record<string, RegExp> = {
  'metadata.isbn.nl': /^\/ie_fcache\/\d+_[^/]+\.(?:jpe?g|png|webp)$/i,
  'images.penguinrandomhouse.com': /^\/cover\/97[89]\d{10}$/,
  'cdn.boekhub.overamstel.com': /^\/styles\/(?:bookcoverbig|bookcover)\/public\/contentfile\/front\/[^/]+$/,
  'suzannevermeer.nl': /^\/wp-content\/uploads\/sites\/56\/external\/[^/]+$/,
  'www.awbruna.nl': /^\/wp-content\/uploads\/sites\/51\/external\/[^/]+$/,
  'www.lsuitgeverij.nl': /^\/wp-content\/uploads\/\d{4}\/\d{2}\/[^/]+$/,
  'www.deslegte.com': /^\/images\/cached\/resample\/webp\/data\/uploads\/\d+\/\d+\/cms_visual_\d+[^/]*$/,
  'www.hachettebookgroup.com': /^\/wp-content\/uploads\/\d{4}\/\d{2}\/[^/]+$/,
  'www.lannoo.com': /^\/sites\/default\/files\/(?:styles\/[a-z_]+\/public\/)?onix_product\/cover\/\d+\/\d{13}[^/]*$/,
  'www.uitgeverijdefontein.nl': /^\/wp-content\/uploads\/\d{4}\/\d{2}\/97[89]\d{10}[^/]*$/,
  'www.atlascontact.nl': /^\/wp-content\/uploads\/\d{4}\/\d{2}\/97[89]\d{10}[^/]*$/,
  'cdn.mavenpublishing.nl': /^\/books\/cover_fronts\/\d+\/(?:optimized\/)?[^/]+$/,
  'cdn.agapea.com': /^\/[^/]+\/[^/]+-i1n\d+\.jpg$/,
  'lemniscaat.nl': /^\/pac-upload\/thumbs\/[^/]+$/,
  'static.unbidan.nl': /^\/covers\/[a-f0-9-]{36}-\d+\.jpg$/,
};
const openLibraryPath = /^\/b\/(id\/[1-9]\d{0,11}|isbn\/\d{13}|olid\/OL\d{1,12}M)-([SML])\.jpg$/;
const googleCoverHosts = new Set(['books.google.com', 'books.google.nl', 'books.googleusercontent.com']);

export function openLibraryCoverParts(url: URL) {
  return url.hostname === 'covers.openlibrary.org' ? openLibraryPath.exec(url.pathname) : null;
}

/** Only public cover resources already used by the catalogue. No general URL fetching. */
export function boundedCoverOrigin(value: string): URL | null {
  if (value.length > 1024) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash ||
        /%(?:2f|5c|00|25)/i.test(url.pathname)) return null;
    if (openLibraryCoverParts(url)) {
      if (url.search && url.search !== '?default=false') return null;
      url.search = '?default=false';
      return url;
    }
    if (googleCoverHosts.has(url.hostname) && url.pathname === '/books/content') {
      const keys = { id: /^[\w-]{6,80}$/, printsec: /^frontcover$/, img: /^1$/, zoom: /^[1-6]$/,
        edge: /^curl$/, source: /^gbs_api$/ };
      const entries = [...url.searchParams];
      return new Set(entries.map(([k]) => k)).size === entries.length && url.searchParams.has('id') &&
        entries.every(([k,v]) => Object.hasOwn(keys,k) && keys[k as keyof typeof keys].test(v)) ? url : null;
    }
    const path = Object.hasOwn(coverPaths, url.hostname) ? coverPaths[url.hostname] : null;
    if (!path?.test(url.pathname) || (url.hostname !== 'images.penguinrandomhouse.com' && !raster.test(url.pathname))) return null;
    if (!url.search) return url;
    if (['suzannevermeer.nl','www.awbruna.nl'].includes(url.hostname) && /^\?t=\d{1,16}$/.test(url.search)) return url;
    if (url.hostname === 'www.hachettebookgroup.com' && /^\?(?:w=[1-9]\d{1,2}|resize=[1-9]\d{1,2},[1-9]\d{1,2})$/.test(url.search)) return url;
    return null;
  } catch { return null; }
}

export function boundedCoverUrl(value: string | null | undefined, width?: CoverWidth): string | null {
  const origin = value ? boundedCoverOrigin(value) : null;
  if (!origin) return null;
  const query = new URLSearchParams({ source:origin.href });
  if (width && openLibraryCoverParts(origin)) query.set('w',String(width));
  return BOUNDED_COVER_PATH + '?' + query;
}
