import type { SeedBook } from './open-library-seeds.ts';

type ImportSeed = SeedBook & {
  manualReviewReason?: string;
};

export type OpenLibraryImportPlan = {
  verifiedSeeds: ImportSeed[];
  skippedManualReviewSeeds: ImportSeed[];
  invalidUnpinnedSeeds: ImportSeed[];
};

export function createOpenLibraryImportPlan(
  seeds: readonly ImportSeed[],
): OpenLibraryImportPlan {
  const verifiedSeeds: ImportSeed[] = [];
  const skippedManualReviewSeeds: ImportSeed[] = [];
  const invalidUnpinnedSeeds: ImportSeed[] = [];

  for (const seed of seeds) {
    if (seed.expectedOpenLibraryWorkId) {
      verifiedSeeds.push(seed);
    } else if (seed.manualReviewReason?.trim()) {
      skippedManualReviewSeeds.push(seed);
    } else {
      invalidUnpinnedSeeds.push(seed);
    }
  }

  return {
    verifiedSeeds,
    skippedManualReviewSeeds,
    invalidUnpinnedSeeds,
  };
}
