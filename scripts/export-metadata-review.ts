// Offline transformation only. Input is a read-only, keyset-paginated capture.
// Never loads environment credentials, connects to a database or applies edits.
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { tasteEligibility, type TasteIdentity } from '../lib/taste-test/eligibility.ts';
import { editionHasLanguage, withStrictEdition, type StrictEditionRow, type EditionBoundCover } from '../lib/books/strict-edition.ts';
import { buildEffectiveWorkTraitVector, reliableProfileTraits, type WorkTraitEvidence } from '../lib/recommendations/work-trait-evidence.ts';
import { getReviewedWorkTraitCorrection } from '../lib/recommendations/reviewed-work-trait-corrections.ts';
import { getReviewedSeriesMetadata } from '../lib/collections/reviewed-series-metadata.ts';
import { mergeMetadataReviews, metadataCsvCell, type MetadataReview } from '../lib/catalog/metadata-review.ts';

type Row = {
  work: { id: number; title: string; work_type: string | null; subjects: string[] | null; open_library_id: string | null; native_identity_key: string | null; first_publish_year: number | null };
  author: { name: string } | null; editions: StrictEditionRow[];
  categories: { id: string; nl: string; en: string }[];
  evidence: { work_id: number; trait: WorkTraitEvidence['trait']; weight: number; confidence: number; source: WorkTraitEvidence['source']; source_key: string; raw_labels: string[]; mapping_version: string; verified_at: string }[];
  collections: { collection: { id: number; slug: string; name: string; collection_type: string; expected_main_series_total: number | null }; membership: { sequence_number: number | null; subgroup: string | null } }[];
  stored_covers: EditionBoundCover[]; has_ratings: boolean;
};
async function main() {
  const [source, output, previous] = process.argv.slice(2).map(x => resolve(x));
  if (!source || !output) throw new Error('Usage: node --experimental-strip-types scripts/export-metadata-review.ts SOURCE_DIR OUTPUT_DIR [PREVIOUS_JSON]');
  const names = (await readdir(source)).filter(n => /^catalog-\d+\.json$/.test(n)).sort();
  const pages = await Promise.all(names.map(async name => JSON.parse(await readFile(join(source, name), 'utf8')) as { captured_at: string; works_count: number; rows: Row[] }));
  const rows = pages.flatMap(p => p.rows).sort((a, b) => a.work.id - b.work.id);
  const snapshot = JSON.parse(await readFile(join(source, 'final-snapshot.json'), 'utf8'));
  const ids = rows.map(r => String(r.work.id));
  const digest = createHash('md5').update(ids.join(',')).digest('hex');
  if (new Set(ids).size !== ids.length || rows.length !== snapshot.works_count || pages.some(p => p.works_count !== rows.length) || digest !== snapshot.id_digest) throw new Error('Incomplete/changed Work inventory');
  const editionsCount = rows.reduce((n, r) => n + r.editions.length, 0);
  if (editionsCount !== snapshot.editions_count) throw new Error('Edition count mismatch');
  const offered = new Set(snapshot.current_offered_work_ids.map(String));
  const records = rows.map(row => {
    const workId = String(row.work.id);
    const raw: WorkTraitEvidence[] = row.evidence.map(e => ({ workId, trait: e.trait, weight: e.weight, confidence: e.confidence, source: e.source,
      sourceKey: e.source_key, rawLabels: e.raw_labels, mappingVersion: e.mapping_version, verifiedAt: e.verified_at }));
    const memberships = row.collections.map(({ collection: c, membership: m }) => ({ collectionId: String(c.id), slug: c.slug, name: c.name,
      type: c.collection_type, sequence: m.sequence_number, subgroup: m.subgroup, expectedTotal: c.expected_main_series_total }));
    const identity: TasteIdentity = { workId, title: row.work.title, author: row.author?.name ?? null,
      identityKey: row.work.open_library_id ?? row.work.native_identity_key, workType: row.work.work_type,
      labels: [...(row.work.subjects ?? []), ...row.categories.map(c => c.id.replaceAll('_', ' ')), ...raw.flatMap(e => e.rawLabels)], editions: row.editions, memberships };
    const effective = buildEffectiveWorkTraitVector(raw, getReviewedWorkTraitCorrection(workId));
    const eligible = Object.fromEntries((['nl', 'en'] as const).map(language => [language, tasteEligibility(identity, effective, language)]));
    const book = { id: workId, workId, title: row.work.title, author: row.author?.name ?? '', source: 'supabase' as const, score: null, ratingsCount: null, match: null, cover: 'orbit' };
    const editions = Object.fromEntries((['nl', 'en'] as const).map(language => [language, row.editions.filter(e => editionHasLanguage(e, language)).map(e => ({
      ...e, sourceUrl: /^OL\d+M$/.test(e.open_library_edition_id ?? '') ? `https://openlibrary.org/books/${e.open_library_edition_id}` : null,
      coverReferences: withStrictEdition(book, e, language, row.stored_covers)?.coverUrls ?? [],
      coverStatus: row.stored_covers.some(c => c.state === 'resolved' && [e.open_library_edition_id, e.isbn_13, e.isbn_10].includes(c.source_key)) ? 'EXISTING_EDITION_BOUND_CACHE' : 'REFERENCE_NOT_VISUALLY_VERIFIED',
    }))]));
    const seriesStarter = memberships.some(m => m.type === 'series' && m.sequence === 1);
    const priority = offered.has(workId) ? 1 : seriesStarter ? 2 : row.has_ratings ? 3 : 4;
    const review: MetadataReview = { workId, reviewStatus: 'UNREVIEWED', proposedCorrections: {}, verifiedFacts: {}, reviewer: '', checkedAt: '', notes: '' };
    return { workId, canonicalTitle: row.work.title, author: row.author?.name ?? 'UNKNOWN', originalLanguage: 'UNKNOWN',
      existing: { work: row.work, categories: row.categories.map(c => ({ ...c, provenance: 'EXISTING_DB_MAPPING_SOURCE_UNKNOWN' })),
        contentEvidence: raw, effectivePublishedTraits: reliableProfileTraits(effective), existingReviewedCorrection: getReviewedWorkTraitCorrection(workId) ?? null,
        form: row.work.work_type ?? 'UNKNOWN', audience: 'UNKNOWN', publicationPeriod: { firstPublishYear: row.work.first_publish_year,
          evidence: raw.filter(e => ['classic', 'contemporary'].includes(e.trait)) },
        series: memberships.map(m => ({ ...m, reviewedDefinition: getReviewedSeriesMetadata(m.slug), reliability: getReviewedSeriesMetadata(m.slug) ? 'EXISTING_REVIEWED_DEFINITION_MEMBERSHIP_NOT_REVERIFIED' : 'UNKNOWN' })),
        standalone: 'UNKNOWN', editions, otherOrUnknownLanguageEditions: row.editions.filter(e => !editionHasLanguage(e, 'nl') && !editionHasLanguage(e, 'en')),
        storedWorkCoverReferences: row.stored_covers },
      eligibility: eligible, priority, priorityReason: ['','CURRENT_TASTE_OFFER','SERIES_STARTER','HAS_USER_RATINGS','OTHER'][priority],
      sourceUrl: /^OL\d+W$/.test(row.work.open_library_id ?? '') ? `https://openlibrary.org/works/${row.work.open_library_id}` : null,
      catalogCapturedAt: snapshot.captured_at, sourceCheckStatus: 'CAPTURED_NOT_HUMAN_REVERIFIED', review };
  });
  const old = previous ? JSON.parse(await readFile(previous, 'utf8')).records : [];
  const merged = mergeMetadataReviews(records, old);
  const reasons = (language: 'nl' | 'en') => Object.fromEntries([...new Set(records.flatMap(r => r.eligibility[language].reasons))].sort().map(reason => [reason, records.filter(r => r.eligibility[language].reasons.includes(reason)).length]));
  const summary = { capturedFrom: pages[0].captured_at, capturedThrough: snapshot.captured_at, works: rows.length, editions: editionsCount,
    keysetPages: pages.length, idDigest: digest, suitableUniqueWorks: { nl: records.filter(r => r.eligibility.nl.eligible).length, en: records.filter(r => r.eligibility.en.eligible).length },
    reasons: { nl: reasons('nl'), en: reasons('en') }, sourceReadOnly: true, transactionalSnapshot: false,
    note: 'Counts/Work ID digest reconciled. Captured across read-only transactions, not one atomic snapshot. Confidence and fetched timestamps are not new human verification.' };
  const document = { summary, ...merged };
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'catalog-metadata-review.json'), JSON.stringify(document, null, 2) + '\n');
  const headers = ['work_id','canonical_title','author','original_language','categories_existing_json','content_evidence_existing_json','form_existing','audience_existing','period_existing_json','series_existing_json','standalone_existing','nl_editions_json','en_editions_json','nl_eligible','nl_reasons','en_eligible','en_reasons','priority','source_url','catalog_captured_at','review_status','proposed_corrections_json','verified_facts_json','reviewer','checked_at','review_notes'];
  const matrix = merged.records.map(r => [r.workId, r.canonicalTitle, r.author, r.originalLanguage, r.existing.categories,
    r.existing.contentEvidence.map(e => ({ ...e, rawLabels: 'SEE_JSON_BY_WORK_ID' })),
    r.existing.form, r.existing.audience, r.existing.publicationPeriod, r.existing.series, r.existing.standalone,
    r.existing.editions.nl, r.existing.editions.en, String(r.eligibility.nl.eligible), r.eligibility.nl.reasons.join(';'), String(r.eligibility.en.eligible), r.eligibility.en.reasons.join(';'),
    String(r.priority), r.sourceUrl ?? '', r.catalogCapturedAt, r.review.reviewStatus, r.review.proposedCorrections, r.review.verifiedFacts, r.review.reviewer, r.review.checkedAt, r.review.notes]);
  await writeFile(join(output, 'catalog-metadata-review.csv'), '\ufeff' + [headers, ...matrix].map(row => row.map(metadataCsvCell).join(',')).join('\r\n') + '\r\n');
  const batches = [1, 2, 3, 4].map(priority => ({ priority, reason: records.find(r => r.priority === priority)?.priorityReason ?? 'EMPTY',
    batches: Array.from({ length: Math.ceil(records.filter(r => r.priority === priority).length / 50) }, (_, n) => records.filter(r => r.priority === priority).slice(n * 50, (n + 1) * 50).map(r => r.workId)) }));
  await writeFile(join(output, 'review-batches.json'), JSON.stringify(batches, null, 2) + '\n');
  const jamie = records.filter(r => r.author.toLowerCase() === 'jamie oliver').map(r => ({ workId: r.workId, title: r.canonicalTitle, sourceUrl: r.sourceUrl,
    existingLabels: [...new Set(r.existing.contentEvidence.flatMap(e => e.rawLabels))], categories: r.existing.categories, nl: r.eligibility.nl, en: r.eligibility.en,
    conclusion: r.eligibility.nl.reasons.includes('cooking-or-recipes') ? 'COOKING_SUPPORTED_BY_EXISTING_SOURCE_LABELS' : 'NO_COOKING_EVIDENCE_STORED_REVIEW_REQUIRED_NOT_AUTHOR_EXCLUDED' }));
  await writeFile(join(output, 'jamie-oliver-review.json'), JSON.stringify(jamie, null, 2) + '\n');
  const hashes = Object.fromEntries(await Promise.all(['catalog-metadata-review.json','catalog-metadata-review.csv','review-batches.json','jamie-oliver-review.json'].map(async f => [f, createHash('sha256').update(await readFile(join(output, f))).digest('hex')])));
  await writeFile(join(output, 'manifest.json'), JSON.stringify({ summary, hashes }, null, 2) + '\n');
  console.log(JSON.stringify({ summary, jamieOliverWorks: jamie.length, batches: batches.map(b => ({ priority: b.priority, works: b.batches.flat().length })) }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
