import type { Metadata } from 'next';
import { cache } from 'react';
import { LumiScoreCollectionsPage } from '@/app/components/LumiScoreCollectionsPage';
import { createPageMetadata } from '@/lib/seo/page-metadata';
import { normalizeCollectionDirectoryFilter } from '@/lib/collections/directory';
import type { CollectionsDirectoryData } from '@/lib/supabase/collections';

type CollectionsPageProps = {
  searchParams: Promise<{ type?: string | string[] }>;
};

export const dynamic = 'force-dynamic';

const load = cache(async (): Promise<CollectionsDirectoryData & { available: boolean }> => {
  try {
    const { loadCollectionsDirectory } = await import('@/lib/supabase/collections');
    return { ...(await loadCollectionsDirectory()), available: true };
  } catch (error) {
    console.error('Collections directory load failed.', error);
    return { collections: [], total: 0, available: false };
  }
});

async function readFilter(searchParams: CollectionsPageProps['searchParams']) {
  const { type } = await searchParams;
  return normalizeCollectionDirectoryFilter(type);
}

export async function generateMetadata({
  searchParams,
}: CollectionsPageProps): Promise<Metadata> {
  const filter = await readFilter(searchParams);
  return createPageMetadata({
    title: 'Browse collections — LumiScore',
    description: 'Explore series, universes and author collections on LumiScore.',
    canonicalPath: '/collections',
    noIndex: filter !== 'all',
  });
}

export default async function CollectionsPage({ searchParams }: CollectionsPageProps) {
  const [filter, data, authState] = await Promise.all([
    readFilter(searchParams),
    load(),
    import('@/lib/supabase/auth')
      .then(({ loadHeaderAuthState }) => loadHeaderAuthState())
      .catch(() => ({ authenticated: false })),
  ]);

  return (
    <>
      <LumiScoreCollectionsPage
        data={data}
        filter={filter}
        authState={authState}
      />
    </>
  );
}
