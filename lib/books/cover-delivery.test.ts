import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { boundedCoverAttempts } from './cover-delivery.ts';
import { boundedCoverOrigin, boundedCoverUrl, MAX_COVER_BYTES } from './bounded-cover-url.ts';
import { boundedCoverResponse } from './bounded-cover-response.ts';

const original = 'https://covers.openlibrary.org/b/id/12455001-L.jpg?default=false';
const medium = original.replace('-L.', '-M.');
const base = 'https://example.invalid';
const request = (source: string) => new Request(base + boundedCoverUrl(source));
function jpeg(length: number) {
  const body = new Uint8Array(length);
  body.set([255,216,255]);
  body.set([255,217],length-2);
  return body;
}
function fetchCover(body: Uint8Array<ArrayBuffer>, declared?: string): typeof fetch {
  const headers: Record<string,string> = { 'Content-Type':'image/jpeg' };
  if (declared) headers['Content-Length'] = declared;
  return async () => new Response(body,{headers});
}

test('all responsive and retry sources point to the byte gate', () => {
  for (const presentation of ['compact','card','taste','detail'] as const) {
    for (const attempt of boundedCoverAttempts(original,presentation)) {
      for (const src of [attempt.src,...(attempt.srcSet?.split(', ').map(s => s.split(' ')[0]) ?? [])]) {
        const url = new URL(src,base);
        assert.equal(url.pathname,'/api/catalog/cover');
        assert.match(url.searchParams.get('source') ?? '',/\/12455001-[SML]\.jpg\?default=false$/);
      }
    }
  }
  assert.equal(boundedCoverAttempts(original,'card')[0].src,boundedCoverUrl(original,256));
  assert.equal(boundedCoverAttempts(original,'detail')[0].src,boundedCoverUrl(original,512));
  assert.deepEqual(boundedCoverAttempts('https://unverified.example/cover.jpg','detail'),[]);
});

test('only known public image paths are accepted, with no credentials or free query', () => {
  assert.ok(boundedCoverOrigin(original));
  assert.ok(boundedCoverOrigin('https://metadata.isbn.nl/ie_fcache/0000521990_De_Hobbit_0_0.jpg'));
  for (const url of ['http://covers.openlibrary.org/b/id/1-L.jpg','https://covers.openlibrary.org.evil.test/b/id/1-L.jpg',
    'https://covers.openlibrary.org/b/id/1-L.jpg?token=secret','https://covers.openlibrary.org/b/id/1-L.jpg#x',
    'https://covers.openlibrary.org:444/b/id/1-L.jpg','https://user:pass@covers.openlibrary.org/b/id/1-L.jpg',
    'https://metadata.isbn.nl/ie_fcache/123_a%2Fb.jpg','https://metadata.isbn.nl/private.jpg','http://127.0.0.1/private',
    'https://archive.org/download/s_covers_0001/test.jpg','/private.jpg']) assert.equal(boundedCoverOrigin(url),null,url);
});

test('the actual body determines the result, even when Content-Length is missing or wrong', async () => {
  for (const declared of [undefined,'1','300001']) {
    const exact = await boundedCoverResponse(request(original),fetchCover(jpeg(MAX_COVER_BYTES),declared));
    assert.equal(exact.status,200);
    assert.equal(exact.headers.get('content-length'),String(MAX_COVER_BYTES));
    assert.equal((await exact.arrayBuffer()).byteLength,MAX_COVER_BYTES);
    const oversized = await boundedCoverResponse(request(original),fetchCover(jpeg(MAX_COVER_BYTES+1),declared));
    assert.equal(oversized.status,404);
    assert.equal(oversized.headers.get('x-lumiscore-cover-result'),'oversized');
    assert.equal((await oversized.arrayBuffer()).byteLength,0);
  }
});

test('a too-large fallback is blocked and invalid images never pass as successful covers', async () => {
  assert.equal((await boundedCoverResponse(request(medium),fetchCover(jpeg(MAX_COVER_BYTES+1)))).status,404);
  const bad = await boundedCoverResponse(request(original),fetchCover(new Uint8Array([1,2,3,4,5])));
  assert.equal(bad.headers.get('x-lumiscore-cover-result'),'invalid-image');
  const html = await boundedCoverResponse(request(original),async () => new Response('<html>login</html>'));
  assert.equal(html.status,404);
  const outage = await boundedCoverResponse(request(original),async () => { throw Error('network'); });
  assert.equal(outage.status,503);
});

