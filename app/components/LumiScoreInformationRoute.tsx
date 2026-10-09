import type { Metadata } from 'next';
import { LumiScoreInformationPage } from './LumiScoreInformationPage';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
import { resolveRequestLocale } from '@/lib/i18n/server';
import {
  getInformationPageContent,
  serializeInformationPageJsonLd,
  type InformationPageKey,
} from '@/lib/information/pages';

export async function generateInformationPageMetadata(
  key: InformationPageKey,
): Promise<Metadata> {
  const { locale } = await resolveRequestLocale();
  const content = getInformationPageContent(key, locale);

  return createLocalizedPageMetadata({
    title: content.seoTitle,
    description: content.seoDescription,
    canonicalPath: content.path,
  });
}

export async function LumiScoreInformationRoute({
  pageKey,
}: {
  pageKey: InformationPageKey;
}) {
  const [{ locale }, authState] = await Promise.all([
    resolveRequestLocale(),
    import('@/lib/supabase/auth')
      .then(({ loadHeaderAuthState }) => loadHeaderAuthState())
      .catch(() => ({ authenticated: false })),
  ]);
  const content = getInformationPageContent(pageKey, locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeInformationPageJsonLd(content),
        }}
      />
      <LumiScoreInformationPage content={content} authState={authState} />
    </>
  );
}
