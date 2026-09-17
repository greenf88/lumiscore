import { CATALOG_EXPANSION_COLLECTIONS } from './catalog-expansion-plan.ts';
import { REVIEWED_COLLECTION_SEEDS } from './seed-data.ts';
import { REVIEWED_SERIES_CATALOG_PLANS } from './series-catalog-plan.ts';

export type ReviewedSeriesMetadata = {
  slug: string;
  name: string;
  expectedMainSeriesTotal: number;
  source: 'initial_review' | 'reviewed_series_import' | 'catalog_expansion_review';
};

const reviewedMetadata: ReviewedSeriesMetadata[] = [
  ...REVIEWED_COLLECTION_SEEDS
    .filter(({ collectionType }) => collectionType === 'series')
    .map(({ slug, name, books }) => ({
      slug,
      name,
      expectedMainSeriesTotal: books.length,
      source: 'initial_review' as const,
    })),
  ...REVIEWED_SERIES_CATALOG_PLANS.map(({ slug, name, books }) => ({
    slug,
    name,
    expectedMainSeriesTotal: books.length,
    source: 'reviewed_series_import' as const,
  })),
  ...CATALOG_EXPANSION_COLLECTIONS.map(({ slug, name, publishedMainSeriesCount }) => ({
    slug,
    name,
    expectedMainSeriesTotal: publishedMainSeriesCount,
    source: 'catalog_expansion_review' as const,
  })),
];

const metadataBySlug = new Map<string, ReviewedSeriesMetadata>();
for (const metadata of reviewedMetadata) {
  const existing = metadataBySlug.get(metadata.slug);
  if (
    existing &&
    existing.expectedMainSeriesTotal !== metadata.expectedMainSeriesTotal
  ) {
    throw new Error(`Conflicting reviewed series total for ${metadata.slug}.`);
  }
  metadataBySlug.set(metadata.slug, metadata);
}

export const REVIEWED_SERIES_METADATA = [...metadataBySlug.values()]
  .sort((left, right) => left.slug.localeCompare(right.slug, 'en'));

export function getReviewedSeriesMetadata(
  slug: string,
): ReviewedSeriesMetadata | null {
  return metadataBySlug.get(slug) ?? null;
}
