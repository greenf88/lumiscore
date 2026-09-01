const OPEN_LIBRARY_ISBN_COVER_BASE_URL =
  'https://covers.openlibrary.org/b/isbn';

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
    ? `${OPEN_LIBRARY_ISBN_COVER_BASE_URL}/${normalized}-L.jpg`
    : null;
}
