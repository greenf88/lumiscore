import {
  boundedCoverOrigin, bureauIsbnRendition, COVER_WIDTHS, hasBureauIsbnRenditions, MAX_COVER_BYTES,
  openLibraryCoverParts, type CoverWidth, type IsbnCoverProfile,
} from './bounded-cover-url.ts';

const COVER_TIMEOUT_MS = 3500;
const maxPending = 48;
const MAX_TRANSFORM_INPUT = 2_000_000;
type CoverBody = { bytes: Uint8Array<ArrayBuffer>; type: string };
type CoverFailure = 'oversized' | 'invalid-image' | 'source-status' | 'source-redirect' | 'source-unavailable';
type CoverResult = CoverBody | CoverFailure;
const pending = new Map<string, Promise<CoverResult>>();

function isRaster(bytes: Uint8Array, type: string) {
  const has = (offset: number, signature: number[]) => signature.every((byte, i) => bytes[offset+i] === byte);
  if (type === 'image/jpeg') return bytes.length > 4 && has(0, [255,216,255]) && has(bytes.length-2,[255,217]);
  if (type === 'image/png') return bytes.length > 32 && has(0,[137,80,78,71,13,10,26,10]) &&
    has(bytes.length-8,[73,69,78,68,174,66,96,130]);
  if (type === 'image/webp') return bytes.length > 16 && has(0,[82,73,70,70]) && has(8,[87,69,66,80]) &&
    new DataView(bytes.buffer,bytes.byteOffset).getUint32(4,true) === bytes.length-8;
  return false;
}

async function readCover(response: Response, maxBytes: number): Promise<CoverResult> {
  const type = response.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase();
  if (response.status !== 200 || !response.body || !type || !['image/jpeg','image/png','image/webp'].includes(type)) {
    await response.body?.cancel();
    return response.status === 200 ? 'invalid-image' : 'source-status';
  }
  const chunks: Uint8Array[] = [];
  const reader = response.body.getReader();
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        return 'oversized';
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  return isRaster(bytes,type) ? { bytes,type } : 'invalid-image';
}

async function resizeOpenLibraryCover(cover: CoverBody, width: CoverWidth): Promise<CoverResult> {
  try {
    // The same public source already used by the deployed image optimizer.
    // Preserve the edition artwork and limit decoder input, dimensions and output.
    const { default: sharp } = await import('sharp');
    const input = sharp(cover.bytes,{limitInputPixels:12_000_000,failOn:'warning'});
    const { width: naturalWidth,height: naturalHeight } = await input.metadata();
    if (!naturalWidth || !naturalHeight || naturalWidth < 2 || naturalHeight < 2) return 'invalid-image';
    const encoded = await input.autoOrient().resize({width,height:width*2,fit:'inside',withoutEnlargement:true})
      .webp({quality:76,effort:2}).toBuffer();
    return encoded.byteLength <= MAX_COVER_BYTES ? {bytes:new Uint8Array(encoded),type:'image/webp'} : 'oversized';
  } catch { return 'invalid-image'; }
}

const archiveCoverPath = /^\/download\/([sml]_covers_\d{4})\/(\1_\d{2}\.zip)\/(\d{10})-([SML])\.jpg$/;
const legacyArchiveCoverPath = /^\/download\/(olcovers\d{1,4})\/(\1-[SML]\.zip)\/(\d{1,10})-([SML])\.jpg$/;

function archiveCoverParts(url: URL) {
  if (url.hostname !== 'archive.org' || url.search) return null;
  const current = archiveCoverPath.exec(url.pathname);
  if (current) return current[1][0] === current[4].toLowerCase() ? current : null;
  const legacy = legacyArchiveCoverPath.exec(url.pathname);
  return legacy?.[2].endsWith(`-${legacy[4]}.zip`) ? legacy : null;
}

