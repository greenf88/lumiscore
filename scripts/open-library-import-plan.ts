import type { SeedBook } from './open-library-seeds.ts';

type ImportSeed = SeedBook & {
  manualReviewReason?: string;
  nativeMetadata?: unknown;
  importDisposition?: 'NEEDS_MORE_RESEARCH' | 'REJECT';
};

export type OpenLibraryImportPlan = {
  verifiedSeeds: ImportSeed[];
  nativeSeeds: ImportSeed[];
  skippedManualReviewSeeds: ImportSeed[];
  rejectedSeeds: ImportSeed[];
  invalidUnpinnedSeeds: ImportSeed[];
};

export function createOpenLibraryImportPlan(
  seeds: readonly ImportSeed[],
): OpenLibraryImportPlan {
  const verifiedSeeds: ImportSeed[] = [];
  const nativeSeeds: ImportSeed[] = [];
  const skippedManualReviewSeeds: ImportSeed[] = [];
  const rejectedSeeds: ImportSeed[] = [];
  const invalidUnpinnedSeeds: ImportSeed[] = [];

  for (const seed of seeds) {
    if (seed.expectedOpenLibraryWorkId) {
      verifiedSeeds.push(seed);
    } else if (seed.nativeMetadata) {
      nativeSeeds.push(seed);
    } else if (seed.importDisposition === 'REJECT') {
      rejectedSeeds.push(seed);
    } else if (seed.importDisposition === 'NEEDS_MORE_RESEARCH') {
      skippedManualReviewSeeds.push(seed);
    } else if (seed.manualReviewReason?.trim()) {
      skippedManualReviewSeeds.push(seed);
    } else {
      invalidUnpinnedSeeds.push(seed);
    }
  }

  return {
    verifiedSeeds,
    nativeSeeds,
    skippedManualReviewSeeds,
    rejectedSeeds,
    invalidUnpinnedSeeds,
  };
}
