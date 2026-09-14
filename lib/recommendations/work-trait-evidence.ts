import {
  TASTE_TRAITS,
  emptyTasteVector,
  normalizeTasteVector,
  type TasteTrait,
  type TasteVector,
} from '../taste-test/traits.ts';

export const TASTE_TRAIT_MAPPING_VERSION = 'taste_traits_v1';

export const WORK_TRAIT_EVIDENCE_SOURCES = [
  'manual',
  'reviewed_seed',
  'open_library',
  'google_books',
  'publication_year',
] as const;

export type WorkTraitEvidenceSource =
  (typeof WORK_TRAIT_EVIDENCE_SOURCES)[number];
export type WorkTraitCoverageLevel = 'rich' | 'partial' | 'era_only' | 'none';
export type MetadataConfidenceLevel = 'high' | 'medium' | 'low';

export type WorkTraitEvidence = {
  workId: string;
  trait: TasteTrait;
  weight: number;
  confidence: number;
  source: WorkTraitEvidenceSource;
  sourceKey: string;
  rawLabels: string[];
  mappingVersion: string;
  verifiedAt: string;
};

export type ReviewedTraitAddition = { trait: TasteTrait; weight: number };
export type ReviewedWorkTraitCorrection = {
  workId: string;
  removeTraits: readonly TasteTrait[];
  addTraits: readonly ReviewedTraitAddition[];
  reason: string;
  reviewedAt: string;
};

export type EffectiveWorkTraits = {
  traits: TasteVector;
  metadataConfidence: number;
  metadataConfidenceLevel: MetadataConfidenceLevel;
  coverageLevel: WorkTraitCoverageLevel;
  evidenceByTrait: Partial<Record<TasteTrait, WorkTraitEvidence>>;
  reviewedCorrection?: ReviewedWorkTraitCorrection;
};

export type TraitWeight = Partial<Record<TasteTrait, number>>;

const CONTENT_TRAITS = new Set<TasteTrait>([
  'fantasy',
  'science_fiction',
  'speculative',
  'literary',
  'romance',
  'thriller_mystery',
  'nonfiction',
]);

const SOURCE_PRIORITY: Record<WorkTraitEvidenceSource, number> = {
  manual: 5,
  reviewed_seed: 4,
  open_library: 3,
  google_books: 2,
  publication_year: 1,
};

const NONFICTION_GOOGLE_CATEGORIES = new Set([
  'antiques collectibles', 'architecture', 'art', 'biography autobiography',
  'business economics', 'computers', 'cooking', 'crafts hobbies', 'design',
  'education', 'family relationships', 'foreign language study',
  'games activities', 'gardening', 'health fitness', 'history', 'house home',
  'humor', 'language arts disciplines', 'law', 'literary criticism',
  'mathematics', 'medical', 'music', 'nature', 'performing arts', 'pets',
  'philosophy', 'photography', 'political science', 'psychology', 'reference',
  'religion', 'science', 'self help', 'social science', 'sports recreation',
  'technology engineering', 'transportation', 'travel', 'true crime',
]);

