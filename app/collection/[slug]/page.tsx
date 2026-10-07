import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { LumiScoreCollectionPage } from '@/app/components/LumiScoreCollectionPage';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
import { measureServerOperation } from '@/lib/performance/server-timing';
import { resolveRequestLocale } from '@/lib/i18n/server';

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
  const { locale } = await resolveRequestLocale();
  if (!data) return createLocalizedPageMetadata({ title: 'Collection not found — LumiScore', canonicalPath: `/collection/${encodeURIComponent(slug)}`, noIndex: true });
  return createLocalizedPageMetadata({
    title: `${data.collection.name} — LumiScore`,
    description: locale === 'nl' ? `Ontdek de boeken van ${data.collection.name} en houd je leesvoortgang bij.` : data.collection.description ?? `Track your progress through ${data.collection.name}.`,
    canonicalPath: `/collection/${data.collection.slug}`,
  });
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { locale } = await resolveRequestLocale();
  return (
    <>
      <LumiScoreCollectionPage data={locale === 'nl' ? { ...data, collection: { ...data.collection, description: `Ontdek de boeken van ${data.collection.name} en houd je leesvoortgang bij.` } } : data} />
    </>
  );
}
