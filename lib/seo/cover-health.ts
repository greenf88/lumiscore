import { safePublicCoverUrl } from '../books/stored-presentation.ts';

const monitoredHosts = new Set([
  'covers.openlibrary.org',
  'metadata.isbn.nl',
  'images.penguinrandomhouse.com',
  'books.google.com',
  'books.google.nl',
  'www.awbruna.nl',
]);

/** A bounded transport probe. An image response does not verify the edition or artwork. */
export async function probeCoverTransport(url: string, fetcher: typeof fetch = fetch) {
  if (!safePublicCoverUrl(url)) return { state: 'not_probed' } as const;
  const host = new URL(url).hostname;
  if (!monitoredHosts.has(host)) return { state: 'not_probed' } as const;
  try {
    const response = await fetcher(url, {
      headers: { Range: 'bytes=0-31' },
      signal: AbortSignal.timeout(8_000),
    });
    await response.body?.cancel();
    if (!response.ok) return { state: 'http_error', host, status: response.status } as const;
    if (!response.headers.get('content-type')?.startsWith('image/')) {
      return { state: 'unexpected_content', host, status: response.status } as const;
    }
    return { state: 'image_response', host, status: response.status } as const;
  } catch {
    return { state: 'transport_error', host } as const;
  }
}