test('a real oversized source becomes a smaller, decodable image without changing proportions', async () => {
  const pixels = new Uint8Array(800*1200*3);
  for (let i = 0, seed = 7; i < pixels.length; i++) {
    seed = (Math.imul(seed,1664525) + 1013904223) | 0;
    pixels[i] = seed >>> 24;
  }
  const input = await sharp(pixels,{raw:{width:800,height:1200,channels:3}}).jpeg({quality:95}).toBuffer();
  assert.ok(input.byteLength > MAX_COVER_BYTES);
  for (const width of [256,512] as const) {
    const res = await boundedCoverResponse(new Request(base+boundedCoverUrl(original,width)),fetchCover(new Uint8Array(input)));
    assert.equal(res.status,200);
    assert.equal(res.headers.get('content-type'),'image/webp');
    const bytes = await res.arrayBuffer();
    assert.ok(bytes.byteLength <= MAX_COVER_BYTES);
    const actual = await sharp(Buffer.from(bytes)).metadata();
    assert.equal(actual.width,width);
    assert.equal(actual.height,width*1.5);
  }
});

test('non-Open Library sources cannot use the transform or arbitrary size parameters',async () => {
  const local = boundedCoverUrl('https://images.penguinrandomhouse.com/cover/9780593135204');
  const fetcher = async () => { assert.fail('unsupported variant should never fetch'); };
  for (const url of [base+local+'&w=256',base+boundedCoverUrl(original)+'&w=9999']) {
    assert.equal((await boundedCoverResponse(new Request(url),fetcher)).status,400);
  }
});

test('Bureau ISBN falls back within the same image ID and sends only the bounded result',async () => {
  const source = 'https://metadata.isbn.nl/ie_fcache/0000800664_Dog_Man_0_0.jpg';
  const screen = boundedCoverAttempts(source,'detail')[0].src;
  assert.equal(new URL(screen,base).searchParams.get('profile'),'screen');
  const calls: string[] = [];
  const fetcher: typeof fetch = async url => {
    calls.push(String(url));
    if (String(url).includes('_2_710_130_')) return new Response(null,{status:404});
    return fetchCover(jpeg(String(url) === source ? MAX_COVER_BYTES+1 : 1234))(url);
  };
  const response = await boundedCoverResponse(new Request(base+screen),fetcher);
  assert.equal(response.status,200);
  assert.equal((await response.arrayBuffer()).byteLength,1234);
  assert.deepEqual(calls,[
    source.replace('_0_0.jpg','_2_710_130_0_0.jpg'),source,source.replace('_0_0.jpg','_3_130_250_0_0.jpg'),
  ]);
});

test('only identity-bound Open Library archive redirects can be followed', async () => {
  const archive = 'https://archive.org/download/l_covers_0012/l_covers_0012_45.zip/0012455001-L.jpg';
  const server = 'https://ia600100.us.archive.org/view_archive.php?archive=/5/items/l_covers_0012/l_covers_0012_45.zip&file=0012455001-L.jpg';
  let calls: string[] = [];
  const relay = (targets: string[]): typeof fetch => async (url, init) => {
    assert.equal(init?.redirect,'manual');
    calls.push(String(url));
    const location = targets.shift();
    return location ? new Response(null,{status:302,headers:{Location:location}}) : fetchCover(jpeg(100))(url);
  };
  const good = await boundedCoverResponse(request(original),relay([archive,server]));
  assert.equal(good.status,200);
  assert.deepEqual(calls,[original,archive,server]);
  for (const [targets, expected] of [
    [['https://127.0.0.1/cat.jpg'],1],
    [[archive.replace('0012455001','0012455002')],1],
    [[archive,server.replace('0012455001','0012455002')],2],
    [[archive,server.replace('.archive.org','.archive.org.evil.test')],2],
  ] as const) {
    calls = [];
    const bad = await boundedCoverResponse(request(original),relay([...targets]));
    assert.equal(bad.headers.get('x-lumiscore-cover-result'),'source-redirect');
    assert.equal(calls.length,expected);
  }
  calls = [];
  const legacySource = 'https://covers.openlibrary.org/b/id/370100-L.jpg?default=false';
  const legacyArchive = 'https://archive.org/download/olcovers37/olcovers37-L.zip/370100-L.jpg';
  const legacyServer = 'https://ia600401.us.archive.org/view_archive.php?archive=/33/items/olcovers37/olcovers37-L.zip&file=370100-L.jpg';
  assert.equal((await boundedCoverResponse(request(legacySource),relay([legacyArchive,legacyServer]))).status,200);
  assert.deepEqual(calls,[legacySource,legacyArchive,legacyServer]);
  assert.equal((await boundedCoverResponse(request(legacySource),relay([legacyArchive.replace('olcovers37-L.zip','olcovers37-S.zip')]))).status,404);
});
