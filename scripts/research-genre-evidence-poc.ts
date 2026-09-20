import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

type WorkRow = {
  id: number; title: string; first_publish_year: number | null; open_library_id: string | null; source_type: string | null;
  authors: { name?: string } | Array<{ name?: string }> | null;
  editions: Array<{ isbn_13?: string | null; language?: string | null }> | null;
};
type EvidenceRow = { work_id: number; trait: string; source: string; source_key: string; raw_labels: string[] | null; confidence: number | string };

const outputPath = resolve('research', 'genre-evidence', 'genre-evidence-poc-200.json');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Missing public Supabase environment.');
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function allRows<T>(table: string, select: string): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await client.from(table).select(select).order(table === 'works' ? 'id' : 'work_id').range(start, start + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if ((data?.length ?? 0) < 1000) return rows;
  }
}

function author(work: WorkRow): string {
  const value = Array.isArray(work.authors) ? work.authors[0] : work.authors;
  return value?.name?.trim() || 'Unknown author';
}
function isbn13(work: WorkRow): string | null {
  return (work.editions ?? []).map(({ isbn_13 }) => isbn_13?.replace(/[^0-9X]/gi, '') ?? '').find((value) => /^97[89]\d{10}$/.test(value)) ?? null;
}
function isDutch(work: WorkRow): boolean { return (work.editions ?? []).some(({ language }) => /^(nl|nld|dut)/i.test(language ?? '')); }
function rawLabels(rows: EvidenceRow[]): string[] { return [...new Set(rows.flatMap(({ raw_labels }) => raw_labels ?? []))].sort(); }
function chooseCategory(rows: EvidenceRow[]): string | null {
  const traits = new Set(rows.filter(({ source }) => source !== 'publication_year').map(({ trait }) => trait));
  if (traits.has('thriller_mystery')) return 'Thrillers & mystery';
  if (traits.has('romance')) return 'Romance';
  if (traits.has('fantasy')) return 'Fantasy';
  if (traits.has('science_fiction') || traits.has('speculative')) return 'Science fiction & speculative';
  if (traits.has('literary') || traits.has('classic') || traits.has('contemporary')) return 'Literary & general fiction';
  if (traits.has('nonfiction')) return 'History, society & current affairs';
  return null;
}