function coverRedirect(current: URL, location: string | null) {
  if (!location) return null;
  try {
    const target = new URL(location,current);
    if (target.protocol !== 'https:' || target.username || target.password || target.port || target.hash) return null;
    const parts = openLibraryCoverParts(current);
    if (parts) {
      const alias = boundedCoverOrigin(target.href);
      const resolved = alias && openLibraryCoverParts(alias);
      if (!parts[1].startsWith('id/') && resolved?.[1].startsWith('id/') && resolved[2] === parts[2]) return alias;
      const archive = archiveCoverParts(target);
      if (archive && archive[4] === parts[2] &&
          (!parts[1].startsWith('id/') || Number(archive[3]) === Number(parts[1].slice(3)))) return target;
      return null;
    }
    const archive = archiveCoverParts(current);
    if (archive && /^ia\d+\.(?:us|eu)\.archive\.org$/.test(target.hostname) &&
        target.pathname === '/view_archive.php' && target.searchParams.size === 2 &&
        target.searchParams.get('file') === `${archive[3]}-${archive[4]}.jpg`) {
      const file = target.searchParams.get('archive') ?? '';
      if (/^\/\d{1,3}\/items\//.test(file) &&
          file.replace(/^\/\d{1,3}\/items\//,'') === `${archive[1]}/${archive[2]}`) return target;
    }
    return null;
  } catch { return null; }
}

async function loadCover(origin: URL, width: CoverWidth | null, profile: IsbnCoverProfile | null, fetcher: typeof fetch): Promise<CoverResult> {
  const signal = AbortSignal.timeout(COVER_TIMEOUT_MS);
  const init = { redirect: 'manual' as const, signal, headers:{ Accept:'image/webp,image/png,image/jpeg' } };
  try {
    if (profile) {
      // These are the same asset ID's two published Bureau ISBN renditions.
      // Keep fallback on the server so only one body is delivered to the browser.
      const candidates = [bureauIsbnRendition(origin,profile),origin];
      if (profile === 'screen') candidates.push(bureauIsbnRendition(origin,'thumb'));
      let result: CoverResult = 'source-status';
      let oversized = false;
      for (const candidate of candidates) {
        result = await readCover(await fetcher(candidate,init),MAX_COVER_BYTES);
        if (typeof result !== 'string') return result;
        oversized ||= result === 'oversized';
      }
      return oversized ? 'oversized' : result;
    }
    let current = origin;
    for (let hop = 0; hop <= 3; hop++) {
      const response = await fetcher(current,init);
      if (response.status < 300 || response.status >= 400) {
        const cover = await readCover(response,width ? MAX_TRANSFORM_INPUT : MAX_COVER_BYTES);
        return width && typeof cover !== 'string' ? await resizeOpenLibraryCover(cover,width) : cover;
      }
      const target = coverRedirect(current,response.headers.get('location'));
      await response.body?.cancel();
      if (!target) return 'source-redirect';
      current = target;
    }
    return 'source-redirect';
  } catch { return 'source-unavailable'; }
}

function noImage(reason: string, status = 404) {
  return new Response(null, {status,headers:{'Cache-Control':'no-store','X-LumiScore-Cover-Result':reason}});
}

export async function boundedCoverResponse(request: Request, fetcher: typeof fetch = fetch): Promise<Response> {
  const parameters = new URL(request.url).searchParams;
  const source = parameters.get('source');
  const requestedWidth = parameters.get('w');
  const requestedProfile = parameters.get('profile');
  const width = COVER_WIDTHS.find(value => String(value) === requestedWidth) ?? null;
  const profile = requestedProfile === 'thumb' || requestedProfile === 'screen' ? requestedProfile : null;
  const variants = Number(requestedWidth !== null) + Number(requestedProfile !== null);
  const origin = parameters.size === 1 + variants && variants <= 1 && source ? boundedCoverOrigin(source) : null;
  if (!origin) return noImage('unsupported-source',400);
  if (requestedWidth !== null && (!width || !openLibraryCoverParts(origin))) return noImage('unsupported-variant',400);
  if (requestedProfile !== null && (!profile || !hasBureauIsbnRenditions(origin))) return noImage('unsupported-variant',400);
  const key = origin.href + '#' + (width ?? profile ?? '');
  let job = pending.get(key);
  if (!job) {
    if (pending.size >= maxPending) return noImage('busy',503);
    job = loadCover(origin,width,profile,fetcher).finally(() => pending.delete(key));
    pending.set(key,job);
  }
  const result = await job;
  if (typeof result === 'string') return noImage(result,result === 'source-unavailable' ? 503 : 404);
  // Never forward headers or a redirect from the image origin. The response
  // length is the exact body we just validated, independent of upstream headers.
  return new Response(result.bytes,{headers:{
    'Content-Type':result.type,
    'Content-Length':String(result.bytes.byteLength),
    'Cache-Control':openLibraryCoverParts(origin) ? 'public, max-age=300, s-maxage=3600' : 'private, max-age=300',
    'X-Content-Type-Options':'nosniff',
    'Content-Security-Policy':"default-src 'none'; sandbox",
    'X-LumiScore-Cover-Result':'image',
  }});
}
