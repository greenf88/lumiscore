import type { CatalogCategory } from '../lib/catalog/category-taxonomy.ts';
import type { WorkTraitCoverageLevel } from '../lib/recommendations/work-trait-evidence.ts';

export type CatalogExpansionConfidence = 'HIGH' | 'REVIEW' | 'REJECT';
export type CatalogExpansionBatch = 'A' | 'B' | 'B2' | 'C';

export type CatalogCandidateEdition = {
  openLibraryEditionId: string;
  language: string;
  isbn10: string | null;
  isbn13: string | null;
  publisher: string | null;
  publishDate: string | null;
  hasCover: boolean;
};

export type CatalogExpansionCandidate = {
  canonicalTitle: string;
  author: string;
  openLibraryWorkId: string | null;
  firstPublishYear: number | null;
  existingLumiScoreWorkId: number | null;
  provenance: string[];
  relevanceReasons: string[];
  categories: CatalogCategory[];
  series: string | null;
  seriesPosition: number | null;
  preferredDutchEdition: CatalogCandidateEdition | null;
  preferredEnglishEdition: CatalogCandidateEdition | null;
  representativeFallbackEdition: CatalogCandidateEdition | null;
  isbn13: string | null;
  availableLanguages: string[];
  originalLanguage: string | null;
  dutchFlemishAuthor: boolean | null;
  confidence: CatalogExpansionConfidence;
  confidenceReason: string;
  batch: CatalogExpansionBatch | null;
  traitCoverage: WorkTraitCoverageLevel;
  metadataConfidence: number;
  hasUsableCover: boolean;
  resolverFallbackRequired: boolean;
  questionableEditionLanguage: boolean;
  duplicateCoverIdentity: boolean;
  selectionScore: number;
  researchRank?: number;
  researchBatch?: 'Batch A' | 'Batch B' | 'Batch C' | 'Reserve';
  researchScore?: number;
  dutchMarketRelevance?: 'High' | 'Medium' | 'Low' | null;
  currentClassification?: 'CURRENT HIGH' | 'CURRENT MEDIUM' | 'EVERGREEN';
  sourceProvenance?: string;
  reasonIncluded?: string;
  internationalCore?: boolean;
  trendGap?: boolean;
  verificationMethod?: string;
  resolvedDuringTargetedReview?: boolean;
};

export type CatalogExpansionPlan = {
  version: string;
  generatedAt: string;
  currentWorkCount: number;
  targetWorkCount: number;
  expectedFinalUniqueWorkCount: number;
  sourceSnapshot: Array<{
    key: string;
    label: string;
    url: string;
    kind: 'dutch_market' | 'international' | 'award' | 'category_gap' | 'trending';
    retrievedAt: string;
  }>;
  batches: Record<CatalogExpansionBatch, CatalogExpansionCandidate[]>;
  reviewCandidates: CatalogExpansionCandidate[];
  rejectedCandidates: CatalogExpansionCandidate[];
  duplicatesAvoided: Array<{
    openLibraryWorkId: string;
    title: string;
    existingLumiScoreWorkId: number;
    provenance: string[];
  }>;
};
