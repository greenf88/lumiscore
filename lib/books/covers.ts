const OPEN_LIBRARY_COVER_BASE_URL = 'https://covers.openlibrary.org/b';

export type OpenLibraryCoverSize = 'S' | 'M' | 'L';

function buildOpenLibraryCoverUrl(key: 'id' | 'isbn' | 'olid', value: string) {
  return `${OPEN_LIBRARY_COVER_BASE_URL}/${key}/${value}-L.jpg?default=false`;
}

export function normalizeIsbn13(
  isbn13: string | null | undefined,
): string | null {
  const normalized = isbn13?.replace(/[\s-]/g, '') ?? '';

  return /^\d{13}$/.test(normalized) ? normalized : null;
}

export function getOpenLibraryCoverUrl(
  isbn13: string | null | undefined,
): string | null {
  const normalized = normalizeIsbn13(isbn13);

  return normalized
    ? buildOpenLibraryCoverUrl('isbn', normalized)
    : null;
}

export function normalizeOpenLibraryId(
  value: string | null | undefined,
  type?: 'edition' | 'work',
): string | null {
  const normalized = value?.split('/').filter(Boolean).at(-1)?.toUpperCase() ?? '';
  const suffix = type === 'edition' ? 'M' : type === 'work' ? 'W' : '[MW]';

  return new RegExp(`^OL\\d+${suffix}$`).test(normalized) ? normalized : null;
}

export function getOpenLibraryOlidCoverUrl(
  openLibraryId: string | null | undefined,
): string | null {
  const normalized = normalizeOpenLibraryId(openLibraryId);

  return normalized ? buildOpenLibraryCoverUrl('olid', normalized) : null;
}

export function getOpenLibraryCoverIdUrl(
  coverId: string | number | null | undefined,
): string | null {
  const normalized = Number(coverId);

  return Number.isSafeInteger(normalized) && normalized > 0
    ? buildOpenLibraryCoverUrl('id', String(normalized))
    : null;
}

export function hasOpenLibraryCoverIdentity({
  workId,
  editionIds = [],
  coverIds = [],
}: {
  workId?: string | null;
  editionIds?: readonly (string | null | undefined)[];
  coverIds?: readonly (string | number | null | undefined)[];
}): boolean {
  return Boolean(
    normalizeOpenLibraryId(workId, 'work') ||
      editionIds.some((id) => normalizeOpenLibraryId(id, 'edition')) ||
      coverIds.some((id) => getOpenLibraryCoverIdUrl(id)),
  );
}

export function isUsableCoverImageDimensions(
  naturalWidth: number,
  naturalHeight: number,
): boolean {
  return naturalWidth > 1 && naturalHeight > 1;
}

export function uniqueCoverUrls(
  urls: Array<string | null | undefined>,
): string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}

export function getOpenLibraryCoverVariantUrl(
  url: string,
  size: OpenLibraryCoverSize,
): string {
  if (!url.startsWith(`${OPEN_LIBRARY_COVER_BASE_URL}/`)) return url;

  return url.replace(/-[SML]\.jpg(?=\?|$)/, `-${size}.jpg`);
}

export type CoverPresentation = 'compact' | 'card' | 'taste' | 'detail';

// Provider variants only: no image proxy, URL guessing on other hosts or stored-data changes.
// Density candidates let Retina cards stay sharp; the small taste cover needs only M.
export function getBookCoverImageSource(url: string, presentation: CoverPresentation, largeFallback = false) {
  const large = getOpenLibraryCoverVariantUrl(url, 'L');
  const medium = getOpenLibraryCoverVariantUrl(url, 'M');
  const small = getOpenLibraryCoverVariantUrl(url, 'S');
  if (medium === large || presentation === 'detail' || largeFallback) {
    return { src: large, srcSet: undefined, canRetryLarge: false };
  }
  if (presentation === 'compact') {
    return { src: small, srcSet: `${small} 1x, ${medium} 2x`, canRetryLarge: true };
  }
  return {
    src: medium,
    srcSet: presentation === 'card' ? `${medium} 1x, ${large} 2x` : undefined,
    canRetryLarge: true,
  };
}

export function nextBookCoverAttempt(index: number, canRetryLarge: boolean) {
  return canRetryLarge
    ? { index, largeFallbackIndex: index }
    : { index: index + 1, largeFallbackIndex: null };
}
