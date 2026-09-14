import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Book } from '../app/data/books.ts';
import { normalizeOpenLibraryId } from '../lib/books/covers.ts';
import { normalizeVerifiedIsbn13 } from '../lib/books/google-books-covers.ts';
import { diffWorkTraitEvidence } from '../lib/recommendations/enrichment-diff.ts';
import {
  getMatchPresentation,
  recommendBooks,
  type RecommendationCandidate,
} from '../lib/recommendations/engine.ts';
import {
  REVIEWED_WORK_TRAIT_CORRECTIONS,
  getReviewedWorkTraitCorrection,
} from '../lib/recommendations/reviewed-work-trait-corrections.ts';
import {
  extractExactGoogleBooksCategories,
  extractExactOpenLibrarySubjects,
} from '../lib/recommendations/source-metadata.ts';
import {
  TASTE_TRAIT_MAPPING_VERSION,
  buildEffectiveWorkTraitVector,
  evidenceRowsForTraits,
  isMeaningfullyCovered,
  mapGoogleBooksCategories,
  mapOpenLibrarySubjects,
  mapPublicationYear,
  mapReviewedSeedCategory,
  mayShowPreciseMatch,
  type EffectiveWorkTraits,
  type MetadataConfidenceLevel,
  type WorkTraitEvidence,
} from '../lib/recommendations/work-trait-evidence.ts';
import { TASTE_TEST_ANCHORS, TASTE_TEST_WORK_IDS } from '../lib/taste-test/config.ts';
import type { TasteProfile } from '../lib/taste-test/profile.ts';
import {
  TASTE_TRAITS,
  cosineTasteSimilarity,
  emptyTasteVector,
  normalizeTasteVector,
  tasteVector,
  type TasteVector,
} from '../lib/taste-test/traits.ts';
import { loadWorkTraitEvidenceBatched } from '../lib/supabase/work-trait-evidence.ts';
import { SEED_BOOKS, type SeedBook } from './open-library-seeds.ts';
import type { NetherlandsSeedBook } from './open-library-seeds-nl.ts';

type SeedWithContext = SeedBook & Partial<NetherlandsSeedBook>;
type WorkRow = {
  id: number;
  title: string;
  first_publish_year: number | null;
  open_library_id: string | null;
  source_type: string | null;
  authors: { name?: string } | Array<{ name?: string }> | null;
  editions: Array<{ isbn_13?: string | null }> | null;
};
type CachedSource = {
  state: 'resolved' | 'confirmed_missing';
  labels: string[];
  verifiedAt: string;
};
type SourceCache = {
  mappingVersion: string;
  openLibrary: Record<string, CachedSource>;
  googleBooks: Record<string, CachedSource>;
};

