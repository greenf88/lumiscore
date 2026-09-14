import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  TASTE_TRAIT_MAPPING_VERSION,
  buildEffectiveWorkTraitVector,
  evidenceRowsForTraits,
  mapGoogleBooksCategories,
  mapOpenLibrarySubjects,
  mapPublicationYear,
  mapReviewedSeedCategory,
  mayShowPreciseMatch,
  type WorkTraitEvidenceSource,
} from './work-trait-evidence.ts';
import {
  extractExactGoogleBooksCategories,
  extractExactOpenLibrarySubjects,
} from './source-metadata.ts';
import { diffWorkTraitEvidence } from './enrichment-diff.ts';
import { loadWorkTraitEvidenceBatched } from '../supabase/work-trait-evidence.ts';
import {
  REVIEWED_WORK_TRAIT_CORRECTIONS,
  getReviewedWorkTraitCorrection,
} from './reviewed-work-trait-corrections.ts';

const verifiedAt = '2026-09-13T00:00:00.000Z';

function evidence(
  source: WorkTraitEvidenceSource,
  traits: Parameters<typeof evidenceRowsForTraits>[0]['traits'],
  confidence: number,
) {
  return evidenceRowsForTraits({
    workId: '8',
    traits,
    confidence,
    source,
    sourceKey: `${source}:8`,
    rawLabels: [source],
    verifiedAt,
  });
}

test('mapping version is explicit and stable', () => {
  assert.equal(TASTE_TRAIT_MAPPING_VERSION, 'taste_traits_v1');
});

test('reviewed fantasy-science-fiction seed maps to speculative only', () => {
  assert.deepEqual(mapReviewedSeedCategory('fantasy-science-fiction'), {
    speculative: 1,
  });
});

test('unknown metadata does not invent traits', () => {
  assert.deepEqual(mapReviewedSeedCategory('general-books'), {});
  assert.deepEqual(mapOpenLibrarySubjects(['Adventure stories']), {});
  assert.deepEqual(mapGoogleBooksCategories(['Fiction / General']), {});
});

test('generic source mapping remains deterministic', () => {
  const labels = ['Science fiction, fantasy, horror', 'Fantasy'];
  assert.deepEqual(mapOpenLibrarySubjects(labels), mapOpenLibrarySubjects(labels));
});

test('reviewed correction config is explicit, unique and internally consistent', () => {
  assert.equal(
    new Set(REVIEWED_WORK_TRAIT_CORRECTIONS.map(({ workId }) => workId)).size,
    REVIEWED_WORK_TRAIT_CORRECTIONS.length,
  );
  for (const correction of REVIEWED_WORK_TRAIT_CORRECTIONS) {
    assert.match(correction.workId, /^\d+$/);
    assert.ok(correction.reason.length >= 30);
    assert.match(correction.reviewedAt, /^\d{4}-\d{2}-\d{2}T/);
    const additions = new Set<string>(correction.addTraits.map(({ trait }) => trait));
    assert.equal(correction.removeTraits.some((trait) => additions.has(trait)), false);
  }
});

test('reviewed removal suppresses effective traits while preserving raw evidence', () => {
  const rawEvidence = [
    ...evidence('reviewed_seed', { speculative: 1 }, .95),
    ...evidence('open_library', { science_fiction: 1 }, .85),
  ].map((row) => ({ ...row, workId: '257' }));
  const snapshot = structuredClone(rawEvidence);
  const result = buildEffectiveWorkTraitVector(
    rawEvidence,
    getReviewedWorkTraitCorrection('257'),
  );
  assert.equal(result.traits.science_fiction, 0);
  assert.equal(result.traits.speculative, 0);
  assert.equal(result.coverageLevel, 'none');
  assert.equal(result.evidenceByTrait.science_fiction?.source, 'open_library');
  assert.equal(result.evidenceByTrait.speculative?.source, 'reviewed_seed');
  assert.deepEqual(rawEvidence, snapshot);
});

test('reviewed Krew elfów correction keeps fantasy and speculative but suppresses science fiction', () => {
  const rawEvidence = [
    ...evidence('reviewed_seed', { speculative: 1 }, .95),
    ...evidence('open_library', { fantasy: 1, science_fiction: 1 }, .85),
  ].map((row) => ({ ...row, workId: '165' }));
  const result = buildEffectiveWorkTraitVector(
    rawEvidence,
    getReviewedWorkTraitCorrection('165'),
  );
  assert.ok(result.traits.fantasy > 0);
  assert.ok(result.traits.speculative > 0);
  assert.equal(result.traits.science_fiction, 0);
});