function normalizeLabel(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/&/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function setTrait(target: TraitWeight, trait: TasteTrait, weight: number): void {
  target[trait] = Math.max(target[trait] ?? 0, weight);
}

function mapExplicitLabels(
  rawLabels: readonly string[],
  source: 'open_library' | 'google_books',
): TraitWeight {
  const traits: TraitWeight = {};

  for (const rawLabel of rawLabels) {
    const label = normalizeLabel(rawLabel);
    const topLevel = normalizeLabel(rawLabel.split('/')[0] ?? '');

    if (/\b(fantasy|fantasy fiction|fairy tale|fairy tales|magic)\b/.test(label)) {
      setTrait(traits, 'fantasy', 1);
      setTrait(traits, 'speculative', .8);
    }
    if (/\b(science fiction|space opera|dystopia|dystopian|dystopias)\b/.test(label)) {
      setTrait(traits, 'science_fiction', 1);
      setTrait(traits, 'speculative', .9);
    }
    if (/\b(thriller|thrillers|mystery|mysteries|detective|crime fiction|suspense fiction)\b/.test(label)) {
      setTrait(traits, 'thriller_mystery', 1);
    }
    if (/\b(romance|romance fiction|romantic fiction|love stories)\b/.test(label)) {
      setTrait(traits, 'romance', 1);
    }
    if (/\b(literary fiction|fiction literary)\b/.test(label)) {
      setTrait(traits, 'literary', 1);
    }
    if (/\b(nonfiction|non fiction|biography|autobiography|memoir)\b/.test(label)) {
      setTrait(traits, 'nonfiction', 1);
    }
    if (
      source === 'google_books' &&
      NONFICTION_GOOGLE_CATEGORIES.has(topLevel)
    ) {
      setTrait(traits, 'nonfiction', 1);
    }
    if (/\b(classic|classics)\b/.test(label)) {
      setTrait(traits, 'classic', 1);
    }
  }

  return traits;
}

export function mapReviewedSeedCategory(category: string): TraitWeight {
  switch (category) {
    case 'fantasy-science-fiction':
      return { speculative: 1 };
    case 'thriller-crime':
      return { thriller_mystery: 1 };
    case 'romance':
    case 'romance-feelgood':
      return { romance: 1 };
    case 'non-fiction':
      return { nonfiction: 1 };
    case 'literary-general-fiction':
      return { literary: 1 };
    case 'classics':
      return { classic: 1 };
    case 'contemporary-general-fiction':
      return { contemporary: 1 };
    default:
      return {};
  }
}

export function mapOpenLibrarySubjects(subjects: readonly string[]): TraitWeight {
  return mapExplicitLabels(subjects, 'open_library');
}

export function mapGoogleBooksCategories(categories: readonly string[]): TraitWeight {
  return mapExplicitLabels(categories, 'google_books');
}

export function mapPublicationYear(year: number | null | undefined): TraitWeight {
  if (!Number.isInteger(year)) return {};
  if (year! <= 1979) return { classic: 1 };
  if (year! >= 2000) return { contemporary: 1 };
  return {};
}

export function evidenceRowsForTraits(input: {
  workId: string;
  traits: TraitWeight;
  confidence: number;
  source: WorkTraitEvidenceSource;
  sourceKey: string;
  rawLabels: readonly string[];
  verifiedAt: string;
}): WorkTraitEvidence[] {
  return TASTE_TRAITS.flatMap((trait) => {
    const weight = input.traits[trait];
    if (!weight || weight <= 0) return [];
    return [{
      workId: input.workId,
      trait,
      weight: Math.min(1, Math.max(0, weight)),
      confidence: Math.min(1, Math.max(0, input.confidence)),
      source: input.source,
      sourceKey: input.sourceKey,
      rawLabels: [...input.rawLabels],
      mappingVersion: TASTE_TRAIT_MAPPING_VERSION,
      verifiedAt: input.verifiedAt,
    }];
  });
}

function compareEvidence(left: WorkTraitEvidence, right: WorkTraitEvidence): number {
  return SOURCE_PRIORITY[right.source] - SOURCE_PRIORITY[left.source]
    || right.confidence - left.confidence
    || right.weight - left.weight
    || left.sourceKey.localeCompare(right.sourceKey, 'en');
}

function confidenceLevel(value: number): MetadataConfidenceLevel {
  if (value >= .8) return 'high';
  if (value >= .55) return 'medium';
  return 'low';
}

export function buildEffectiveWorkTraitVector(
  evidence: readonly WorkTraitEvidence[],
  reviewedCorrection?: ReviewedWorkTraitCorrection,
): EffectiveWorkTraits {
  const usable = evidence.filter((row) =>
    row.mappingVersion === TASTE_TRAIT_MAPPING_VERSION &&
    TASTE_TRAITS.includes(row.trait) &&
    WORK_TRAIT_EVIDENCE_SOURCES.includes(row.source) &&
    row.weight > 0 && row.weight <= 1 &&
    row.confidence >= 0 && row.confidence <= 1,
  );
  const evidenceByTrait: Partial<Record<TasteTrait, WorkTraitEvidence>> = {};
  const rawVector = emptyTasteVector();

  for (const trait of TASTE_TRAITS) {
    const selected = usable.filter((row) => row.trait === trait).sort(compareEvidence)[0];
    if (!selected) continue;
    evidenceByTrait[trait] = selected;
    rawVector[trait] = selected.weight;
  }

  if (reviewedCorrection) {
    for (const trait of reviewedCorrection.removeTraits) rawVector[trait] = 0;
    for (const addition of reviewedCorrection.addTraits) {
      rawVector[addition.trait] = Math.min(1, Math.max(0, addition.weight));
    }
  }

  const meaningfulTraits = TASTE_TRAITS.filter((trait) =>
    CONTENT_TRAITS.has(trait) && rawVector[trait] > 0,
  );
  const hasManualProfile = TASTE_TRAITS.some(
    (trait) => rawVector[trait] > 0 && evidenceByTrait[trait]?.source === 'manual',
  );
  const hasEra = rawVector.classic > 0 || rawVector.contemporary > 0;
  const coverageLevel: WorkTraitCoverageLevel =
    hasManualProfile || meaningfulTraits.length >= 2
      ? 'rich'
      : meaningfulTraits.length === 1
        ? 'partial'
        : hasEra
          ? 'era_only'
          : 'none';
  const reviewedAdditions = new Map(
    (reviewedCorrection?.addTraits ?? []).map((addition) => [addition.trait, addition]),
  );
  const confidenceRows = (meaningfulTraits.length
    ? meaningfulTraits
    : TASTE_TRAITS.filter((trait) => rawVector[trait] > 0))
    .flatMap((trait) => {
      const addition = reviewedAdditions.get(trait);
      if (addition) return [{ weight: addition.weight, confidence: 1 }];
      const row = evidenceByTrait[trait];
      return row ? [{ weight: row.weight, confidence: row.confidence }] : [];
    });
  const confidenceWeight = confidenceRows.reduce((sum, row) => sum + row.weight, 0);
  const sourceConfidence = confidenceWeight > 0
    ? confidenceRows.reduce(
      (sum, row) => sum + row.confidence * row.weight,
      0,
    ) / confidenceWeight
    : 0;
  const coverageFactor = coverageLevel === 'rich'
    ? 1
    : coverageLevel === 'partial'
      ? .78
      : coverageLevel === 'era_only'
        ? .35
        : 0;
  const metadataConfidence = Math.round(sourceConfidence * coverageFactor * 1_000) / 1_000;

  return {
    traits: normalizeTasteVector(rawVector),
    metadataConfidence,
    metadataConfidenceLevel: confidenceLevel(metadataConfidence),
    coverageLevel,
    evidenceByTrait,
    ...(reviewedCorrection ? { reviewedCorrection } : {}),
  };
}

export function isMeaningfullyCovered(result: EffectiveWorkTraits): boolean {
  return result.coverageLevel === 'rich' || result.coverageLevel === 'partial';
}

export function mayShowPreciseMatch(result: EffectiveWorkTraits): boolean {
  return result.coverageLevel === 'rich' && result.metadataConfidence >= .8;
}
