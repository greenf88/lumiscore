// Keep important historical regressions daily; visit every other page once per UTC week.
export const dailySeoRegressionPaths = Object.freeze([
  '/nl/book/10481', '/nl/book/1066', '/nl/book/5591',
  '/en/book/1787', '/en/book/1376', '/en/book/1859',
]);

export function scheduledSeoPaths(paths, { daily = false, date = new Date() } = {}) {
  if (!daily) return [...paths];
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid SEO monitoring date');
  const core = new Set(dailySeoRegressionPaths);
  const rotating = paths.filter(path => !core.has(path));
  const day = date.getUTCDay();
  return [...paths.filter(path => core.has(path)), ...rotating.filter((_, index) => index % 7 === day)];
}
