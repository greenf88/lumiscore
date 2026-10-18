import test from 'node:test';
import assert from 'node:assert/strict';
import { tasteEligibility, selectTasteInventory, classifyTasteExclusion, type TasteIdentity } from './eligibility.ts';
import { buildEffectiveWorkTraitVector, type WorkTraitEvidence } from '../recommendations/work-trait-evidence.ts';
import { REVIEWED_SERIES_METADATA } from '../collections/reviewed-series-metadata.ts';

const meta = REVIEWED_SERIES_METADATA[0];
const identity = (extra: Partial<TasteIdentity> = {}): TasteIdentity => ({ workId: '1', title: 'Synthetic', author: 'Synthetic author', identityKey: 'fixture:1',
  workType: null, labels: [], editions: [{ id: 1, title: 'Synthetic edition', language: 'nld', isbn_13: null, open_library_edition_id: null }],
  memberships: [], standaloneEvidence: { sourceUrl: 'https://example.invalid/fixture', checkedAt: '2026-10-17' }, ...extra });
const evidence = (trait = 'literary', confidence = 1, source = 'manual', mappingVersion = 'taste_traits_v1') => buildEffectiveWorkTraitVector([
  { workId: '1', trait, confidence, source, mappingVersion, weight: 1, sourceKey: 'fixture', rawLabels: [], verifiedAt: '2026-10-17' } as WorkTraitEvidence,
]);
const member = (sequence = 1) => ({ collectionId: '1', slug: meta.slug, name: meta.name, type: 'series', sequence, subgroup: 'main', expectedTotal: meta.expectedMainSeriesTotal });

test('content, identity and positive standalone evidence are required; absence is not proof', () => {
  assert.equal(tasteEligibility(identity(), evidence(), 'nl').eligible, true);
  for (const traits of [undefined, evidence('contemporary'), evidence('literary', .1), evidence('literary', 1, 'pilot'), evidence('literary', 1, 'manual', 'unpublished_pilot')])
    assert.ok(tasteEligibility(identity(), traits, 'nl').reasons.includes('content-evidence-missing'));
  assert.ok(tasteEligibility(identity({ identityKey: null }), evidence(), 'nl').reasons.includes('identity-unverified'));
  assert.ok(tasteEligibility(identity({ standaloneEvidence: undefined }), evidence(), 'nl').reasons.includes('series-position-unknown'));
});
test('first reviewed main volume only; an author link cannot bypass sequel/prequel/unknown links', () => {
  const author = { ...member(), type: 'author_collection', sequence: null };
  assert.equal(tasteEligibility(identity({ memberships: [member()], standaloneEvidence: undefined }), evidence(), 'nl').eligible, true);
  for (const link of [member(2), { ...member(), subgroup: 'prequel' }, { ...member(), sequence: null }, { ...member(), slug: 'unreviewed' }])
    assert.equal(tasteEligibility(identity({ memberships: [author, link] }), evidence(), 'nl').eligible, false);
  assert.equal(tasteEligibility(identity({ memberships: [author], standaloneEvidence: undefined }), evidence(), 'nl').eligible, false);
  assert.equal(tasteEligibility(identity({ memberships: [member(), member(2)] }), evidence(), 'nl').eligible, false);
  assert.equal(tasteEligibility(identity({ workType: 'omnibus' }), evidence(), 'nl').eligible, false);
});
test('cooking exclusion is sourced per book, never inferred from Jamie Oliver or title words', () => {
  assert.ok(tasteEligibility(identity({ labels: ['Cooking / Recipes'], author: 'Any author' }), evidence('nonfiction'), 'nl').reasons.includes('cooking-or-recipes'));
  assert.equal(tasteEligibility(identity({ author: 'Jamie Oliver', title: 'Not a classification', labels: ['Biography'] }), evidence('nonfiction'), 'nl').eligible, true);
  assert.equal(tasteEligibility(identity({ title: 'Cooking up a mystery', labels: ['Mystery'] }), evidence(), 'nl').eligible, true);
});
test('three policy rounds never repeat within a round; revisiting earlier skips is explicit and cannot resurrect ratings', () => {
  const books = Array.from({ length: 40 }, (_, n) => identity({ workId: String(n + 1) }));
  const traits = new Map(books.map(b => [b.workId, evidence()]));
  const history: { workId: string; roundId: string; decision: 'offered' | 'rated' | 'skipped' }[] = [];
  const rated = new Set<string>();
  for (const roundId of ['nl-1', 'nl-2', 'nl-3']) {
    const seen = new Set<string>();
    for (let n = 0; n < 10; n++) {
      const [chosen] = selectTasteInventory({ identities: books, evidence: traits, language: 'nl', roundId, ratedIds: rated, history });
      assert.ok(chosen); const id = chosen.identity.workId; assert.equal(seen.has(id), false); seen.add(id);
      const decision = n < 2 ? 'skipped' : 'rated'; if (decision === 'rated') rated.add(id);
      history.push({ workId: id, roundId, decision });
    }
  }
  assert.equal(rated.size, 24);
  const before = structuredClone(history);
  const revisited = selectTasteInventory({ identities: books, evidence: traits, language: 'nl', roundId: 'nl-3', ratedIds: rated, history, revisitEarlierSkips: true });
  assert.ok(revisited.some(b => b.identity.workId === '1'));
  assert.equal(revisited.some(b => ['21', '22'].includes(b.identity.workId)), false);
  assert.equal(revisited.some(b => rated.has(b.identity.workId)), false); assert.deepEqual(history, before);
  assert.equal(classifyTasteExclusion('1', 'nl-3', rated, history, true), 'skipped-earlier');
  assert.equal(classifyTasteExclusion('21', 'nl-3', rated, history, true), 'skipped-this-round');
});