const APPLY = process.argv.slice(2).includes('--apply');
const CACHED_ONLY = process.argv.slice(2).includes('--cached-only');
const CURATED_VERIFIED_AT = '2026-09-13T00:00:00.000Z';
const CACHE_PATH = resolve('work', 'taste-traits-v1-source-cache.json');
const REPORT_PATH = resolve('work', 'taste-traits-v1-dry-run.json');
const OPEN_LIBRARY_CONFIDENCE = .85;
const GOOGLE_BOOKS_CONFIDENCE = .75;
const REVIEWED_SEED_CONFIDENCE = .95;
const PUBLICATION_YEAR_CONFIDENCE = .85;
const anchorWorkIds = new Set<string>(TASTE_TEST_WORK_IDS);

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !publishableKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
}
const publicClient = createClient(supabaseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalizeIdentity(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`´]/g, "'")
    .replace(/[‐‑‒–—]/g, '-')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function authorName(work: WorkRow): string {
  const author = Array.isArray(work.authors) ? work.authors[0] : work.authors;
  return author?.name?.trim() || 'Unknown author';
}

function firstValidIsbn13(work: WorkRow): string | null {
  for (const edition of work.editions ?? []) {
    const isbn = normalizeVerifiedIsbn13(edition.isbn_13);
    if (isbn) return isbn;
  }
  return null;
}

const seeds = SEED_BOOKS as readonly SeedWithContext[];
const seedsByOlid = new Map<string, SeedWithContext>();
const seedsByTitleAuthor = new Map<string, SeedWithContext[]>();
for (const seed of seeds) {
  const olid = normalizeOpenLibraryId(seed.expectedOpenLibraryWorkId, 'work');
  if (olid) seedsByOlid.set(olid, seed);
  const titles = [seed.title, seed.preferredDisplayTitle, ...(seed.alternateTitles ?? [])]
    .filter((title): title is string => Boolean(title));
  for (const title of titles) {
    const key = `${normalizeIdentity(title)}\u0000${normalizeIdentity(seed.author)}`;
    seedsByTitleAuthor.set(key, [...(seedsByTitleAuthor.get(key) ?? []), seed]);
  }
}

function matchReviewedSeed(work: WorkRow): SeedWithContext | null {
  const olid = normalizeOpenLibraryId(work.open_library_id, 'work');
  if (olid && seedsByOlid.has(olid)) return seedsByOlid.get(olid)!;
  const key = `${normalizeIdentity(work.title)}\u0000${normalizeIdentity(authorName(work))}`;
  const matches = [...new Set(seedsByTitleAuthor.get(key) ?? [])];
  return matches.length === 1 ? matches[0] : null;
}

async function loadCatalog(): Promise<WorkRow[]> {
  const rows: WorkRow[] = [];
  const select = 'id,title,first_publish_year,open_library_id,source_type,authors(name),editions(isbn_13)';
  for (let from = 0; ; from += 500) {
    const { data, error } = await publicClient.from('works').select(select)
      .order('id').range(from, from + 499);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as WorkRow[]));
    if ((data?.length ?? 0) < 500) break;
  }
  return rows;
}

async function loadCache(): Promise<SourceCache> {
  try {
    const parsed = JSON.parse(await readFile(CACHE_PATH, 'utf8')) as SourceCache;
    if (parsed.mappingVersion === TASTE_TRAIT_MAPPING_VERSION) return parsed;
  } catch {
    // A missing or old local cache is rebuilt from exact upstream identifiers.
  }
  return { mappingVersion: TASTE_TRAIT_MAPPING_VERSION, openLibrary: {}, googleBooks: {} };
}

async function saveCache(cache: SourceCache): Promise<void> {
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithRetry(url: URL): Promise<Response | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'LumiScore recommendation metadata enrichment' },
        signal: AbortSignal.timeout(12_000),
      });
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) return response;
      await response.body?.cancel();
      await wait([250, 750, 1_500][attempt]);
    } catch {
      if (attempt === 2) return null;
      await wait([250, 750, 1_500][attempt]);
    }
  }
  return null;
}

async function mapLimit<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function resolveOpenLibrarySubjects(
  workId: string,
  olid: string,
  cache: SourceCache,
): Promise<CachedSource | null> {
  if (cache.openLibrary[olid]) return cache.openLibrary[olid];
  if (CACHED_ONLY) return null;
  const response = await fetchWithRetry(new URL(`/works/${olid}.json`, 'https://openlibrary.org'));
  if (!response || (!response.ok && response.status !== 404)) return null;
  const verifiedAt = new Date().toISOString();
  if (response.status === 404) {
    return cache.openLibrary[olid] = { state: 'confirmed_missing', labels: [], verifiedAt };
  }
  const labels = extractExactOpenLibrarySubjects(olid, await response.json());
  if (labels === null) {
    console.warn(JSON.stringify({ source: 'open_library', work_id: workId, source_key: olid, state: 'identity_mismatch' }));
    return null;
  }
  return cache.openLibrary[olid] = {
    state: labels.length ? 'resolved' : 'confirmed_missing', labels, verifiedAt,
  };
}

let googleUnavailable = false;
async function resolveGoogleBooksCategories(
  workId: string,
  isbn13: string,
  cache: SourceCache,
): Promise<CachedSource | null> {
  if (cache.googleBooks[isbn13]) return cache.googleBooks[isbn13];
  if (CACHED_ONLY) return null;
  if (googleUnavailable) return null;
  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', `isbn:${isbn13}`);
  url.searchParams.set('maxResults', '10');
  url.searchParams.set('projection', 'full');
  if (process.env.GOOGLE_BOOKS_API_KEY) url.searchParams.set('key', process.env.GOOGLE_BOOKS_API_KEY);
  const response = await fetchWithRetry(url);
  if (!response || !response.ok) {
    if (response?.status === 403 || response?.status === 429) googleUnavailable = true;
    return null;
  }
  const labels = extractExactGoogleBooksCategories(isbn13, await response.json());
  const verifiedAt = new Date().toISOString();
  if (labels === null) {
    return cache.googleBooks[isbn13] = { state: 'confirmed_missing', labels: [], verifiedAt };
  }
  const result: CachedSource = {
    state: labels.length ? 'resolved' : 'confirmed_missing', labels, verifiedAt,
  };
  cache.googleBooks[isbn13] = result;
  if (!labels.length) console.info(JSON.stringify({ source: 'google_books', work_id: workId, source_key: isbn13, state: 'exact_match_without_categories' }));
  return result;
}

function manualEvidence(work: WorkRow): WorkTraitEvidence[] {
  const anchor = TASTE_TEST_ANCHORS[String(work.id)];
  if (!anchor) return [];
  return evidenceRowsForTraits({
    workId: String(work.id), traits: anchor.traits, confidence: 1,
    source: 'manual', sourceKey: `taste_test_v1:${work.id}`,
    rawLabels: ['taste_test_anchor'], verifiedAt: CURATED_VERIFIED_AT,
  });
}

function seedEvidence(work: WorkRow, seed: SeedWithContext | null): WorkTraitEvidence[] {
  if (!seed) return [];
  const category = seed.netherlandsCategory ?? seed.category;
  return evidenceRowsForTraits({
    workId: String(work.id), traits: mapReviewedSeedCategory(category),
    confidence: REVIEWED_SEED_CONFIDENCE, source: 'reviewed_seed',
    sourceKey: category, rawLabels: [category], verifiedAt: CURATED_VERIFIED_AT,
  });
}

function yearEvidence(work: WorkRow): WorkTraitEvidence[] {
  return evidenceRowsForTraits({
    workId: String(work.id), traits: mapPublicationYear(work.first_publish_year),
    confidence: PUBLICATION_YEAR_CONFIDENCE, source: 'publication_year',
    sourceKey: String(work.first_publish_year ?? 'unknown'),
    rawLabels: work.first_publish_year ? [String(work.first_publish_year)] : [],
    verifiedAt: CURATED_VERIFIED_AT,
  });
}

async function loadExistingEvidence(
  workIds: string[],
): Promise<{ available: boolean; rows: WorkTraitEvidence[] }> {
  try {
    const grouped = await loadWorkTraitEvidenceBatched(publicClient, workIds);
    return { available: true, rows: [...grouped.values()].flat() };
  } catch (error) {
    if (!APPLY) {
      console.warn(JSON.stringify({
        event: 'work_trait_evidence_unavailable',
        dry_run_continues_as_empty_table: true,
        code: typeof error === 'object' && error && 'code' in error ? String(error.code) : null,
      }));
      return { available: false, rows: [] };
    }
    throw error;
  }
}

function dbRow(row: WorkTraitEvidence) {
  return {
    work_id: Number(row.workId), trait: row.trait, weight: row.weight,
    confidence: row.confidence, source: row.source, source_key: row.sourceKey,
    raw_labels: row.rawLabels, mapping_version: row.mappingVersion,
    verified_at: row.verifiedAt, updated_at: new Date().toISOString(),
  };
}

async function applyDiff(
  client: SupabaseClient,
  diff: ReturnType<typeof diffWorkTraitEvidence>,
): Promise<void> {
  const writes = [...diff.inserts, ...diff.updates];
  for (let from = 0; from < writes.length; from += 200) {
    const { error } = await client.from('work_trait_evidence').upsert(
      writes.slice(from, from + 200).map(dbRow),
      { onConflict: 'work_id,trait,source,source_key' },
    );
    if (error) throw error;
  }
  for (const row of diff.deletes) {
    const { error } = await client.from('work_trait_evidence').delete()
      .eq('work_id', Number(row.workId)).eq('trait', row.trait)
      .eq('source', row.source).eq('source_key', row.sourceKey);
    if (error) throw error;
  }
}

async function loadRatingSummaries(workIds: number[]) {
  const result = new Map<string, { average: number | null; count: number }>();
  for (let from = 0; from < workIds.length; from += 100) {
    const { data, error } = await publicClient.rpc('get_work_rating_summaries', {
      target_work_ids: workIds.slice(from, from + 100),
    });
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ work_id: number; lumiscore: number | string | null; rating_count: number | string }>) {
      result.set(String(row.work_id), {
        average: row.lumiscore === null ? null : Number(row.lumiscore), count: Number(row.rating_count),
      });
    }
  }
  return result;
}

function auditProfile(vector: Partial<TasteVector>): TasteProfile {
  return {
    vector: normalizeTasteVector(tasteVector(vector)),
    tasteTestVector: normalizeTasteVector(tasteVector(vector)),
    ratingsVector: emptyTasteVector(), blend: { tasteTest: 1, ratings: 0 },
    answeredCount: 10, selectedCount: 5, ratingCount: 12,
    meaningfulRatingCount: 12, confidence: 'HIGH', summary: 'Audit profile',
  };
}

function coverageSummary(indexes: number[], effective: EffectiveWorkTraits[]) {
  const coverage = { rich: 0, partial: 0, era_only: 0, none: 0 };
  const confidence: Record<MetadataConfidenceLevel, number> = { high: 0, medium: 0, low: 0 };
  let recommendationEligible = 0;
  let preciseMatchEligible = 0;
  for (const index of indexes) {
    const result = effective[index];
    coverage[result.coverageLevel] += 1;
    confidence[result.metadataConfidenceLevel] += 1;
    if (result.coverageLevel !== 'none') recommendationEligible += 1;
    if (mayShowPreciseMatch(result)) preciseMatchEligible += 1;
  }
  return { total: indexes.length, coverage, confidence, recommendationEligible, preciseMatchEligible };
}

const catalog = await loadCatalog();
const cache = await loadCache();
const seedMatches = catalog.map(matchReviewedSeed);
const desiredByWork = catalog.map((work, index) => [
  ...manualEvidence(work), ...seedEvidence(work, seedMatches[index]), ...yearEvidence(work),
]);

await mapLimit(catalog, 8, async (work, index) => {
  const olid = normalizeOpenLibraryId(work.open_library_id, 'work');
  if (!olid) return;
  const source = await resolveOpenLibrarySubjects(String(work.id), olid, cache);
  if (source?.labels.length) desiredByWork[index].push(...evidenceRowsForTraits({
    workId: String(work.id), traits: mapOpenLibrarySubjects(source.labels),
    confidence: OPEN_LIBRARY_CONFIDENCE, source: 'open_library', sourceKey: olid,
    rawLabels: source.labels, verifiedAt: source.verifiedAt,
  }));
  if ((index + 1) % 200 === 0) console.info(JSON.stringify({ stage: 'open_library', completed: index + 1, total: catalog.length }));
});
if (!CACHED_ONLY) await saveCache(cache);

const googleCandidates = catalog.map((work, index) => ({
  work, index, isbn13: firstValidIsbn13(work),
  covered: isMeaningfullyCovered(buildEffectiveWorkTraitVector(
    desiredByWork[index],
    getReviewedWorkTraitCorrection(String(work.id)),
  )),
})).filter(({ isbn13, covered }) => Boolean(isbn13) && !covered);
await mapLimit(googleCandidates, 2, async ({ work, index, isbn13 }, position) => {
  const source = await resolveGoogleBooksCategories(String(work.id), isbn13!, cache);
  if (source?.labels.length) desiredByWork[index].push(...evidenceRowsForTraits({
    workId: String(work.id), traits: mapGoogleBooksCategories(source.labels),
    confidence: GOOGLE_BOOKS_CONFIDENCE, source: 'google_books', sourceKey: isbn13!,
    rawLabels: source.labels, verifiedAt: source.verifiedAt,
  }));
  if ((position + 1) % 50 === 0) console.info(JSON.stringify({ stage: 'google_books', completed: position + 1, total: googleCandidates.length }));
});
if (!CACHED_ONLY) await saveCache(cache);

const desired = desiredByWork.flat();
const existing = await loadExistingEvidence(catalog.map(({ id }) => String(id)));
const diff = diffWorkTraitEvidence(existing.rows, desired);
if (APPLY) {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Apply mode requires SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.');
  const adminClient = createClient(supabaseUrl, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  await applyDiff(adminClient, diff);
}

const uncorrectedEffective = desiredByWork.map((evidence) =>
  buildEffectiveWorkTraitVector(evidence));
const effective = desiredByWork.map((evidence, index) => buildEffectiveWorkTraitVector(
  evidence,
  getReviewedWorkTraitCorrection(String(catalog[index].id)),
));
const allIndexes = catalog.map((_, index) => index);
const dutchIndexes = allIndexes.filter((index) => Boolean(seedMatches[index]?.collection));
const globalIndexes = allIndexes.filter((index) => !seedMatches[index]?.collection);
const nativeIndexes = allIndexes.filter((index) => catalog[index].source_type === 'lumiscore_native');
const ratings = await loadRatingSummaries(catalog.map(({ id }) => id));
function buildRecommendationCandidates(
  effectiveTraits: readonly EffectiveWorkTraits[],
): RecommendationCandidate[] {
  return catalog.flatMap((work, index) => {
    const traits = effectiveTraits[index];
    if (traits.coverageLevel === 'none') return [];
    const rating = ratings.get(String(work.id)) ?? { average: null, count: 0 };
    const book: Book = {
      id: `work-${work.id}`, source: 'supabase', workId: String(work.id),
      title: work.title, author: authorName(work), firstPublishYear: work.first_publish_year,
      score: rating.average, ratingsCount: rating.count, match: null, cover: 'orbit',
    };
    return [{
      book, traits: traits.traits, metadataConfidence: traits.metadataConfidence,
      coverageLevel: traits.coverageLevel,
    }];
  });
}
const candidates = buildRecommendationCandidates(effective);
const uncorrectedCandidates = buildRecommendationCandidates(uncorrectedEffective);
const profiles = {
  dune_science_fiction: { vector: { science_fiction: 1, speculative: 1, worldbuilding: .8, idea_driven: .65 }, rated: ['8'] },
  literary_classic: { vector: { literary: 1, classic: 1, character_driven: .8, slow_burn: .55 }, rated: ['3'] },
  thriller: { vector: { thriller_mystery: 1, dark: .6, fast_paced: .7 }, rated: ['49'] },
  romance_contemporary: { vector: { romance: 1, contemporary: 1, character_driven: .75, uplifting: .4 }, rated: ['105'] },
  nonfiction_idea_driven: { vector: { nonfiction: 1, idea_driven: 1, complex: .4 }, rated: ['78'] },
} satisfies Record<string, { vector: Partial<TasteVector>; rated: string[] }>;

function displayCategory(
  workTraits: EffectiveWorkTraits,
  profile: TasteProfile,
): 'exact_percentage' | 'strong_match' | 'good_match' | 'possible_match' | 'early_match' | 'none' {
  const personalSimilarity = Math.max(0, cosineTasteSimilarity(profile.vector, workTraits.traits));
  const presentation = getMatchPresentation({
    personalSimilarity,
    candidateCoverage: workTraits.coverageLevel,
    metadataConfidence: workTraits.metadataConfidence,
    userConfidence: profile.confidence,
  });
  if (presentation.matchScore !== null) return 'exact_percentage';
  if (presentation.matchLabel === 'Strong match') return 'strong_match';
  if (presentation.matchLabel === 'Good match') return 'good_match';
  if (presentation.matchLabel === 'Possible match') return 'possible_match';
  if (presentation.matchLabel === 'Early match') return 'early_match';
  return 'none';
}

function displayGateSummary(profile: TasteProfile) {
  const counts = {
    exact_percentage: 0,
    strong_match: 0,
    good_match: 0,
    possible_match: 0,
    early_match: 0,
    none: 0,
  };
  for (const workTraits of effective) counts[displayCategory(workTraits, profile)] += 1;
  return {
    counts,
    percentages: Object.fromEntries(Object.entries(counts).map(([category, count]) => [
      category,
      Number((count / catalog.length * 100).toFixed(1)),
    ])),
  };
}

function simulateProfiles(simulationCandidates: readonly RecommendationCandidate[]) {
  return Object.fromEntries(Object.entries(profiles).map(([name, definition]) => [
    name,
    recommendBooks({ candidates: simulationCandidates, profile: auditProfile(definition.vector), ratedWorkIds: new Set(definition.rated), limit: 10 })
    .map((recommendation) => ({
      title: recommendation.book.title, work_id: recommendation.book.workId,
      raw_personal_similarity: Number(recommendation.personalMatch.toFixed(4)),
      match_score: recommendation.matchScore,
      match_label: recommendation.matchLabel,
      display: recommendation.matchScore === null
        ? recommendation.matchLabel
        : `Your Match ${recommendation.matchScore}%`,
      match_confidence: recommendation.matchConfidence,
      ranking_score: Number(recommendation.rankingScore.toFixed(4)),
      coverage_level: recommendation.coverageLevel,
      metadata_confidence: recommendation.metadataConfidence,
      anchor: anchorWorkIds.has(recommendation.book.workId!),
    })),
  ]));
}

const simulationsBeforeCorrections = simulateProfiles(uncorrectedCandidates);
const simulations = simulateProfiles(candidates);

const displayGateCatalog = Object.fromEntries(Object.entries(profiles).map(([name, definition]) => [
  name,
  displayGateSummary(auditProfile(definition.vector)),
]));

const anomalySpecs = [
  { workId: '311', expectedTitle: 'Heretics of Dune', profile: 'dune_science_fiction' },
  { workId: '208', expectedTitle: 'Parable of the Sower', profile: 'dune_science_fiction' },
  { workId: '257', expectedTitle: 'Fight Club', profile: 'dune_science_fiction' },
  { workId: '19', expectedTitle: 'Neuromancer', profile: 'dune_science_fiction' },
  { workId: '165', expectedTitle: 'Krew elfów', profile: 'dune_science_fiction' },
  { workId: '1257', expectedTitle: 'Zwaar verliefd', profile: 'romance_contemporary' },
  { workId: '540', expectedTitle: 'The Elite', profile: 'romance_contemporary' },
  { workId: '36', expectedTitle: 'The Catcher in the Rye', profile: 'literary_classic' },
  { workId: '319', expectedTitle: 'East of Eden', profile: 'literary_classic' },
  { workId: '903', expectedTitle: 'How to Get Rich', profile: 'nonfiction_idea_driven' },
  { workId: '840', expectedTitle: 'Into Thin Air', profile: 'nonfiction_idea_driven' },
  { workId: '849', expectedTitle: 'The Power of Now', profile: 'nonfiction_idea_driven' },
] as const;
const catalogIndexByWorkId = new Map(catalog.map((work, index) => [String(work.id), index]));
const anomalousBookAudit = anomalySpecs.map((spec) => {
  const index = catalogIndexByWorkId.get(spec.workId);
  if (index === undefined) return { ...spec, error: 'work_not_found' };
  const work = catalog[index];
  const workTraits = effective[index];
  const profile = auditProfile(profiles[spec.profile].vector);
  const rawSimilarity = Math.max(0, cosineTasteSimilarity(profile.vector, workTraits.traits));
  const selectedEvidence = TASTE_TRAITS.flatMap((trait) => {
    const row = workTraits.evidenceByTrait[trait];
    if (!row) return [];
    return [{
      trait,
      effective_weight: Number(workTraits.traits[trait].toFixed(4)),
      suppressed_by_review: workTraits.reviewedCorrection?.removeTraits.includes(trait) ?? false,
      evidence_weight: row.weight,
      source: row.source,
      source_key: row.sourceKey,
      source_confidence: row.confidence,
      raw_labels: row.rawLabels,
    }];
  });
  const cosineContributions = TASTE_TRAITS.flatMap((trait) => {
    const contribution = profile.vector[trait] * workTraits.traits[trait];
    if (contribution <= 0) return [];
    return [{
      trait,
      user_weight: Number(profile.vector[trait].toFixed(4)),
      work_weight: Number(workTraits.traits[trait].toFixed(4)),
      dot_product_contribution: Number(contribution.toFixed(4)),
    }];
  }).sort((left, right) => right.dot_product_contribution - left.dot_product_contribution);
  const presentation = getMatchPresentation({
    personalSimilarity: rawSimilarity,
    candidateCoverage: workTraits.coverageLevel,
    metadataConfidence: workTraits.metadataConfidence,
    userConfidence: profile.confidence,
  });
  return {
    work_id: spec.workId,
    expected_title: spec.expectedTitle,
    catalog_title: work.title,
    comparison_profile: spec.profile,
    coverage_level: workTraits.coverageLevel,
    metadata_confidence: workTraits.metadataConfidence,
    metadata_confidence_level: workTraits.metadataConfidenceLevel,
    reviewed_correction: workTraits.reviewedCorrection ?? null,
    effective_vector: Object.fromEntries(TASTE_TRAITS.filter((trait) => workTraits.traits[trait] !== 0)
      .map((trait) => [trait, Number(workTraits.traits[trait].toFixed(4))])),
    selected_source_evidence: selectedEvidence,
    raw_cosine_similarity: Number(rawSimilarity.toFixed(4)),
    cosine_contributions: cosineContributions,
    cosine_reason: cosineContributions.length
      ? `The normalized vectors overlap on ${cosineContributions.map(({ trait }) => trait).join(', ')}; the listed dot-product contributions sum to the raw cosine similarity.`
      : 'The normalized vectors have no positive trait overlap, so raw cosine similarity is zero.',
    user_facing_display: presentation.matchScore === null
      ? presentation.matchLabel
      : `Your Match ${presentation.matchScore}%`,
  };
});

const richReviewScan = catalog.flatMap((work, index) => {
  const workTraits = uncorrectedEffective[index];
  if (workTraits.coverageLevel !== 'rich') return [];
  const active = new Set(TASTE_TRAITS.filter((trait) => workTraits.traits[trait] > 0));
  const rawLabels = [...new Set(Object.values(workTraits.evidenceByTrait)
    .flatMap((row) => row?.rawLabels ?? []))];
  const normalizedLabels = rawLabels.map((label) => label.toLocaleLowerCase('en-US'));
  const flags: string[] = [];
  if (active.has('science_fiction') && active.has('literary')) flags.push('science_fiction_plus_literary');
  if (active.has('romance') && active.has('thriller_mystery')) flags.push('romance_plus_thriller');
  if (active.has('nonfiction') && ['fantasy', 'science_fiction', 'literary', 'romance', 'thriller_mystery']
    .some((trait) => active.has(trait as keyof TasteVector))) flags.push('nonfiction_plus_fiction_genre');
  if (active.has('nonfiction') && normalizedLabels.some((label) => /\b(children|children's|juvenile)\b/.test(label))) {
    flags.push('children_label_plus_nonfiction');
  }
  if (
    active.has('fantasy') && active.has('science_fiction') &&
    normalizedLabels.some((label) => /science fiction\s*[,/&+]\s*fantasy|fantasy\s*[,/&+]\s*science fiction/.test(label))
  ) flags.push('compound_science_fiction_fantasy_label');
  if (!flags.length) return [];
  return [{
    work_id: String(work.id),
    title: work.title,
    flags,
    active_traits: [...active],
    relevant_raw_labels: rawLabels.filter((label) =>
      /science fiction|fantasy|literary|romance|thriller|non.?fiction|children|juvenile/i.test(label)),
    reviewed_correction: getReviewedWorkTraitCorrection(String(work.id)) ?? null,
  }];
});
const richReviewScanSummary = {
  projected_rich_scanned: uncorrectedEffective.filter(({ coverageLevel }) => coverageLevel === 'rich').length,
  heuristic_candidates_reviewed: richReviewScan.length,
  heuristic_flag_counts: Object.fromEntries([...new Set(richReviewScan.flatMap(({ flags }) => flags))]
    .map((flag) => [flag, richReviewScan.filter(({ flags }) => flags.includes(flag)).length])),
  note: 'Heuristic flags are deliberately not automatic corrections; only entries in reviewedCorrections affect effective vectors.',
};

const report = {
  mode: APPLY ? 'apply' : 'dry_run', cachedOnly: CACHED_ONLY,
  mappingVersion: TASTE_TRAIT_MAPPING_VERSION,
  catalog: catalog.length, seedMatches: seedMatches.filter(Boolean).length,
  existingTableAvailable: existing.available,
  diff: { inserts: diff.inserts.length, updates: diff.updates.length, deletes: diff.deletes.length, unchanged: diff.unchanged },
  projectedSecondRunAfterApply: (() => {
    const second = diffWorkTraitEvidence(desired, desired);
    return { inserts: second.inserts.length, updates: second.updates.length, deletes: second.deletes.length, unchanged: second.unchanged };
  })(),
  external: {
    openLibraryCached: Object.keys(cache.openLibrary).length,
    googleBooksConditionalCandidates: googleCandidates.length,
    googleBooksCached: Object.keys(cache.googleBooks).length,
    googleBooksTemporarilyUnavailable: googleUnavailable,
  },
  coverage: {
    all: coverageSummary(allIndexes, effective), global: coverageSummary(globalIndexes, effective),
    dutchFlemish: coverageSummary(dutchIndexes, effective),
    lumiscoreNative: coverageSummary(nativeIndexes, effective),
  },
  userEvidenceGate: {
    LOW: 'fewer than 5 meaningful Taste Test selections and fewer than 3 meaningful ratings',
    MEDIUM: '5+ meaningful selections, or 7+ answered with 3+ selections, or 3+ meaningful ratings',
    HIGH: '10+ meaningful ratings, or all 10 Taste Test questions with 5+ selections and 5+ meaningful ratings',
  },
  displayPolicy: {
    exactPercentage: 'RICH coverage, metadata confidence >= 0.8, and user confidence MEDIUM or HIGH',
    partial: 'Strong at >= 0.75 raw similarity; Good at >= 0.50; Possible below 0.50',
    eraOnly: 'Early match',
    none: 'no label',
  },
  rankingFormula: '.80 * raw personal cosine similarity + .15 * smoothed quality prior + .05 * deterministic exploration',
  anchorRankingBonus: 0,
  reviewedCorrections: REVIEWED_WORK_TRAIT_CORRECTIONS,
  richReviewScan: richReviewScanSummary,
  displayGateCatalog,
  anomalousBookAudit,
  simulationsBeforeCorrections,
  simulations,
};
await mkdir(dirname(REPORT_PATH), { recursive: true });
await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
console.info(JSON.stringify({ event: 'taste_trait_enrichment_complete', report: REPORT_PATH, ...report }, null, 2));
