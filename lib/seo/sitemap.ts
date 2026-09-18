export function buildPublicSitemapPaths(
  workIds: readonly string[],
  collectionSlugs: readonly string[],
): string[] {
  return [...new Set([
    '/',
    '/browse',
    '/collections',
    '/taste-test',
    '/over-ons',
    '/zo-werkt-het',
    '/voor-uitgevers',
    '/contact',
    ...collectionSlugs
      .map((slug) => slug.trim())
      .filter(Boolean)
      .map((slug) => `/collection/${encodeURIComponent(slug)}`),
    ...workIds
      .filter((workId) => /^\d+$/.test(workId))
      .map((workId) => `/book/${workId}`),
  ])];
}
