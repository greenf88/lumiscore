import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildEffectiveWorkTraitVector, evidenceRowsForTraits, mapOpenLibrarySubjects, mapReviewedSeedCategory, type ReviewedWorkTraitCorrection} from './work-trait-evidence.ts';
import {getReviewedWorkTraitCorrection} from './reviewed-work-trait-corrections.ts';

test('La Nuit proposal removes contradictory signals only when explicitly supplied, not at runtime', () => {
  const proposal=JSON.parse(readFileSync(new URL('../../catalog/review-proposals/la-nuit-20261015.json',import.meta.url),'utf8'));
  const common={workId:'276',verifiedAt:'2026-10-15',sourceKey:'OL14856842W'};
  const rows=[...evidenceRowsForTraits({...common,traits:mapOpenLibrarySubjects(['Autobiography','Creative nonfiction','Fiction, fantasy, general','Fiction, science fiction, general','Romance literature','Fiction, thrillers, general']),confidence:.85,source:'open_library',rawLabels:[]}),
    ...evidenceRowsForTraits({...common,traits:mapReviewedSeedCategory('fantasy-science-fiction'),confidence:.95,source:'reviewed_seed',rawLabels:[]})];
  const before=buildEffectiveWorkTraitVector(rows);
  assert.ok(before.traits.speculative>0&&before.traits.thriller_mystery>0);
  assert.equal(getReviewedWorkTraitCorrection('276'),undefined);
  const after=buildEffectiveWorkTraitVector(rows,proposal.proposedCorrection as ReviewedWorkTraitCorrection);
  for(const trait of proposal.proposedCorrection.removeTraits) assert.equal(after.traits[trait as keyof typeof after.traits],0);
  assert.equal(after.traits.nonfiction,1);
  assert.equal(after.coverageLevel,'partial');
  assert.deepEqual(proposal.proposedCorrection.addTraits,[]);
  assert.equal(proposal.status,'prepared-not-applied');
  assert.ok(buildEffectiveWorkTraitVector(rows).traits.speculative>0);
});
