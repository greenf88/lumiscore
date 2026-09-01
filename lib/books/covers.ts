const OPEN_LIBRARY_COVER_BASE_URL = 'https://covers.openlibrary.org/b';

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

export function uniqueCoverUrls(
  urls: Array<string | null | undefined>,
): string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}
