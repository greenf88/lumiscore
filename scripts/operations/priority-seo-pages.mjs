// A balanced recovery cohort: key entrances, editorial journeys and book regressions.
// This is deliberately not a claim that these are the twenty highest-traffic URLs.
export const prioritySeoPaths = Object.freeze([
  '/nl', '/en', '/nl/taste-test', '/nl/toplijsten',
  '/nl/toplijsten/na-project-hail-mary', '/nl/toplijsten/fantasy-om-mee-te-beginnen',
  '/nl/imdb-voor-boeken', '/en/zo-werkt-het',
  '/en/book/8856', '/en/book/9050', '/en/book/9912', '/en/book/8052',
  '/en/book/6829', '/en/book/3822', '/en/book/6967',
  '/nl/book/17', '/nl/book/117', '/nl/book/8', '/nl/book/6', '/nl/book/1219',
]);

const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1]?.replaceAll('&amp;', '&') ?? '';
const renderedMarkup = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
const textContent = html => renderedMarkup(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** Inspect the entire streamed response, but require SEO metadata in its head. */
export function inspectPriorityPage({ path, status, html, xRobots = '', inSitemap, origin = 'https://lumisco.re' }) {
  const errors = [];
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
  const tags = [...head.matchAll(/<(?:link|meta)\b[^>]*>/gi)].map(match => match[0]);
  const canonicals = tags.filter(tag => attribute(tag, 'rel') === 'canonical').map(tag => attribute(tag, 'href'));
  const robots = tags.filter(tag => attribute(tag, 'name') === 'robots').map(tag => attribute(tag, 'content'));
  if (status !== 200) errors.push(`HTTP ${status}`);
  if (canonicals.length !== 1 || canonicals[0] !== origin + path) errors.push('Missing or incorrect head canonical');
  if (!robots.some(value => /(?:^|,)\s*index\s*(?:,|$)/i.test(value)) || [...robots, xRobots].some(value => /noindex/i.test(value))) errors.push('Not indexable');
  if (!inSitemap) errors.push('Missing from sitemap');
  if (!/<title>[^<]+<\/title>/i.test(head)) errors.push('Missing head title');
  if (!tags.some(tag => attribute(tag, 'name') === 'description' && attribute(tag, 'content').trim())) errors.push('Missing head description');
  if ([...html.matchAll(/<h1\b[^>]*>/gi)].length !== 1) errors.push('Expected one page heading');
  const visibleText = textContent(html);
  if (/description could not load|beschrijving kon.*niet|book not found|boek niet gevonden/i.test(visibleText)) errors.push('Visible content failure');
  if (/^\/(?:en|nl)\/book\/\d+$/.test(path)) {
    // React keeps the loading fallback in the raw stream after the resolved
    // segment arrives. Require terminal component markup, including its source
    // attribution, rather than accepting a fallback-only HTTP 200 response.
    const descriptions = [...renderedMarkup(html).matchAll(/(<section\b[^>]*>)([\s\S]*?)<\/section>/gi)]
      .filter(([, tag]) => attribute(tag, 'class').split(/\s+/).includes('book-description'))
      .map(([, , body]) => body);
    const completed = descriptions.some(body => [...body.matchAll(/<p\b[^>]*>/gi)]
      .some(([tag]) => attribute(tag, 'class').split(/\s+/).includes('description-source'))
      || /Er is nog geen geverifieerde Nederlandse beschrijving beschikbaar\.|A verified English description is not available yet\./.test(textContent(body)));
    if (!completed) errors.push('Missing completed book description');
  }
  for (const [tag] of html.matchAll(/<a\b[^>]*>/gi)) {
    const href = attribute(tag, 'href');
    if (!href) continue;
    let link;
    try { link = new URL(href, origin + path); } catch { continue; }
    if (link.origin === origin && /^\/(?:en\/|nl\/)?book\/\d+$/.test(link.pathname) && link.searchParams.has('returnTo')) {
      errors.push('Book link exposes returnTo variant');
      break;
    }
  }
  if (/\/(?:en|nl)\/book\//.test(path) && !/<script\b[^>]*type="application\/ld\+json"[^>]*>[^<]*"@type":"Book"/i.test(html)) errors.push('Missing Book structured data');
  return { path, status, errors };
}
