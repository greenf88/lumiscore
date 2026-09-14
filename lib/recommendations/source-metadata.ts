import { normalizeOpenLibraryId } from '../books/covers.ts';
import { normalizeVerifiedIsbn13 } from '../books/google-books-covers.ts';

type OpenLibraryWorkResponse = {
  key?: unknown;
  subjects?: unknown;
};

type GoogleBooksResponse = {
  items?: Array<{
    volumeInfo?: {
      industryIdentifiers?: Array<{ type?: string; identifier?: string }>;
      categories?: unknown;
    };
  }>;
};

function stringLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((label): label is string => typeof label === 'string')
    .map((label) => label.trim())
    .filter(Boolean))];
}

export function extractExactOpenLibrarySubjects(
  expectedWorkId: string,
  response: OpenLibraryWorkResponse,
): string[] | null {
  const expected = normalizeOpenLibraryId(expectedWorkId, 'work');
  const actual = typeof response.key === 'string'
    ? normalizeOpenLibraryId(response.key, 'work')
    : null;
  if (!expected || actual !== expected) return null;
  return stringLabels(response.subjects);
}

export function extractExactGoogleBooksCategories(
  requestedIsbn13: string,
  response: GoogleBooksResponse,
): string[] | null {
  const requested = normalizeVerifiedIsbn13(requestedIsbn13);
  if (!requested) return null;

  for (const item of response.items ?? []) {
    const exactMatch = item.volumeInfo?.industryIdentifiers?.some(
      ({ type, identifier }) =>
        type === 'ISBN_13' &&
        normalizeVerifiedIsbn13(identifier) === requested,
    );
    if (!exactMatch) continue;
    return stringLabels(item.volumeInfo?.categories);
  }

  return null;
}