test('unrelated works are unchanged when no reviewed correction exists', () => {
  const rawEvidence = evidence('open_library', { literary: 1, romance: .4 }, .85);
  assert.deepEqual(
    buildEffectiveWorkTraitVector(rawEvidence, getReviewedWorkTraitCorrection('19')),
    buildEffectiveWorkTraitVector(rawEvidence),
  );
});

test('source priority prevents lower evidence from overwriting manual evidence', () => {
  const result = buildEffectiveWorkTraitVector([
    ...evidence('manual', { literary: .4 }, 1),
    ...evidence('reviewed_seed', { literary: 1 }, .95),
    ...evidence('open_library', { literary: 1 }, .85),
  ]);
  assert.equal(result.evidenceByTrait.literary?.source, 'manual');
  assert.equal(result.evidenceByTrait.literary?.weight, .4);
});

test('lower-priority evidence fills a missing trait and provenance is preserved', () => {
  const result = buildEffectiveWorkTraitVector([
    ...evidence('reviewed_seed', { speculative: 1 }, .95),
    ...evidence('open_library', { science_fiction: 1 }, .85),
  ]);
  assert.equal(result.coverageLevel, 'rich');
  assert.equal(result.evidenceByTrait.speculative?.source, 'reviewed_seed');
  assert.equal(result.evidenceByTrait.science_fiction?.source, 'open_library');
});

test('era-only candidates have low metadata confidence', () => {
  const result = buildEffectiveWorkTraitVector(
    evidence('publication_year', mapPublicationYear(1965), .85),
  );
  assert.equal(result.coverageLevel, 'era_only');
  assert.equal(result.metadataConfidenceLevel, 'low');
  assert.equal(mayShowPreciseMatch(result), false);
});

test('partial metadata never permits a precise match percentage', () => {
  const result = buildEffectiveWorkTraitVector(
    evidence('reviewed_seed', { romance: 1 }, .95),
  );
  assert.equal(result.coverageLevel, 'partial');
  assert.equal(mayShowPreciseMatch(result), false);
});

test('exact Open Library work matching is required', () => {
  assert.deepEqual(
    extractExactOpenLibrarySubjects('OL893414W', {
      key: '/works/OL893414W',
      subjects: ['Science fiction'],
    }),
    ['Science fiction'],
  );
  assert.equal(
    extractExactOpenLibrarySubjects('OL893414W', {
      key: '/works/OL1W',
      subjects: ['Science fiction'],
    }),
    null,
  );
});

test('exact Google Books ISBN-13 matching is required', () => {
  const response = {
    items: [{
      volumeInfo: {
        industryIdentifiers: [
          { type: 'ISBN_13', identifier: '9780441172719' },
        ],
        categories: ['Fiction / Science Fiction / General'],
      },
    }],
  };
  assert.deepEqual(
    extractExactGoogleBooksCategories('9780441172719', response),
    ['Fiction / Science Fiction / General'],
  );
  assert.equal(
    extractExactGoogleBooksCategories('9789025474415', response),
    null,
  );
});

test('unchanged enrichment is idempotent', () => {
  const rows = evidence('reviewed_seed', { speculative: 1 }, .95);
  assert.deepEqual(diffWorkTraitEvidence(rows, rows), {
    inserts: [], updates: [], deletes: [], unchanged: 1,
  });
});

test('candidate evidence is loaded in bounded batches instead of N+1 queries', async () => {
  const batches: number[][] = [];
  const client = {
    from: () => ({
      select: () => ({
        in: (_column: string, ids: number[]) => {
          batches.push(ids);
          return {
            eq: async () => ({ data: [], error: null }),
          };
        },
      }),
    }),
  } as unknown as SupabaseClient;
  await loadWorkTraitEvidenceBatched(
    client,
    Array.from({ length: 401 }, (_, index) => String(index + 1)),
  );
  assert.deepEqual(batches.map((batch) => batch.length), [200, 200, 1]);
});

test('evidence migration is public-read and server-write only under RLS', async () => {
  const migration = await readFile(new URL(
    '../../supabase/migrations/20260913182320_work_trait_evidence.sql',
    import.meta.url,
  ), 'utf8');
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /revoke all on table public\.work_trait_evidence from public, anon, authenticated/);
  assert.match(migration, /grant select on table public\.work_trait_evidence to anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on table public\.work_trait_evidence to service_role/);
  assert.doesNotMatch(migration, /for (insert|update|delete)\s+to (anon|authenticated)/i);
});
