import assert from 'node:assert/strict';
import test from 'node:test';
import { canOptimizeCover, optimizedCover, coverImageConfiguration, COVER_WIDTHS } from './cover-delivery.ts';

test('only the bounded, public Open Library cover endpoint is eligible; no arbitrary proxy', () => {
  for (const key of ['id/12345','isbn/9780385472579','olid/OL7440033M']) {
    const url = `https://covers.openlibrary.org/b/${key}-M.jpg?default=false`;
    assert.equal(canOptimizeCover(url),true);
    const result = optimizedCover(url,'card',true)!;
    assert.equal(new URL(result.src,'https://example.invalid').pathname,'/_vercel/image');
    assert.equal(new URL(result.src,'https://example.invalid').searchParams.get('url'),url.replace('-M.jpg','-L.jpg'));
    assert.deepEqual(result.srcSet.split(', ').map(v => Number(v.match(/ (\d+)w$/)![1])),[...COVER_WIDTHS]);
    assert.equal(optimizedCover(url,'card',false),null);
  }
  for (const url of ['http://covers.openlibrary.org/b/id/1-L.jpg','https://covers.openlibrary.org.evil.test/b/id/1-L.jpg',
    'https://covers.openlibrary.org/b/id/1-L.jpg?token=secret','https://covers.openlibrary.org/b/id/1-L.jpg#x',
    'https://covers.openlibrary.org:444/b/id/1-L.jpg','https://covers.openlibrary.org/b/id/1.svg',
    'https://books.google.com/books/content?id=x','http://127.0.0.1/private','/private.jpg']) {
    assert.equal(canOptimizeCover(url),false,url); assert.equal(optimizedCover(url,'detail',true),null);
  }
  assert.deepEqual(coverImageConfiguration.domains,[]); assert.deepEqual(coverImageConfiguration.localPatterns,[]);
  assert.equal(coverImageConfiguration.dangerouslyAllowSVG,false);
  const pattern=coverImageConfiguration.remotePatterns[0];
  assert.ok(new RegExp(pattern.hostname).test('covers.openlibrary.org'));
  assert.ok(!new RegExp(pattern.hostname).test('covers.openlibrary.org.evil.test'));
});
