import { getSafeSearchReturnPath } from './search-return.ts';

const COLLECTION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_COLLECTION_SLUG_LENGTH = 120;

export type BookLinkReturnContext =
  | { kind: 'search'; path: string }
  | { kind: 'collection'; slug: string }
  | { kind: 'collections' }
  | { kind: 'home' };

export type BookReturnNavigation =
  | { kind: 'search'; href: string }
  | { kind: 'collection'; href: string; collectionName: string }
  | { kind: 'collections'; href: '/collections' }
  | { kind: 'home'; href: '/' }
  | { kind: 'browse'; href: '/browse' };

export type VerifiedCollectionReturnTarget = {
  slug: string;
  name: string;
};

type VerifyCollectionMembership = (
  workId: string,
  slug: string,
) => Promise<VerifiedCollectionReturnTarget | null>;

export function getCollectionReturnPath(slug: string): string | null {
  if (
    slug.length === 0 ||
    slug.length > MAX_COLLECTION_SLUG_LENGTH ||
    !COLLECTION_SLUG_PATTERN.test(slug)
  ) {
    return null;
  }

  return `/collection/${slug}`;
}

export function serializeBookReturnContext(
  context: BookLinkReturnContext,
): string | null {
  if (context.kind === 'search') {
    return getSafeSearchReturnPath(context.path);
  }
  if (context.kind === 'collection') {
    return getCollectionReturnPath(context.slug);
  }
  if (context.kind === 'home') return '/';
  return '/collections';
}

export function appendBookReturnContext(
  bookHref: string,
  context?: BookLinkReturnContext | null,
): string {
  if (!context) return bookHref;

  const returnTo = serializeBookReturnContext(context);
  if (!returnTo) return bookHref;

  const separator = bookHref.includes('?') ? '&' : '?';
  return `${bookHref}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

function parseSpecificCollectionPath(value: string): string | null {
  // Collection context has no legitimate encoded, query, fragment, or slash
  // variants. Reject them rather than normalizing browser-controlled input.
  if (
    value.includes('%') ||
    value.includes('\\') ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    return null;
  }

  const match = /^\/collection\/([^/?#]+)$/.exec(value);
  if (!match) return null;
  return getCollectionReturnPath(match[1]) ? match[1] : null;
}

export async function resolveBookReturnNavigation(
  requestedReturnTo: unknown,
  workId: string,
  verifyCollectionMembership: VerifyCollectionMembership,
): Promise<BookReturnNavigation> {
  // A complete, validated search URL retains priority over other contexts.
  const searchPath = getSafeSearchReturnPath(requestedReturnTo);
  if (searchPath) return { kind: 'search', href: searchPath };

  if (requestedReturnTo === '/collections') {
    return { kind: 'collections', href: '/collections' };
  }

  if (requestedReturnTo === '/') {
    return { kind: 'home', href: '/' };
  }

  if (typeof requestedReturnTo !== 'string') {
    return { kind: 'browse', href: '/browse' };
  }

  const requestedSlug = parseSpecificCollectionPath(requestedReturnTo);
  if (!requestedSlug) return { kind: 'browse', href: '/browse' };

  const verified = await verifyCollectionMembership(workId, requestedSlug);
  const verifiedPath = verified
    ? getCollectionReturnPath(verified.slug)
    : null;
  if (
    !verifiedPath ||
    verified?.slug !== requestedSlug ||
    verified.name.trim().length === 0
  ) {
    return { kind: 'browse', href: '/browse' };
  }

  return {
    kind: 'collection',
    href: verifiedPath,
    collectionName: verified.name,
  };
}
