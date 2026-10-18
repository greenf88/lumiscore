import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assessEditionProposal, type EditionProposal, type MetadataCaptureRow } from './taste-metadata-proposals.ts';
import { REVIEWED_SERIES_METADATA } from '../collections/reviewed-series-metadata.ts';
const meta = REVIEWED_SERIES_METADATA[0];
const record = (): MetadataCaptureRow => ({ workId: '1', canonicalTitle: 'Fixture', author: 'Synthetic', existing: {
  work: { title: 'Fixture', open_library_id: 'OL1W', native_identity_key: null, work_type: null, subjects: [] }, categories: [],
  contentEvidence: [{ workId: '1', trait: 'fantasy', weight: 1, confidence: .9, source: 'open_library', sourceKey: 'fixture', rawLabels: ['Fantasy'], mappingVersion: 'taste_traits_v1', verifiedAt: '2026-10-18' }],
  existingReviewedCorrection: null, series: [{ collectionId: '1', slug: meta.slug, name: meta.name, type: 'series', sequence: 1, subgroup: 'main', expectedTotal: meta.expectedMainSeriesTotal }],
  editions: { nl: [], en: [] }, otherOrUnknownLanguageEditions: [{ id: 1, work_id: 1, title: 'Fixture', language: null, isbn_13: '9780553897845', open_library_edition_id: 'OL1M' }],
} });
const proposal = (): EditionProposal => ({ workId: '1', canonicalTitle: 'Fixture', author: 'Synthetic', identityKey: 'OL1W',
  nl: { title: 'Nederlandse fixture', language: 'nld', isbn13: '9789024558063', publisher: 'Synthetic', format: 'Paperback', sources: [{ url: 'https://example.invalid/fixture', locator: 'explicit language/ISBN/title', facts: 'SYNTHETIC ONLY' }] },
  enLanguageRepair: { editionId: '1', title: 'Fixture', isbn13: '9780553897845', olid: 'OL1M', sourceModifiedAt: '2026-10-18' } });
test('counterfactual edition proposals use unchanged gate; never approve or mutate capture/review/history', () => {
  const row = record(), p = proposal(), original = structuredClone(row);
  const result = assessEditionProposal(row, p);
  assert.equal(result.before.nl.eligible, false); assert.equal(result.before.en.eligible, false);
  assert.equal(result.counterfactual.nl.eligible, true); assert.equal(result.counterfactual.en.eligible, true);
  assert.equal(result.activationReady, false); assert.equal(result.humanReviewRequired, true);
  assert.deepEqual(row, original);
});
test('identity, exact edition, NULL precondition, ISBN checksum and explicit language are required', () => {
  for (const mutate of [
    (p: EditionProposal) => { p.workId = '2'; }, (p: EditionProposal) => { p.identityKey = 'OL2W'; },
    (p: EditionProposal) => { p.author = 'Other'; }, (p: EditionProposal) => { p.nl.language = 'en'; },
    (p: EditionProposal) => { p.nl.format = 'Audiobook'; },
    (p: EditionProposal) => { p.nl.isbn13 = '9789024558064'; }, (p: EditionProposal) => { p.nl.sources = []; },
    (p: EditionProposal) => { p.enLanguageRepair!.isbn13 = '9780440212560'; },
  ]) { const p = proposal(); mutate(p); assert.throws(() => assessEditionProposal(record(), p)); }
  const row = record(); row.existing.otherOrUnknownLanguageEditions[0].language = 'fra';
  assert.throws(() => assessEditionProposal(row, proposal()));
  const staleTitle = record(); staleTitle.existing.work.title = 'Other Work';
  assert.throws(() => assessEditionProposal(staleTitle, proposal()));
});
test('no invented content, standalone, series order or cooking exceptions can fill inventory', () => {
  for (const mutate of [
    (r: MetadataCaptureRow) => { r.existing.contentEvidence = []; },
    (r: MetadataCaptureRow) => { r.existing.contentEvidence[0].confidence = .1; },
    (r: MetadataCaptureRow) => { r.existing.contentEvidence[0].mappingVersion = 'unpublished_pilot'; },
    (r: MetadataCaptureRow) => { r.existing.series = []; },
    (r: MetadataCaptureRow) => { r.existing.series[0].sequence = 2; },
    (r: MetadataCaptureRow) => { r.existing.series[0].expectedTotal = 999; },
    (r: MetadataCaptureRow) => { r.existing.work.subjects = ['Cooking']; },
  ]) {
    const row = record(); mutate(row);
    const result = assessEditionProposal(row, proposal());
    assert.equal(result.counterfactual.nl.eligible, false); assert.equal(result.counterfactual.en.eligible, false);
  }
});
test('real bounded batch is pending, language-only/addition scope, no standalone or taxonomy patch', async () => {
  const batch = JSON.parse(await readFile(new URL('../../docs/proposals/taste-metadata-batch-20261018.json', import.meta.url), 'utf8'));
  assert.equal(batch.status, 'SOURCE_SUPPORTED_REVIEW_REQUIRED'); assert.equal(batch.humanApproval, null);
  assert.equal(new Set(batch.records.map((r: EditionProposal) => r.workId)).size, 8);
  assert.equal(batch.records.filter((r: EditionProposal) => r.enLanguageRepair).length, 5);
  for (const r of batch.records) assert.deepEqual(Object.keys(r).sort(), ['author','canonicalTitle','identityKey','nl','workId',...(r.enLanguageRepair ? ['enLanguageRepair'] : [])].sort());
});
