import assert from 'node:assert/strict';
import test from 'node:test';
import type { ResolvedConfig } from 'vite';
import { publicAssetUrls } from './public-asset-urls.ts';

function configure(original?: ResolvedConfig['experimental']['renderBuiltUrl']) {
  const config = { experimental: { renderBuiltUrl: original } } as ResolvedConfig;
  const hook = publicAssetUrls().configResolved;
  assert.equal(typeof hook, 'function');
  if (typeof hook !== 'function') throw new Error('Expected direct config hook');
  hook.call({} as never, config);
  return config.experimental.renderBuiltUrl!;
}

test('all Ink/Paper responsive public images remain origin-root URLs with deployment ID', () => {
  const render = configure((file) => `/_next/static/${file}?dpl=deployment`);
  for (const theme of ['dark-reading-scene', 'light-book-stack']) {
    for (const width of [1024, 1536]) {
      for (const format of ['avif', 'webp']) {
        const file = `assets/${theme}-${width}.${format}`;
        assert.equal(render(file, { type: 'public', hostType: 'css', hostId: 'app/globals.css', ssr: false }), `/${file}`);
      }
    }
  }
});

test('bundled CSS/JS retain original deployment-ID renderer and context', () => {
  for (const hostType of ['css', 'js', 'html'] as const) {
    const context = { type: 'asset' as const, hostType, hostId: 'entry', ssr: false };
    const render = configure((filename, actual) => {
      assert.equal(actual, context);
      return `/_next/static/${filename}?dpl=deployment`;
    });
    assert.equal(render('chunk.hash.js', context), '/_next/static/chunk.hash.js?dpl=deployment');
  }
});

test('without an existing renderer bundled assets use Vite defaults', () => {
  const render = configure();
  assert.equal(render('chunk.hash.js', { type: 'asset', hostType: 'js', hostId: 'entry', ssr: false }), undefined);
  assert.equal(render('icon.png', { type: 'public', hostType: 'html', hostId: 'entry', ssr: false }), '/icon.png');
});
