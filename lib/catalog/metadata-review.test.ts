import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeMetadataReviews, metadataCsvCell, type MetadataReview } from './metadata-review.ts';
const review = (workId: string): MetadataReview => ({ workId, reviewStatus: 'UNREVIEWED', proposedCorrections: {}, verifiedFacts: {}, reviewer: '', checkedAt: '', notes: '' });
test('review refresh handles more than one page, preserves human fields and archives removed identities', () => {
  const fresh = Array.from({ length: 1201 }, (_, n) => ({ workId: String(n), review: review(String(n)), source: 'fresh' }));
  const approved = { ...review('1100'), reviewStatus: 'VERIFIED', verifiedFacts: { standalone: { sourceUrl: 'https://example.invalid/source' } } };
  const old = [{ workId: '1100', review: approved }, { workId: '9999', review: review('9999') }];
  const merged = mergeMetadataReviews(fresh, old);
  assert.deepEqual(merged.records[1100].review, approved); assert.equal(merged.records.length, 1201);
  assert.equal(merged.orphanedReviews[0].workId, '9999');
  assert.throws(() => mergeMetadataReviews(fresh, [old[0], old[0]]), /Duplicate review/);
  assert.throws(() => mergeMetadataReviews([fresh[0], fresh[0]], []), /Duplicate catalog/);
  assert.throws(() => mergeMetadataReviews(fresh, [{ workId: '2', review: review('1') }]), /mismatch/);
});
test('CSV protects executable cells and preserves quotes, commas, newlines and ISBN strings', () => {
  assert.equal(metadataCsvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(metadataCsvCell('Title, "quoted"\nnext'), '"Title, ""quoted""\nnext"');
  assert.equal(metadataCsvCell('0012345678'), '"0012345678"');
});
