import type { WorkTraitEvidence } from './work-trait-evidence.ts';

export type WorkTraitEvidenceDiff = {
  inserts: WorkTraitEvidence[];
  updates: WorkTraitEvidence[];
  deletes: WorkTraitEvidence[];
  unchanged: number;
};

export function evidenceIdentity(row: WorkTraitEvidence): string {
  return [row.workId, row.trait, row.source, row.sourceKey].join('\u0000');
}

function comparable(row: WorkTraitEvidence): string {
  return JSON.stringify({
    weight: row.weight,
    confidence: row.confidence,
    rawLabels: [...row.rawLabels].sort((left, right) => left.localeCompare(right, 'en')),
    mappingVersion: row.mappingVersion,
    verifiedAt: row.verifiedAt,
  });
}

export function diffWorkTraitEvidence(
  existing: readonly WorkTraitEvidence[],
  desired: readonly WorkTraitEvidence[],
): WorkTraitEvidenceDiff {
  const existingById = new Map(existing.map((row) => [evidenceIdentity(row), row]));
  const desiredById = new Map(desired.map((row) => [evidenceIdentity(row), row]));
  const inserts: WorkTraitEvidence[] = [];
  const updates: WorkTraitEvidence[] = [];
  const deletes: WorkTraitEvidence[] = [];
  let unchanged = 0;

  for (const [identity, row] of desiredById) {
    const current = existingById.get(identity);
    if (!current) inserts.push(row);
    else if (comparable(current) !== comparable(row)) updates.push(row);
    else unchanged += 1;
  }
  for (const [identity, row] of existingById) {
    if (!desiredById.has(identity)) deletes.push(row);
  }

  return { inserts, updates, deletes, unchanged };
}
