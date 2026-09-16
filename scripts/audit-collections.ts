import { createClient } from '@supabase/supabase-js';
import { REVIEWED_COLLECTION_SEEDS } from '../lib/collections/seed-data.ts';
import { REVIEWED_SERIES_CATALOG_PLANS } from '../lib/collections/series-catalog-plan.ts';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Supabase public environment is required.');
const client = createClient(url, key);

const plannedWorkIds = [...new Set(REVIEWED_COLLECTION_SEEDS.flatMap((seed) =>
  seed.books.map(({ workId }) => workId)))];
const pages = await Promise.all(Array.from(
  { length: Math.ceil(plannedWorkIds.length / 100) },
  (_, index) => client.from('works')
    .select('id,title,first_publish_year,authors(name)')
    .in('id', plannedWorkIds.slice(index * 100, (index + 1) * 100)),
));
const failed = pages.find(({ error }) => error);
if (failed?.error) throw failed.error;
const catalog = new Map(pages.flatMap(({ data }) => data ?? []).map((work) => [work.id, work]));

const live = await client.from('collections').select(
  'id,slug,name,collection_type,collection_books(work_id,sequence_number,publication_order)',
);
console.log(`Collections source: ${live.error ? 'reviewed migration plan (migration not applied)' : 'live database'}`);
console.log(`Collections: ${REVIEWED_COLLECTION_SEEDS.length}`);

for (const seed of REVIEWED_COLLECTION_SEEDS) {
  const duplicateWorkIds = seed.books
    .map(({ workId }) => workId)
    .filter((workId, index, all) => all.indexOf(workId) !== index);
  const sequenceNumbers = seed.books.flatMap(({ sequenceNumber }) =>
    sequenceNumber === null ? [] : [sequenceNumber]);
  const missingSequence = seed.collectionType === 'series'
    ? Array.from({ length: seed.books.length }, (_, index) => index + 1)
      .filter((number) => !sequenceNumbers.includes(number))
    : [];
  const missingCatalog = seed.books.filter(({ workId }) => !catalog.has(workId));
  const suspicious = seed.books.flatMap(({ workId }) => {
    const work = catalog.get(workId);
    return !work || typeof work.title !== 'string' || !work.title.trim()
      ? [workId]
      : [];
  });

  console.log(`\n${seed.name} (${seed.collectionType})`);
  console.log(`  slug: ${seed.slug}`);
  console.log(`  books: ${seed.books.length}`);
  console.log(`  sequence: ${seed.collectionType === 'series' ? `${sequenceNumbers.length}/${seed.books.length}` : 'not ordered'}`);
  console.log(`  duplicate works: ${duplicateWorkIds.length ? duplicateWorkIds.join(', ') : 'none'}`);
  console.log(`  missing sequence numbers: ${missingSequence.length ? missingSequence.join(', ') : 'none'}`);
  console.log(`  missing catalog works: ${missingCatalog.length ? missingCatalog.map(({ workId }) => workId).join(', ') : 'none'}`);
  console.log(`  suspicious identity: ${suspicious.length ? suspicious.join(', ') : 'none'}`);
  console.log(`  known missing installments: ${seed.knownMissing.length ? seed.knownMissing.join('; ') : 'none'}`);
  console.log('  catalog works:');
  for (const member of seed.books) {
    const work = catalog.get(member.workId);
    const authorValue: unknown = work?.authors;
    const author = typeof authorValue === 'object' && authorValue !== null && 'name' in authorValue
      ? String(authorValue.name)
      : null;
    console.log(`    ${member.workId}: ${work?.title ?? '[missing]'}${author ? ` — ${author}` : ''}`);
  }
}

if (!live.error) {
  console.log(`\nLive rows: ${live.data?.length ?? 0}`);
} else {
  console.log(`\nLive table check: unavailable (${live.error.code ?? 'unknown'}); expected before migration is applied.`);
}

console.log('\nReviewed target series live memberships:');
if (live.error) {
  console.log('  unavailable because the live Collections query failed');
} else {
  for (const series of REVIEWED_SERIES_CATALOG_PLANS) {
    const collection = live.data?.find((row) => row.slug === series.slug);
    const memberships = Array.isArray(collection?.collection_books)
      ? collection.collection_books
      : [];
    const actualSequence = memberships
      .map((membership) => Number(membership.sequence_number))
      .sort((left, right) => left - right);
    const expectedSequence = series.books.map(({ sequenceNumber }) => sequenceNumber);
    const sequenceComplete = actualSequence.length === expectedSequence.length &&
      actualSequence.every((value, index) => value === expectedSequence[index]);

    console.log(
      `  ${series.name}: ${memberships.length}/${series.books.length}; sequence ${sequenceComplete ? 'complete' : 'incomplete'}`,
    );
  }
}
