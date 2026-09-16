import { createClient } from '@supabase/supabase-js';
import { REVIEWED_COLLECTION_SEEDS } from '../lib/collections/seed-data.ts';

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

console.log('\nReviewed candidate gaps (not seeded as ordered series):');
for (const gap of [
  'Harry Potter — present: 93 (book 1), 168 (book 3); missing books 2 and 4–7',
  'The Hunger Games — present: 102 (book 1), 183 (book 3), 194 and 278 (prequels); missing Catching Fire',
  'The Expanse — present: 164 (book 9); missing books 1–8',
  'Millennium — present: 48 (book 1), 567 (book 2); missing book 3',
  'Percy Jackson and the Olympians — present: 134 (book 1); missing books 2–5',
  'The Witcher — present: 165 (Blood of Elves); other main installments missing',
  'Bridgerton — no confidently matched works in the current catalog',
]) console.log(`  ${gap}`);
