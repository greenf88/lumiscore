import { notFound } from 'next/navigation';
import { DiscoveryPageShell } from '@/app/components/DiscoveryPageShell';
import { EditorialTopList } from '@/app/components/EditorialTopList';
import { getEditorialTopList, getEditorialWorkSourceId } from '@/lib/catalog/top-lists';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
import { loadCatalogBooksBySourceIds } from '@/lib/supabase/books';
import { deferEditionCoverEvidence } from '@/lib/books/edition-cover-evidence';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const list = getEditorialTopList((await params).slug);
  if (!list) notFound();
  const { locale } = await resolveRequestLocale();
  return createLocalizedPageMetadata({ title: list.title[locale]+' — LumiScore', description: list.description[locale], canonicalPath: '/toplijsten/'+list.slug });
}
export default async function TopListPage({ params }: Props) {
  const list = getEditorialTopList((await params).slug);
  if (!list) notFound();
  const { locale } = await resolveRequestLocale();
  const [authState, catalog] = await Promise.all([
    import('@/lib/supabase/auth').then(m=>m.loadHeaderAuthState()).catch(()=>({authenticated:false})),
    loadCatalogBooksBySourceIds(list.workIds.map(getEditorialWorkSourceId), locale)
      .then(books => ({books:deferEditionCoverEvidence(books),unavailable:false}))
      .catch(()=>({books:[],unavailable:true})),
  ]);
  return <DiscoveryPageShell path={'/toplijsten/'+list.slug} authState={authState}><EditorialTopList list={list} books={catalog.books} unavailable={catalog.unavailable} authenticated={authState.authenticated} /></DiscoveryPageShell>;
}
