/** OFFLINE review tooling only. No runtime imports, network, SQL or apply mode. */
import { tasteEligibility, type TasteIdentity, type TasteMembership } from '../taste-test/eligibility.ts';
import { buildEffectiveWorkTraitVector, type WorkTraitEvidence, type ReviewedWorkTraitCorrection } from '../recommendations/work-trait-evidence.ts';
import type { StrictEditionRow } from '../books/strict-edition.ts';

export type MetadataCaptureRow = {
  workId: string; canonicalTitle: string; author: string;
  existing: {
    work: { title: string; open_library_id: string | null; native_identity_key: string | null; work_type: string | null; subjects: string[] | null };
    categories: { id: string }[]; contentEvidence: WorkTraitEvidence[];
    existingReviewedCorrection: ReviewedWorkTraitCorrection | null; series: TasteMembership[];
    editions: { nl: StrictEditionRow[]; en: StrictEditionRow[] }; otherOrUnknownLanguageEditions: StrictEditionRow[];
  };
};
export type EditionProposal = {
  workId: string; canonicalTitle: string; author: string; identityKey: string;
  nl: { title: string; language: string; isbn13: string; publisher: string; format: string; sources: { url: string; locator: string; facts: string }[] };
  enLanguageRepair?: { editionId: string; title: string; isbn13: string; olid: string; sourceModifiedAt: string };
};
function isbn13Valid(value: string) {
  return /^\d{13}$/.test(value) && [...value].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0) % 10 === 0;
}
export function identityFromCapture(row: MetadataCaptureRow): TasteIdentity {
  const e = row.existing;
  return { workId: row.workId, title: row.canonicalTitle, author: row.author,
    identityKey: e.work.open_library_id ?? e.work.native_identity_key, workType: e.work.work_type,
    labels: [...(e.work.subjects ?? []), ...e.categories.map(c => c.id.replaceAll('_', ' ')), ...e.contentEvidence.flatMap(t => t.rawLabels)],
    memberships: e.series, editions: [...e.editions.nl, ...e.editions.en, ...e.otherOrUnknownLanguageEditions] };
}
export function assessEditionProposal(row: MetadataCaptureRow, proposal: EditionProposal) {
  const identity = identityFromCapture(row);
  if (row.workId !== proposal.workId || row.canonicalTitle !== proposal.canonicalTitle || row.existing.work.title !== proposal.canonicalTitle
    || row.author !== proposal.author || identity.identityKey !== proposal.identityKey)
    throw new Error('Stale/mismatched Work identity: ' + proposal.workId);
  if (proposal.nl.language !== 'nld' || !['Paperback','Ebook'].includes(proposal.nl.format) || !proposal.nl.title.trim() || !isbn13Valid(proposal.nl.isbn13)
    || !proposal.nl.sources.length || proposal.nl.sources.some(s => !/^https:\/\//.test(s.url) || !s.locator || !s.facts))
    throw new Error('Incomplete explicit edition evidence: ' + proposal.workId);
  const editions = structuredClone(identity.editions) as StrictEditionRow[];
  if (editions.some(e => e.isbn_13 === proposal.nl.isbn13)) throw new Error('Edition already exists; inspect instead of duplicating');
  const additions: StrictEditionRow[] = [{ id: `PROPOSAL-NOT-DB:${row.workId}:nl`, work_id: row.workId,
    title: proposal.nl.title, language: 'nld', isbn_13: proposal.nl.isbn13, publisher: proposal.nl.publisher, open_library_edition_id: null }];
  const repair = proposal.enLanguageRepair;
  if (repair) {
    const current = editions.find(e => String(e.id) === repair.editionId);
    if (!current || current.language !== null || current.title !== repair.title || current.isbn_13 !== repair.isbn13
      || current.open_library_edition_id !== repair.olid || !isbn13Valid(repair.isbn13))
      throw new Error('Stale/mismatched English edition: ' + repair.editionId);
    current.language = 'eng'; // Counterfactual clone ONLY. Original record never changes.
  }
  const effective = buildEffectiveWorkTraitVector(row.existing.contentEvidence, row.existing.existingReviewedCorrection ?? undefined);
  const before = { nl: tasteEligibility(identity, effective, 'nl'), en: tasteEligibility(identity, effective, 'en') };
  const projected = { ...identity, editions: [...editions, ...additions] };
  return {
    workId: row.workId, activationReady: false as const, humanReviewRequired: true as const,
    // Solely hypothetical: same evidence/series gate, no extra traits or standalone flags.
    before, counterfactual: { nl: tasteEligibility(projected, effective, 'nl'), en: tasteEligibility(projected, effective, 'en') },
    changes: { nl: { operation: 'PROPOSE_ADD_EDITION', ...additions[0] }, en: repair ? { operation: 'PROPOSE_SET_NULL_LANGUAGE', editionId: repair.editionId, language: 'eng' } : null },
  };
}
