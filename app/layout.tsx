import type { Metadata } from 'next';
import Script from 'next/script';
import { ProductAnalysisConsent } from './components/ProductAnalysisConsent';
import { LumiScoreLocaleProvider } from './components/LumiScoreLocale';
import { LUMISCORE_SITE_ORIGIN } from '@/lib/seo/site-origin';
import { resolveRequestLocale, requestPagePath } from '@/lib/i18n/server';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
import { serializeOrganizationJsonLd, serializeWebsiteJsonLd } from '@/lib/seo/site-identity';
import './globals.css';
import { OverviewScrollMemory } from './components/OverviewScrollMemory';
import { ProductMeasurements } from './components/ProductMeasurements';

export async function generateMetadata(): Promise<Metadata> {
  const metadata: Metadata = await createLocalizedPageMetadata({ title: 'LumiScore — Find your next great read', canonicalPath: (await requestPagePath()).split('?')[0] });
  // Every HTML page owns its Metadata API title. The framework owns the
  // unmatched-route title; a root fallback would add a second title there.
  delete metadata.title;
  delete metadata.robots;
  // Pages own their canonicals; the framework fallback represents a missing URL.
  delete metadata.alternates;
  return {
  ...metadata,
  metadataBase: new URL(LUMISCORE_SITE_ORIGIN),
  icons: { icon: '/favicon.ico' },
  };
}

const themeScript = `
  try {
    let saved;
    try { saved = localStorage.getItem('lumiscore-theme'); } catch (_) {}
    const theme = saved === 'paper' || saved === 'ink' ? saved : 'paper';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === 'paper' ? 'light' : 'dark';
    if (['/en', '/nl', '/en/', '/nl/'].includes(location.pathname)) {
      const width = matchMedia('(min-width: 1100px)').matches ? 1536 : 1024;
      const artwork = theme === 'paper' ? 'light-book-stack' : 'dark-reading-scene';
      const preload = document.createElement('link');
      preload.rel = 'preload';
      preload.as = 'image';
      preload.type = 'image/avif';
      preload.fetchPriority = 'high';
      preload.href = '/assets/' + artwork + '-' + width + '.avif';
      document.head.appendChild(preload);
    }
  } catch (_) {}
`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [{ locale, hasPersistedChoice }, initialPath] = await Promise.all([resolveRequestLocale(),requestPagePath()]);
  // Lab control only: identical request scheduling, native existing script.
  const home=false;

  return (
    <html lang={locale} data-theme="paper" suppressHydrationWarning>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeWebsiteJsonLd() }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeOrganizationJsonLd() }} />
        <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/lora-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        {home ? <Script id="lumiscore-theme-bootstrap" strategy="beforeInteractive" dangerouslySetInnerHTML={{__html:themeScript}}/>
          : <script dangerouslySetInnerHTML={{ __html: themeScript }} />}
      </head>
      <body>
        <LumiScoreLocaleProvider
          initialLocale={locale}
          hasPersistedChoice={hasPersistedChoice}
          initialPath={initialPath}
        >
          {children}
          <OverviewScrollMemory />
          <ProductMeasurements />
          <ProductAnalysisConsent />
        </LumiScoreLocaleProvider>
      </body>
    </html>
  );
}
