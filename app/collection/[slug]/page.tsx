import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { LumiScoreCollectionPage } from '@/app/components/LumiScoreCollectionPage';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
import { measureServerOperation } from '@/lib/performance/server-timing';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { getLandingGuide } from '@/lib/editorial/landing-guides';
import { catalogBreadcrumbs } from '@/lib/seo/breadcrumbs';
import { collectionMetadataDescription, collectionMetadataTitle } from '@/lib/seo/collection-metadata';
import { collectionPageJsonLd } from '@/lib/seo/collection-json-ld';
import { breadcrumbJsonLd } from '@/lib/seo/breadcrumb-json-ld';

type CollectionPageProps = { params: Promise<{ slug: string }> };

export const dynamic = 'force-dynamic';

const load = cache(async (slug: string,locale:'nl'|'en') => {
  // The loader returns null for a missing collection and throws on data errors.
  // Do not turn a temporary backend failure into a crawler-visible 404.
  const { loadCollectionPageData } = await import('@/lib/supabase/collections');
  return measureServerOperation(
    'collection.page',
    'mixed',
    () => loadCollectionPageData(slug,locale,true),
  );
});

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { locale } = await resolveRequestLocale();
  const data = await load(slug,locale);
  if (!data) notFound();
  const guide = getLandingGuide('/collection/' + data.collection.slug, locale);
  return createLocalizedPageMetadata({
    title: guide?.seo_title ?? collectionMetadataTitle(data.collection, locale),
    description: guide?.meta_description ?? collectionMetadataDescription(data.collection, locale),
    canonicalPath: `/collection/${data.collection.slug}`,
    ...(guide ? {image:'/images/editorial/suzanne-vermeer-nl.png'} : {}),
  });
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  const { locale } = await resolveRequestLocale();
  const data = await load(slug,locale);
  if (!data) notFound();
  const guide = getLandingGuide('/collection/' + data.collection.slug, locale);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(breadcrumbJsonLd(catalogBreadcrumbs('collection', guide?.h1 ?? data.collection.name, `/collection/${data.collection.slug}`, locale),locale)).replaceAll('<','\\u003c')}}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(collectionPageJsonLd(data.collection, data.books, locale, guide?.h1)).replaceAll('<','\\u003c')}}/>
      <LumiScoreCollectionPage data={locale === 'nl' ? { ...data, collection: { ...data.collection, description: `Ontdek de boeken van ${data.collection.name} en houd je leesvoortgang bij.` } } : data} />
    </>
  );
}
