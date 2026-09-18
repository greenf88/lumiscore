import type { Metadata } from 'next';
import { LumiScoreInformationPage } from './LumiScoreInformationPage';
import {
  LUMISCORE_DEFAULT_IMAGE,
  LumiScoreMetadata,
} from './LumiScoreMetadata';
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

  return {
    title: content.seoTitle,
    description: content.seoDescription,
    alternates: { canonical: content.path },
    openGraph: {
      title: content.seoTitle,
      description: content.seoDescription,
      url: content.path,
      siteName: 'LumiScore',
      type: 'website',
      images: [{
        url: LUMISCORE_DEFAULT_IMAGE,
        width: 1664,
        height: 936,
        alt: content.title,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: content.seoTitle,
      description: content.seoDescription,
      images: [LUMISCORE_DEFAULT_IMAGE],
    },
    robots: { index: true, follow: true },
  };
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
      <LumiScoreMetadata
        title={content.seoTitle}
        description={content.seoDescription}
        canonicalPath={content.path}
      />
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
