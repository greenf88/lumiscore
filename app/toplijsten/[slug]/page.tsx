import { notFound } from 'next/navigation';
import { DiscoveryPageShell } from '@/app/components/DiscoveryPageShell';
import { EditorialTopList } from '@/app/components/EditorialTopList';
import { getEditorialTopList } from '@/lib/catalog/top-lists';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { createPageMetadata } from '@/lib/seo/page-metadata';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const list = getEditorialTopList((await params).slug);
  if (!list) notFound();
  const { locale } = await resolveRequestLocale();
  return createPageMetadata({ title: list.title[locale]+' — LumiScore', description: list.description[locale], canonicalPath: '/toplijsten/'+list.slug });
}
export default async function TopListPage({ params }: Props) {
  const list = getEditorialTopList((await params).slug);
  if (!list) notFound();
  const authState = await import('@/lib/supabase/auth').then(m=>m.loadHeaderAuthState()).catch(()=>({authenticated:false}));
  return <DiscoveryPageShell path={'/toplijsten/'+list.slug} authState={authState}><EditorialTopList list={list} /></DiscoveryPageShell>;
}
