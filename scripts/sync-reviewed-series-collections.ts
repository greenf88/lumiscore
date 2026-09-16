import { createClient } from '@supabase/supabase-js';
import { REVIEWED_SERIES_CATALOG_PLANS } from '../lib/collections/series-catalog-plan.ts';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const apply = process.env.SERIES_COLLECTION_APPLY === 'true';
if (!url || !publicKey) throw new Error('Supabase public environment is required.');
if (apply && !secretKey) throw new Error('A server-side Supabase secret is required to apply collection updates.');

const client = createClient(url, apply ? secretKey! : publicKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const workIds = REVIEWED_SERIES_CATALOG_PLANS.flatMap((series) =>
  series.books.map(({ openLibraryWorkId }) => openLibraryWorkId),
);
const variants = [...new Set(workIds.flatMap((workId) => [workId, `/works/${workId}`]))];
const { data: works, error: worksError } = await client.from('works')
  .select('id,title,open_library_id')
  .in('open_library_id', variants);
if (worksError) throw worksError;
const catalogByOpenLibraryId = new Map((works ?? []).flatMap((work) => {
  const openLibraryWorkId = String(work.open_library_id ?? '').split('/').filter(Boolean).at(-1)?.toUpperCase();
  return openLibraryWorkId ? [[openLibraryWorkId, work] as const] : [];
}));

const missing = workIds.filter((workId) => !catalogByOpenLibraryId.has(workId));
console.log(`Mode: ${apply ? 'APPLY' : 'READ-ONLY PREFLIGHT'}`);
console.log(`Reviewed series: ${REVIEWED_SERIES_CATALOG_PLANS.length}`);
console.log(`Required works present: ${workIds.length - missing.length}/${workIds.length}`);
if (missing.length > 0) {
  console.log(`Missing Open Library works: ${missing.join(', ')}`);
  if (apply) throw new Error('Refusing to update Collections until every reviewed series work is present.');
}

for (const series of REVIEWED_SERIES_CATALOG_PLANS) {
  const members = series.books.flatMap((book) => {
    const work = catalogByOpenLibraryId.get(book.openLibraryWorkId);
    return work ? [{ workId: Number(work.id), title: String(work.title), sequenceNumber: book.sequenceNumber }] : [];
  });
  console.log(`${series.name}: ${members.length}/${series.books.length} ready`);
  for (const member of members) console.log(`  ${member.sequenceNumber}. ${member.title} (work ${member.workId})`);
  if (!apply) continue;

  const { data: collection, error: collectionError } = await client.from('collections').upsert({
    slug: series.slug,
    name: series.name,
    collection_type: 'series',
    description: series.description,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'slug' }).select('id').single();
  if (collectionError) throw collectionError;

  const collectionId = Number(collection.id);
  const { error: membershipError } = await client.from('collection_books').upsert(
    members.map((member) => ({
      collection_id: collectionId,
      work_id: member.workId,
      sequence_number: member.sequenceNumber,
      publication_order: member.sequenceNumber,
      subgroup: null,
    })),
    { onConflict: 'collection_id,work_id' },
  );
  if (membershipError) throw membershipError;

  const expectedIds = members.map(({ workId }) => workId);
  const { error: cleanupError } = await client.from('collection_books')
    .delete()
    .eq('collection_id', collectionId)
    .not('work_id', 'in', `(${expectedIds.join(',')})`);
  if (cleanupError) throw cleanupError;
}

console.log(apply
  ? 'Reviewed series collections synchronized. User reading statuses were not changed.'
  : 'Preflight only. Set SERIES_COLLECTION_APPLY=true after the reviewed import has completed.');
