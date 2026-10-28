import { notFound } from 'next/navigation';
import { DiscoveryPageShell } from '@/app/components/DiscoveryPageShell';
import { EditorialTopList } from '@/app/components/EditorialTopList';
import { editorialTopLists, getEditorialTopList, getEditorialTopBook, getEditorialWorkSourceId, topListBookHref } from '@/lib/catalog/top-lists';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
import { loadCatalogBooksBySourceIds } from '@/lib/supabase/books';
import { deferEditionCoverEvidence } from '@/lib/books/edition-cover-evidence';
import { editorialPageJsonLd } from '@/lib/seo/editorial';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const list = getEditorialTopList((await params).slug);
  if (!list) notFound();
  const { locale } = await resolveRequestLocale();
  return createLocalizedPageMetadata({ title: list.title[locale]+' — LumiScore', description: list.description[locale], canonicalPath: '/toplijsten/'+list.slug, image: list.shareImage?.replace('.png', '-'+locale+'.png') });
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
  const orderedBooks = list.workIds.flatMap(id => catalog.books.filter(book => book.openLibraryWorkId === getEditorialWorkSourceId(id)));
  const selections = Object.fromEntries(list.workIds.map(id => {
    const choice = getEditorialTopBook(id);
    const sourceId = getEditorialWorkSourceId(id);
    const book = orderedBooks.find(book => book.openLibraryWorkId === sourceId);
    return [id, {sourceId,source:choice.source,basis:choice.basis,note:choice.note,href:book?.workId ? topListBookHref(book.workId,list.slug) : null}];
  }));
  const relatedLists = editorialTopLists.filter(other => list.related?.includes(other.slug)).map(({slug,title})=>({slug,title}));
  return <DiscoveryPageShell path={'/toplijsten/'+list.slug} authState={authState}><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(editorialPageJsonLd(list, orderedBooks, locale)).replaceAll('<','\\u003c')}} /><EditorialTopList list={list} books={catalog.books} selections={selections} relatedLists={relatedLists} unavailable={catalog.unavailable} authenticated={authState.authenticated} /></DiscoveryPageShell>;
}
