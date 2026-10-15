// Actual React component rendering with existing synthetic fixtures; no Auth or DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

test('NL/EN detail HTML preserves the accessible cover, account, locale and theme controls without a front caption', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/ux-html-vite',
    plugins: [react()], css: { postcss: { plugins: [] } },
    resolve: { alias: { '@': root, 'next/image': root + 'node_modules/vinext/dist/shims/image.js' }, dedupe: ['react', 'react-dom'] },
    server: { middlewareMode: true, hmr: false },
  });
  try {
    const { DetailPreview } = await vite.ssrLoadModule('/test-support/compact-taste/DetailPreview.tsx');
    const { LumiScoreLocaleProvider } = await vite.ssrLoadModule('/app/components/LumiScoreLocale.tsx');
    for (const locale of ['nl', 'en']) {
      const html = renderToStaticMarkup(createElement(LumiScoreLocaleProvider,
        { initialLocale: locale, hasPersistedChoice: true, initialPath: '/book/991001' }, createElement(DetailPreview)));
      assert.doesNotMatch(html, /<figcaption/);
      assert.match(html, /role="img" aria-label="[^"]*De uitzonderlijk lange geschiedenis/);
      assert.match(html, /score-badge detail-score-badge/);
      assert.match(html, new RegExp(`href="/${locale}/taste-test"`));
      assert.match(html, /class="mobile-navigation-trigger"[^>]*aria-expanded="false"/);
      assert.match(html, /href="\/nl\/book\/991001"/);
      assert.match(html, /href="\/en\/book\/991001"/);
      assert.match(html, /class="theme-toggle theme-toggle-labeled"/);
      assert.match(html, /class="detail-sign-in"/);
    }
  } finally { await vite.close(); }
});
