import {notFound, redirect} from 'next/navigation';
import {loadCollectionPageData} from '@/lib/supabase/collections';
import {getVerifiedServerUser, loadHeaderAuthState} from '@/lib/supabase/auth';
import {resolveRequestLocale} from '@/lib/i18n/server';
import {localizedHref} from '@/lib/i18n/paths';
import {QUICK_RATING_COLLECTION} from '@/lib/collections/quick-rating';
import {CollectionQuickRating} from '@/app/components/CollectionQuickRating';
import {createLocalizedPageMetadata} from '@/lib/seo/localized-metadata';
import {translate} from '@/lib/i18n/translations';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  const {locale} = await resolveRequestLocale();
  return createLocalizedPageMetadata({title: `${translate(locale, 'quickCollection.entry')} — LumiScore`, canonicalPath: `/collection/${QUICK_RATING_COLLECTION}/rate`, noIndex: true});
}

export default async function CollectionRatingPage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params;
  if (slug !== QUICK_RATING_COLLECTION) notFound();
  const {locale} = await resolveRequestLocale();
  const {user} = await getVerifiedServerUser();
  if (!user) redirect(localizedHref(`/login?next=${encodeURIComponent(localizedHref(`/collection/${slug}/rate`, locale))}`, locale));
  const [data, authState] = await Promise.all([loadCollectionPageData(slug,locale), loadHeaderAuthState()]);
  if (!data) notFound();
  return <CollectionQuickRating key={locale} initial={data} userId={user.id} authState={authState} />;
}
