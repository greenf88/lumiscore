import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';
import * as text from '../lib/books/description-text.ts';
import * as source from '../lib/books/description-source.ts';

// Run the real client component's effect with deterministic hook/HTTP adapters.
// No real authentication, network or database calls.
async function fixture() {
  let locale = 'en', state: unknown = null, effect: (() => (() => void)) | null = null;
  let dependencies: unknown[] = [], cleanup: (() => void) | undefined;
  const requests: { url: string; signal: AbortSignal; resolve: (value: unknown) => void; reject: (error: Error) => void }[] = [];
  const exports: { LumiScoreBookDescription?: (props: { workId: string }) => Parameters<typeof renderToStaticMarkup>[0] } = {};
  const code = ts.transpile(await readFile(new URL('../app/components/LumiScoreBookDescription.tsx', import.meta.url), 'utf8'), {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  });
  runInNewContext(code, { exports, AbortController, encodeURIComponent,
    fetch: (url: string, options: { signal: AbortSignal }) => new Promise((resolve, reject) => requests.push({ url, signal: options.signal, resolve, reject })),
    require: (name: string) => {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'react') return {
        useState: () => [state, (value: unknown) => { state = value; }],
        useEffect: (next: typeof effect, deps: unknown[]) => {
          if (deps.some((value, index) => value !== dependencies[index])) {
            cleanup?.(); effect = next; dependencies = deps;
          }
        },
      };
      if (name === '@/lib/books/description-text') return text;
      if (name === '@/lib/books/description-source') return source;
      if (name === './LumiScoreLocale') return { useLumiScoreLocale: () => ({ locale, t: (key: string) => key }) };
      throw new Error('Unexpected component dependency');
    },
  });
  return {
    requests, setLocale: (value: string) => { locale = value; },
    render: (workId = '1') => {
      const html = renderToStaticMarkup(exports.LumiScoreBookDescription!({ workId }));
      if (effect) { const run = effect; effect = null; cleanup = run(); }
      return html;
    },
    settle: () => new Promise<void>(resolve => setImmediate(resolve)),
    unmount: () => cleanup?.(),
  };
}
const description = (language: string, sourceKey = 'OL1W') => ({
  text: 'Verified synthetic synopsis.', language, source: 'open_library', sourceKey, verifiedAt: '2026-10-08',
});

test('recovery restores asynchronous synopsis without duplicate request, retains verified attribution', async () => {
  const f = await fixture();
  assert.match(f.render(), /verified English description/);
  assert.equal(f.requests[0].url, '/api/books/1/description?locale=en');
  f.requests[0].resolve({ ok: true, json: async () => ({ description: description('en') }) });
  await f.settle();
  assert.match(f.render(), /Verified synthetic synopsis/);
  assert.match(f.render(), /https:\/\/openlibrary.org\/works\/OL1W/);
  assert.equal(f.requests.length, 1);
  f.unmount();
  assert.equal(f.requests[0].signal.aborted, true);
});

test('locale/work change aborts old request and excludes stale or wrong-language text', async () => {
  const f = await fixture();
  f.render(); f.setLocale('nl');
  assert.match(f.render('2'), /geverifieerde Nederlandse beschrijving/);
  assert.equal(f.requests[0].signal.aborted, true);
  f.requests[0].resolve({ ok: true, json: async () => ({ description: description('en') }) });
  f.requests[1].resolve({ ok: true, json: async () => ({ description: description('en', 'OL2W') }) });
  await f.settle();
  assert.doesNotMatch(f.render('2'), /Verified synthetic synopsis/);
  f.unmount();
});

test('failed request or untrusted source leaves fallback, never rejects book render', async () => {
  const f = await fixture(); f.render();
  f.requests[0].reject(new Error('Synthetic optional service unavailable'));
  await f.settle(); assert.match(f.render(), /verified English description/);
  f.render('2');
  f.requests[1].resolve({ ok: true, json: async () => ({ description: description('en', 'untrusted-url') }) });
  await f.settle(); assert.doesNotMatch(f.render('2'), /Verified synthetic synopsis/);
  f.unmount();
});

test('book server render no longer waits for external synopsis; private loaders remain parallel', async () => {
  const page = await readFile(new URL('../app/book/[workId]/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /loadPublicBookDescription|descriptionPromise/);
  assert.match(page, /Promise\.all\(/);
  for (const name of ['ratingStatePromise', 'readingStatusPromise', 'personalizationPromise', 'returnNavigationPromise']) assert.ok(page.includes(name));
});
