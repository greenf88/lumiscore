import assert from 'node:assert/strict';

export async function readSitemapShards(origin) {
  async function read(path) {
    const response = await fetch(new URL(path, origin), { redirect: 'manual', headers: { cookie: 'lumiscore-locale=nl' } });
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('set-cookie'), null, path);
    assert.match(response.headers.get('content-type') ?? '', /application\/xml/);
    return response.text();
  }
  const index = await read('/sitemap.xml');
  assert.match(index, /<sitemapindex\b/);
  assert.doesNotMatch(index, /<lastmod>/);
  const shards = [...index.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(shards, ['pages', 'books-en', 'books-nl'].map(name => 'https://lumisco.re/sitemap-' + name + '.xml'));
  const xml = await Promise.all(shards.map(url => read(new URL(url).pathname)));
  for (const [i, shard] of xml.entries()) {
    assert.match(shard, /<urlset\b/);
    assert.doesNotMatch(shard, /<lastmod>/);
    const urls = [...shard.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => new URL(match[1]).pathname);
    assert.ok(urls.length);
    for (const url of urls) {
      const expected = i === 0 ? !url.includes('/book/') : url.startsWith(i === 1 ? '/en/book/' : '/nl/book/');
      assert.ok(expected, url);
    }
  }
  return xml;
}
