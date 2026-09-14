import type { SupabaseClient } from '@supabase/supabase-js';
import {
  TASTE_TRAIT_MAPPING_VERSION,
  WORK_TRAIT_EVIDENCE_SOURCES,
  type WorkTraitEvidence,
  type WorkTraitEvidenceSource,
} from '../recommendations/work-trait-evidence.ts';
import { TASTE_TRAITS, type TasteTrait } from '../taste-test/traits.ts';

type EvidenceRow = {
  work_id?: number | string | null;
  trait?: string | null;
  weight?: number | string | null;
  confidence?: number | string | null;
  source?: string | null;
  source_key?: string | null;
  raw_labels?: unknown;
  mapping_version?: string | null;
  verified_at?: string | null;
};

const EVIDENCE_SELECT = [
  'work_id', 'trait', 'weight', 'confidence', 'source', 'source_key',
  'raw_labels', 'mapping_version', 'verified_at',
].join(',');

function parseEvidenceRow(row: EvidenceRow): WorkTraitEvidence | null {
  const workId = Number(row.work_id);
  const weight = Number(row.weight);
  const confidence = Number(row.confidence);
  const trait = row.trait as TasteTrait;
  const source = row.source as WorkTraitEvidenceSource;
  if (
    !Number.isSafeInteger(workId) || workId < 1 ||
    !TASTE_TRAITS.includes(trait) ||
    !WORK_TRAIT_EVIDENCE_SOURCES.includes(source) ||
    !Number.isFinite(weight) || !Number.isFinite(confidence) ||
    !row.source_key || !row.mapping_version || !row.verified_at
  ) return null;

  return {
    workId: String(workId),
    trait,
    weight,
    confidence,
    source,
    sourceKey: row.source_key,
    rawLabels: Array.isArray(row.raw_labels)
      ? row.raw_labels.filter((label): label is string => typeof label === 'string')
      : [],
    mappingVersion: row.mapping_version,
    verifiedAt: row.verified_at,
  };
}

export async function loadWorkTraitEvidenceBatched(
  client: SupabaseClient,
  workIds: readonly string[],
): Promise<Map<string, WorkTraitEvidence[]>> {
  const ids = [...new Set(workIds
    .map(Number)
    .filter((workId) => Number.isSafeInteger(workId) && workId > 0))];
  const batches = Array.from(
    { length: Math.ceil(ids.length / 200) },
    (_, index) => ids.slice(index * 200, (index + 1) * 200),
  );
  const results = await Promise.all(batches.map((batch) => client
    .from('work_trait_evidence')
    .select(EVIDENCE_SELECT)
    .in('work_id', batch)
    .eq('mapping_version', TASTE_TRAIT_MAPPING_VERSION)));
  const failure = results.find(({ error }) => error);
  if (failure?.error) throw failure.error;

  const grouped = new Map<string, WorkTraitEvidence[]>();
  for (const row of results.flatMap(({ data }) => data ?? []) as EvidenceRow[]) {
    const evidence = parseEvidenceRow(row);
    if (!evidence) continue;
    const current = grouped.get(evidence.workId) ?? [];
    current.push(evidence);
    grouped.set(evidence.workId, current);
  }
  return grouped;
}
