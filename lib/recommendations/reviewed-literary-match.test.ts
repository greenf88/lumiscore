import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEffectiveWorkTraitVector, evidenceRowsForTraits, reliableProfileTraits } from './work-trait-evidence.ts';
import { getReviewedWorkTraitCorrection } from './reviewed-work-trait-corrections.ts';
import { calculatePersonalMatch } from './engine.ts';
import { buildTasteProfile } from '../taste-test/profile.ts';
import { tasteVector } from '../taste-test/traits.ts';

// Frozen public evidence observed on 2026-11-18; no reader data or network access.
const fixtures = [
  { id: '1376', sourceKey: 'OL2239396W', rawLabels: ['Fantasy'], traits: { fantasy: 1, speculative: .8 } },
  { id: '1859', sourceKey: 'OL14860424W', rawLabels: ['Fiction, suspense', 'Fiction, thrillers, suspense'], traits: { thriller_mystery: 1 } },
] as const;

for (const fixture of fixtures) {
  test(`reviewed literary work ${fixture.id}: raw misclassification cannot drive a confident genre match`, () => {
    const raw = evidenceRowsForTraits({ workId: fixture.id, source: 'open_library', sourceKey: fixture.sourceKey,
      rawLabels: [...fixture.rawLabels], traits: fixture.traits, confidence: .85, verifiedAt: '2026-11-18T00:00:00.000Z' });
    const before = structuredClone(raw);
    const effective = buildEffectiveWorkTraitVector(raw, getReviewedWorkTraitCorrection(fixture.id));
    const candidate = { traits: reliableProfileTraits(effective), coverageLevel: effective.coverageLevel, metadataConfidence: effective.metadataConfidence };
    assert.equal(candidate.traits.fantasy, 0);
    assert.equal(candidate.traits.speculative, 0);
    assert.equal(candidate.traits.thriller_mystery, 0);
    assert.ok(candidate.traits.literary > 0);
    assert.deepEqual(raw, before, 'source evidence remains available for review');

    const reader = (traits: ReturnType<typeof tasteVector>) => buildTasteProfile({}, Array.from({ length: 5 }, (_, i) => ({ workId: String(90000 + i), rating: 9, traits })));
    for (const locale of ['en', 'nl'] as const) {
      const genreOnly = calculatePersonalMatch({ profile: reader(tasteVector(fixture.traits)), candidate, workId: fixture.id, locale });
      assert.equal(genreOnly.matchScore, null);
      assert.equal(genreOnly.matchLabel, null);
      assert.doesNotMatch(genreOnly.explanation, /fantasy|speculative|thriller|mysteri/i);
      const literary = calculatePersonalMatch({ profile: reader(tasteVector({ literary: 1 })), candidate, workId: fixture.id, locale });
      assert.match(literary.explanation, /Literary|Literair/);
      assert.doesNotMatch(literary.explanation, /fantasy|speculative|thriller|mysteri/i);
    }
  });
}
