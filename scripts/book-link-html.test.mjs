import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

test('server-rendered book cards expose canonical links and retain an accessible no-JS back link', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/book-link-html', plugins: [react()],
    css: { postcss: { plugins: [] } },
    resolve: { alias: { '@': root, 'next/image': root + 'node_modules/vinext/dist/shims/image.js' }, dedupe: ['react', 'react-dom'] },
    server: { middlewareMode: true, hmr: false },
  });
  try {
    const { LumiScoreLocaleProvider: Provider, LocaleLink, LanguageSwitcher } = await vite.ssrLoadModule('/app/components/LumiScoreLocale.tsx');
    const { BookCard } = await vite.ssrLoadModule('/app/components/LumiScoreHome.tsx');
    const { BookBackLink } = await vite.ssrLoadModule('/app/components/BookBackLink.tsx');
    const book = { id: 'work-8', workId: '8', source: 'supabase', title: 'Synthetic book', author: 'Synthetic author', cover: 'orbit', coverUrls: [], score: null, ratingsCount: null, match: null };
    for (const locale of ['nl', 'en']) {
      const render = node => renderToStaticMarkup(h(Provider, { initialLocale: locale, hasPersistedChoice: true, initialPath: '/browse' }, node));
      for (const context of [
        { kind: 'home' }, { kind: 'browse', path: '/browse?page=2&pageSize=64' },
        { kind: 'search', path: '/search?q=synthetic&page=2' }, { kind: 'collection', slug: 'dune' },
      ]) {
        const html = render(h(BookCard, { book, detailReturnContext: context, resolveMissingCover: false }));
        assert.match(html, new RegExp(`href="/${locale}/book/8"`));
        assert.doesNotMatch(html, /returnTo|lumiscore-book-return/);
      }
      const editorial = render(h(LocaleLink, { href: '/book/8?returnTo=%2Ftoplijsten%2Ffantasy-sciencefiction' }, 'Synthetic book'));
      assert.match(editorial, new RegExp(`href="/${locale}/book/8"`));
      assert.doesNotMatch(editorial, /returnTo/);
      const switcher = render(h(LanguageSwitcher, { hrefForLocale: option => `/${option}/book/8?returnTo=%2Fbrowse%3Fpage%3D2` }));
      assert.match(switcher, /href="\/nl\/book\/8"/);
      assert.match(switcher, /href="\/en\/book\/8"/);
      assert.doesNotMatch(switcher, /returnTo/);
      const back = render(h(BookBackLink, { returnNavigation: { kind: 'browse', href: '/browse' } }));
      assert.match(back, new RegExp(`class="detail-back-link" href="/${locale}/browse"`));
      assert.match(back, locale === 'nl' ? /Terug naar boeken/ : /Back to books/);
    }
  } finally { await vite.close(); }
});
