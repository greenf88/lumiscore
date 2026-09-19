import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { LumiScoreCollectionPage } from '@/app/components/LumiScoreCollectionPage';
import { LumiScoreMetadata } from '@/app/components/LumiScoreMetadata';
import { measureServerOperation } from '@/lib/performance/server-timing';

type CollectionPageProps = { params: Promise<{ slug: string }> };

export const dynamic = 'force-dynamic';

const load = cache(async (slug: string) => {
  try {
    const { loadCollectionPageData } = await import('@/lib/supabase/collections');
    return await measureServerOperation(
      'collection.page',
      'mixed',
      () => loadCollectionPageData(slug),
    );
  } catch (error) {
    console.error('Collection page load failed.', error);
    return null;
  }
});

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: 'Collection not found — LumiScore', robots: { index: false } };
  return {
    title: `${data.collection.name} — LumiScore`,
    description: data.collection.description ?? `Track your progress through ${data.collection.name}.`,
    alternates: { canonical: `/collection/${data.collection.slug}` },
  };
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  return (
    <>
      <LumiScoreMetadata
        title={`${data.collection.name} — LumiScore`}
        description={data.collection.description ?? `Track your progress through ${data.collection.name}.`}
        canonicalPath={`/collection/${data.collection.slug}`}
      />
      <LumiScoreCollectionPage data={data} />
    </>
  );
}
