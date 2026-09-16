import type { Metadata } from 'next';
import { LumiScoreLocaleProvider } from './components/LumiScoreLocale';
import {
  LUMISCORE_DEFAULT_DESCRIPTION,
  LUMISCORE_PRODUCTION_ORIGIN,
} from './components/LumiScoreMetadata';
import { resolveRequestLocale } from '@/lib/i18n/server';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(LUMISCORE_PRODUCTION_ORIGIN),
  title: 'LumiScore — Find your next great read',
  description: LUMISCORE_DEFAULT_DESCRIPTION,
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'LumiScore — Find your next great read',
    description: 'Smart book recommendations, trusted reader ratings, and matches made for your taste.',
    url: '/',
    siteName: 'LumiScore',
    type: 'website',
    images: [{ url: '/og.png', width: 1664, height: 936, alt: 'LumiScore — Find your next great read' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LumiScore — Find your next great read',
    description: 'Smart book recommendations, trusted reader ratings, and matches made for your taste.',
    images: ['/og.png'],
  },
};

const themeScript = `
  try {
    const saved = localStorage.getItem('lumiscore-theme');
    const theme = saved || (matchMedia('(prefers-color-scheme: light)').matches ? 'paper' : 'ink');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === 'paper' ? 'light' : 'dark';
  } catch (_) {}
`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { locale, hasPersistedChoice } = await resolveRequestLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <LumiScoreLocaleProvider
          initialLocale={locale}
          hasPersistedChoice={hasPersistedChoice}
        >
          {children}
        </LumiScoreLocaleProvider>
      </body>
    </html>
  );
}
