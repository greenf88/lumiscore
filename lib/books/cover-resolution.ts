import {
  resolveOpenLibraryCoverResult,
  type OpenLibraryCoverLookup,
} from './open-library-covers.ts';
import { resolveGoogleBooksCoverResult } from './google-books-covers.ts';
import { uniqueCoverUrls } from './covers.ts';
import type { CoverSourceResolution } from './cover-resolution-result.ts';

export type BookCoverLookup = Omit<OpenLibraryCoverLookup, 'workId'> & {
  workId?: string | null;
  isbn13?: string | null;
};

export type BookCoverResolution = {
  coverUrls: string[];
  sources: CoverSourceResolution[];
};

export async function resolveBookCovers(
  lookup: BookCoverLookup,
): Promise<BookCoverResolution> {
  const [openLibrary, googleBooks] = await Promise.all([
    lookup.workId
      ? resolveOpenLibraryCoverResult({
          workId: lookup.workId,
          title: lookup.title,
          author: lookup.author,
          firstPublishYear: lookup.firstPublishYear,
          preferredLanguages: lookup.preferredLanguages,
        })
      : null,
    lookup.isbn13 ? resolveGoogleBooksCoverResult(lookup.isbn13) : null,
  ]);

  return {
    coverUrls: uniqueCoverUrls([
      ...(openLibrary?.coverUrls ?? []),
      googleBooks?.coverUrl,
    ]),
    sources: [openLibrary?.resolution, googleBooks].filter(
      (source): source is CoverSourceResolution => Boolean(source),
    ),
  };
}

export async function resolveBookCoverCandidates(
  lookup: BookCoverLookup,
): Promise<string[]> {
  return (await resolveBookCovers(lookup)).coverUrls;
}
