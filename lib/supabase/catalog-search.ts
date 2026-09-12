import {
  CATALOG_SEARCH_MAX_LIMIT,
  CATALOG_SEARCH_LIMIT,
  normalizeCatalogSearchQuery,
  rankCatalogSearchResults,
  type CatalogSearchResult,
} from '@/lib/books/catalog-search';
import { applyRatingSummaries } from '@/lib/ratings/card-summaries';
import { mapCatalogWorks } from './books';
import { supabase } from './client';
import { loadPublicRatingSummaries } from './public-rating-summaries';

const SEARCH_CANDIDATE_LIMIT = 40;
const SEARCH_SELECT = [
  'id',
  'title',
  'first_publish_year',
  'open_library_id',
  'source_type',
  'work_type',
  'author_id',
  'authors(id,name)',
  'editions(id,open_library_edition_id,isbn_13,title)',
].join(',');

function escapeIlikePattern(query: string): string {
  return query.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function searchCatalog(
  query: string,
  limit = CATALOG_SEARCH_LIMIT,
): Promise<CatalogSearchResult[]> {
  const normalizedQuery = normalizeCatalogSearchQuery(query);
  if (normalizedQuery.length < 2) return [];

  const pattern = `%${escapeIlikePattern(normalizedQuery)}%`;
  const [titleResult, authorResult] = await Promise.all([
    supabase
      .from('works')
      .select(SEARCH_SELECT)
      .ilike('title', pattern)
      .order('title', { ascending: true })
      .limit(SEARCH_CANDIDATE_LIMIT),
    supabase
      .from('authors')
      .select('id')
      .ilike('name', pattern)
      .limit(SEARCH_CANDIDATE_LIMIT),
  ]);

  if (titleResult.error) throw titleResult.error;
  if (authorResult.error) throw authorResult.error;

  const authorIds = (authorResult.data ?? [])
    .map((author) => String(author.id ?? '').trim())
    .filter(Boolean);

  const authorWorksResult = authorIds.length
    ? await supabase
        .from('works')
        .select(SEARCH_SELECT)
        .in('author_id', authorIds)
        .order('title', { ascending: true })
        .limit(SEARCH_CANDIDATE_LIMIT)
    : { data: [], error: null };

  if (authorWorksResult.error) throw authorWorksResult.error;

  const books = rankCatalogSearchResults(
    mapCatalogWorks([
      ...(titleResult.data ?? []),
      ...(authorWorksResult.data ?? []),
    ]),
    normalizedQuery,
    Math.min(CATALOG_SEARCH_MAX_LIMIT, Math.max(1, Math.trunc(limit))),
  );
  const summaries = await loadPublicRatingSummaries(
    supabase,
    books.flatMap((book) => (book.workId ? [book.workId] : [])),
  );

  return applyRatingSummaries(books, summaries);
}
