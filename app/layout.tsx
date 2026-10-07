import type { Metadata } from 'next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { LumiScoreLocaleProvider } from './components/LumiScoreLocale';
import { LUMISCORE_DEFAULT_DESCRIPTION } from '@/lib/seo/page-metadata';
import { LUMISCORE_SITE_ORIGIN } from '@/lib/seo/site-origin';
import { resolveRequestLocale } from '@/lib/i18n/server';
import './globals.css';
import { OverviewScrollMemory } from './components/OverviewScrollMemory';

export const metadata: Metadata = {
  metadataBase: new URL(LUMISCORE_SITE_ORIGIN),
  title: 'LumiScore — Find your next great read',
  description: LUMISCORE_DEFAULT_DESCRIPTION,
  // Relative to the request pathname, including framework not-found boundaries.
  // Successful pages override this with their explicit canonical policy.
  alternates: { canonical: './' },
  icons: { icon: '/favicon.ico' },
};

const themeScript = `
  try {
    let saved;
    try { saved = localStorage.getItem('lumiscore-theme'); } catch (_) {}
    const theme = saved === 'paper' || saved === 'ink' ? saved : (matchMedia('(prefers-color-scheme: light)').matches ? 'paper' : 'ink');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === 'paper' ? 'light' : 'dark';
    if (location.pathname === '/') {
      const width = matchMedia('(min-width: 1100px), (min-resolution: 1.5dppx)').matches ? 1536 : 1024;
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
  const { locale, hasPersistedChoice } = await resolveRequestLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/lora-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <LumiScoreLocaleProvider
          initialLocale={locale}
          hasPersistedChoice={hasPersistedChoice}
        >
          {children}
          <OverviewScrollMemory />
        </LumiScoreLocaleProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