async function queryWikidata(isbns: readonly string[]) {
  const map = new Map<string, { item: string; genres: string[]; subjects: string[] }>();
  const stats = { attemptedBatches: 0, successfulBatches: 0, failedOrTimedOutBatches: 0 };
  for (let offset = 0; offset < isbns.length; offset += 60) {
    stats.attemptedBatches += 1;
    const values = isbns.slice(offset, offset + 60).map((isbn) => `"${isbn}"`).join(' ');
    const query = `SELECT ?isbn ?item ?genreLabel ?subjectLabel WHERE { VALUES ?isbn { ${values} } ?item wdt:P212 ?isbn. OPTIONAL { ?item wdt:P136 ?genre. ?genre rdfs:label ?genreLabel. FILTER(LANG(?genreLabel) IN ("en", "nl")) } OPTIONAL { ?item wdt:P921 ?subject. ?subject rdfs:label ?subjectLabel. FILTER(LANG(?subjectLabel) IN ("en", "nl")) } }`;
    let response: Response;
    try {
      response = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`, {
        headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'LumiScoreGenreResearch/1.0 (https://lumisco.re)' },
        signal: AbortSignal.timeout(15_000),
      });
    } catch { stats.failedOrTimedOutBatches += 1; continue; }
    if (!response.ok) { stats.failedOrTimedOutBatches += 1; continue; }
    stats.successfulBatches += 1;
    const payload = await response.json() as { results?: { bindings?: Array<Record<string, { value: string }>> } };
    for (const binding of payload.results?.bindings ?? []) {
      const isbn = binding.isbn?.value;
      if (!isbn) continue;
      const current = map.get(isbn) ?? { item: binding.item?.value ?? '', genres: [], subjects: [] };
      if (binding.genreLabel?.value) current.genres.push(binding.genreLabel.value);
      if (binding.subjectLabel?.value) current.subjects.push(binding.subjectLabel.value);
      current.genres = [...new Set(current.genres)].sort(); current.subjects = [...new Set(current.subjects)].sort();
      map.set(isbn, current);
    }
  }
  return { map, stats };
}

const [works, evidence] = await Promise.all([
  allRows<WorkRow>('works', 'id,title,first_publish_year,open_library_id,source_type,authors(name),editions(isbn_13,language)'),
  allRows<EvidenceRow>('work_trait_evidence', 'work_id,trait,source,source_key,raw_labels,confidence'),
]);
const evidenceByWork = new Map<number, EvidenceRow[]>();
for (const row of evidence) evidenceByWork.set(row.work_id, [...(evidenceByWork.get(row.work_id) ?? []), row]);
const selected: WorkRow[] = [];
const selectedIds = new Set<number>();
const stratumById = new Map<number, string>();
const add = (items: WorkRow[], count: number, stratum: string) => {
  for (const item of items.sort((a, b) => a.id - b.id)) {
    if (selected.length >= 200 || selectedIds.has(item.id) || count-- <= 0) continue;
    selected.push(item); selectedIds.add(item.id); stratumById.set(item.id, stratum);
  }
};
const rowsFor = (work: WorkRow) => evidenceByWork.get(work.id) ?? [];
add(works.filter((work) => author(work).toLowerCase().includes('suzanne vermeer')), 20, 'suzanne_vermeer');
add(works.filter((work) => isDutch(work)), 35, 'dutch_fiction_or_market');
add(works.filter((work) => rowsFor(work).some(({ source }) => source === 'google_books')), 10, 'exact_isbn_google_books');
add(works.filter((work) => (work.first_publish_year ?? 9999) < 1950), 25, 'classic');
add(works.filter((work) => rowsFor(work).some(({ trait }) => trait === 'nonfiction')), 25, 'nonfiction');
add(works.filter((work) => rawLabels(rowsFor(work)).some((label) => /young adult|juvenile|children|teen/i.test(label))), 20, 'young_adult_or_children');
add(works.filter((work) => rawLabels(rowsFor(work)).some((label) => /,|science fiction, fantasy|general/i.test(label))), 20, 'polluted_or_conflicting_subjects');
add(works.filter((work) => rowsFor(work).every(({ source }) => source === 'publication_year')), 25, 'legacy_genre_gap');
add(works, 200, 'international_fiction');
if (selected.length !== 200) throw new Error(`Expected 200 sampled works, received ${selected.length}.`);

const wikidataResult = await queryWikidata(selected.map(isbn13).filter((value): value is string => Boolean(value)));
const wikidata = wikidataResult.map;
const sample = selected.map((work) => {
  const rows = rowsFor(work);
  const contentRows = rows.filter(({ source }) => source !== 'publication_year');
  const sources = [...new Set(contentRows.map(({ source }) => source))];
  const isbn = isbn13(work);
  const wiki = isbn ? wikidata.get(isbn) : undefined;
  const category = chooseCategory(contentRows);
  const agreeingSources = sources.length + (wiki?.genres.length || wiki?.subjects.length ? 1 : 0);
  const decision = category && agreeingSources >= 2 ? 'HIGH' : category ? 'REVIEW' : 'REJECT';
  return {
    workId: work.id, title: work.title, author: author(work), isbn13: isbn,
    stratum: stratumById.get(work.id),
    currentLegacyCategory: null,
    openLibrary: { workId: work.open_library_id, subjects: rawLabels(contentRows.filter(({ source }) => source === 'open_library')) },
    publisherOnixThema: { available: false, reason: 'No licensed ONIX/Thema feed is connected.' },
    googleBooks: { exactIsbnRequired: true, categories: rawLabels(contentRows.filter(({ source }) => source === 'google_books')), sourceKeys: contentRows.filter(({ source }) => source === 'google_books').map(({ source_key }) => source_key) },
    wikidata: wiki ?? null,
    officialPublisher: { checked: false, reason: 'No reproducible licensed bulk publisher source was available for this POC.' },
    proposedLumiScoreCategory: category,
    confidence: decision === 'HIGH' ? 0.9 : decision === 'REVIEW' ? 0.65 : 0,
    outcome: decision,
    conflictReason: decision === 'HIGH' ? null : category ? 'Only one usable content source or no corroborating exact-ID source.' : 'No trustworthy genre/content evidence in the currently connected sources.',
    requiresManualReview: decision !== 'HIGH',
    acceptedForProduction: false,
  };
});
const counts = Object.fromEntries(['HIGH', 'REVIEW', 'REJECT'].map((outcome) => [outcome, sample.filter((row) => row.outcome === outcome).length]));
await mkdir(resolve('research', 'genre-evidence'), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(), productionWrites: false, sampleSize: sample.length,
  selection: 'deterministic stratified current catalog sample; one batched catalog/evidence read plus bounded exact-ISBN Wikidata queries',
  counts, wikidataQuery: wikidataResult.stats, rows: sample,
}, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, counts, sampleSize: sample.length }));
