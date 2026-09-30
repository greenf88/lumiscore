import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { renderMetadataToHtml } from 'vinext/shims/metadata';
import { browseHasQuery, createPageMetadata } from './page-metadata.ts';
import { inspectServerHtml } from './server-html.ts';

test('Vinext renders one robots, canonical and social value from the shared helper', () => {
  for (const noIndex of [false, true]) {
    const metadata = createPageMetadata({ title: 'A book by An author | LumiScore', canonicalPath: '/book/1', noIndex, type: 'article', image: 'https://example.org/cover.jpg' });
    const html = renderMetadataToHtml(metadata);
    const tags = inspectServerHtml(html);
    assert.deepEqual(tags.robots, [noIndex ? 'noindex, follow' : 'index, follow']);
    assert.deepEqual(tags.canonical, ['https://lumisco.re/book/1']);
    assert.deepEqual(tags.duplicates, []);
    assert.deepEqual(tags.metadata['og:type'], ['article']);
    assert.deepEqual(tags.metadata['og:url'], tags.canonical);
    assert.deepEqual(tags.metadata['twitter:image'], ['https://example.org/cover.jpg']);
  }
});

test('only genuinely parameter-free Browse is indexable', () => {
  assert.equal(browseHasQuery({}), false);
  for (const query of ['page=1', 'page=2', 'pageSize=32', 'pageSize=invalid', 'sort=az', 'genre=fantasy', 'language=nl', 'filter=classic', 'page=1&page=2', 'utm_source=test', 'unknown=', 'sort=']) {
    const values: Record<string, string[]> = {};
    for (const [key, value] of new URLSearchParams(query)) (values[key] ??= []).push(value);
    assert.equal(browseHasQuery(values), true, query);
    const tags = inspectServerHtml(renderMetadataToHtml(createPageMetadata({ title: 'Browse', canonicalPath: '/browse', noIndex: browseHasQuery(values) })));
    assert.deepEqual(tags.robots, ['noindex, follow']);
    assert.deepEqual(tags.canonical, ['https://lumisco.re/browse']);
  }
});

test('the HTML inspector ignores comments and serialized RSC/script metadata', () => {
  const html = '<head><meta name="robots" content="index, follow"><link rel="canonical" href="https://lumisco.re/"></head>';
  assert.deepEqual(inspectServerHtml(`${html}<script>const x=\'<meta name="robots" content="noindex">\'</script><!--<meta name="robots" content="noindex">-->`).robots, ['index, follow']);
  assert.deepEqual(inspectServerHtml(`${html}<meta name="robots" content="noindex">`).robots, ['index, follow', 'noindex']);
});

test('missing covers do not silently inherit the homepage social image', () => {
  const tags = inspectServerHtml(renderMetadataToHtml(createPageMetadata({title:'Book', canonicalPath:'/book/1',image:null})));
  assert.equal(tags.metadata['og:image'], undefined);
  assert.equal(tags.metadata['twitter:image'], undefined);
});

test('no route can bring back the manual metadata workaround', async () => {
  const root = new URL('../../app/', import.meta.url);
  for (const path of await readdir(root, { recursive: true })) {
    if (!path.endsWith('.tsx')) continue;
    const source = await readFile(new URL(path.replaceAll('\\', '/'), root), 'utf8');
    assert.doesNotMatch(source, /LumiScoreMetadata|<meta\s+(?:name="(?:robots|twitter:)|property="og:)|<link\s+rel="canonical"/, path);
  }
});

test('hero preloads only the active theme and matches responsive CSS selection', async () => {
  const layout = await readFile(new URL('../../app/layout.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../app/globals.css', import.meta.url), 'utf8');
  for (const source of [layout, css]) assert.match(source, /\(min-width: 1100px\), \(min-resolution: 1\.5dppx\)/);
  assert.match(layout, /location\.pathname === '\/'/);
  assert.match(layout, /preload\.fetchPriority = 'high'/);
  assert.match(css, /image-set\(var\(--hero-avif\) type\("image\/avif"\), var\(--hero-image\) type\("image\/webp"\)\)/);
  assert.doesNotMatch(css, /(?:dark-reading-scene|light-book-stack)\.png/);
});

test('theme preload handles saved choice, device density, storage denial and non-home routes', async () => {
  const layout = await readFile(new URL('../../app/layout.tsx', import.meta.url), 'utf8');
  const script = /const themeScript = `([\s\S]*?)`;/.exec(layout)?.[1];
  assert.ok(script);
  for (const saved of ['ink', 'paper', null, 'invalid', 'storage-denied']) {
    for (const light of [true, false]) {
      for (const large of [true, false]) {
        for (const pathname of ['/', '/browse', '/book/1']) {
          const links: Record<string, string>[] = [];
          const element = { dataset: {} as Record<string,string>, style: {} };
          runInNewContext(script, {
            localStorage: { getItem: () => { if(saved==='storage-denied') throw new Error('disabled'); return saved; } },
            matchMedia: (query: string) => ({ matches: query.includes('prefers-color-scheme') ? light : large }),
            location: { pathname },
            document: { documentElement: element, createElement: () => ({}), head: { appendChild: (link: Record<string,string>) => links.push(link) } },
          });
          const theme = saved === 'ink' || saved === 'paper' ? saved : light ? 'paper' : 'ink';
          assert.equal(element.dataset.theme, theme);
          assert.equal(links.length, pathname === '/' ? 1 : 0);
          if (links.length) {
            assert.equal(links[0].href, `/assets/${theme === 'paper' ? 'light-book-stack' : 'dark-reading-scene'}-${large ? 1536 : 1024}.avif`);
            assert.equal(links[0].fetchPriority, 'high');
          }
        }
      }
    }
  }
});
