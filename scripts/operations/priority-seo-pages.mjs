// A balanced recovery cohort: key entrances, editorial journeys and book regressions.
// This is deliberately not a claim that these are the twenty highest-traffic URLs.
export const firstPrioritySeoPaths = Object.freeze([
  '/nl', '/en', '/nl/taste-test', '/nl/toplijsten',
  '/nl/toplijsten/na-project-hail-mary', '/nl/toplijsten/fantasy-om-mee-te-beginnen',
  '/nl/imdb-voor-boeken', '/en/zo-werkt-het',
  '/en/book/8856', '/en/book/9050', '/en/book/9912', '/en/book/8052',
  '/en/book/6829', '/en/book/3822', '/en/book/6967',
  '/nl/book/17', '/nl/book/117', '/nl/book/8', '/nl/book/6', '/nl/book/1219',
]);

// Second recovery cohort: canonical, language-eligible URLs observed in the
// Search Console crawled/currently-not-indexed examples on 13 November 2026.
// Prioritise Dutch discovery entrances and demonstrated content failures;
// this is a recovery priority, not a traffic ranking or an indexing guarantee.
export const secondPrioritySeoPaths = Object.freeze([
  '/nl/zo-werkt-het', '/nl/toplijsten/dystopie-vanaf-1990', '/nl/categories',
  '/en/book/2062', '/nl/book/6545', '/en/book/8055', '/en/book/2830',
  '/en/book/4911', '/en/book/4825', '/en/book/9508', '/en/book/9306',
  '/en/book/8463', '/en/book/4363', '/en/book/93', '/en/book/4503',
  '/en/book/9686', '/nl/book/19', '/en/book/10062', '/en/book/4892', '/en/book/2842',
]);
// Third cohort: twenty further eligible book URLs from the same Google report,
// selected on 13 November and repaired in the 14 November release.
export const thirdPrioritySeoPaths = Object.freeze([
  '/nl/book/1309', '/en/book/10139', '/en/book/8116', '/en/book/8318',
  '/en/book/2970', '/en/book/1811', '/en/book/7414', '/en/book/3625',
  '/en/book/4490', '/en/book/1795', '/en/book/9969', '/en/book/4804',
  '/en/book/3789', '/en/book/168', '/en/book/8027', '/nl/book/10139',
  '/nl/book/10172', '/en/book/2733', '/en/book/6762', '/en/book/4505',
]);
// Fourth cohort: submitted, crawled/currently-not-indexed examples captured
// on 14 November. Prioritised by observed content gaps and search signals.
export const fourthPrioritySeoPaths = Object.freeze([
  "/en/book/4884",
  "/en/book/4770",
  "/en/book/9586",
  "/en/book/1468",
  "/en/book/6640",
  "/en/book/9644",
  "/en/book/9741",
  "/en/book/7731",
  "/en/book/7971",
  "/en/book/7094",
  "/nl/book/5234",
  "/en/book/8911",
  "/en/book/8492",
  "/en/book/8355",
  "/nl/book/5410",
  "/en/book/2738",
  "/en/book/7140",
  "/en/book/6837",
  "/en/book/7321",
  "/nl/book/1229"
]);
// Fifth cohort: further submitted CNI examples with verified content gaps.
// Editorial recovery priority; no unsupported traffic-ranking claim.
export const fifthPrioritySeoPaths = Object.freeze([
  "/en/book/1412",
  "/en/book/1385",
  "/en/book/8442",
  "/en/book/2187",
  "/en/book/3084",
  "/en/book/2070",
  "/en/book/2426",
  "/nl/book/4975",
  "/nl/book/1658",
  "/nl/book/1513",
  "/en/book/2437",
  "/en/book/2468",
  "/en/book/2779",
  "/en/book/9126",
  "/nl/book/6348",
  "/en/book/9545",
  "/en/book/1966",
  "/en/book/2304",
  "/nl/book/2372",
  "/en/book/8556"
]);
export const prioritySeoPaths = Object.freeze([...firstPrioritySeoPaths, ...secondPrioritySeoPaths, ...thirdPrioritySeoPaths, ...fourthPrioritySeoPaths, ...fifthPrioritySeoPaths]);
export const prioritySeoCohort = path => fifthPrioritySeoPaths.includes(path) ? 'recovery-5'
  : fourthPrioritySeoPaths.includes(path) ? 'recovery-4'
  : thirdPrioritySeoPaths.includes(path) ? 'recovery-3'
  : secondPrioritySeoPaths.includes(path) ? 'recovery-2' : 'recovery-1';
export const requiresVerifiedSynopsis = path => (secondPrioritySeoPaths.includes(path) || thirdPrioritySeoPaths.includes(path) || fourthPrioritySeoPaths.includes(path) || fifthPrioritySeoPaths.includes(path)) && /\/book\//.test(path);

const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1]?.replaceAll('&amp;', '&') ?? '';
const renderedMarkup = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
const textContent = html => renderedMarkup(html).replace(/<[^>]+>/g, ' ')
  .replace(/&(?:nbsp|#0*160|#x0*a0);/gi, ' ').replace(/\s+/g, ' ').trim();

/** Inspect the entire streamed response, but require SEO metadata in its head. */
export function inspectPriorityPage({ path, status, html, xRobots = '', inSitemap, origin = 'https://lumisco.re', requireSynopsis = requiresVerifiedSynopsis(path) }) {
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
  if (/description could not load|beschrijving kon.*niet|catalogue could not load|catalogus kon niet laden|book not found|boek niet gevonden|publieke categoriebron is tijdelijk niet beschikbaar|public category source is temporarily unavailable/i.test(visibleText)) errors.push('Visible content failure');
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
    if (requireSynopsis) {
      const placeholder = /^(?:Loading the description\.|De beschrijving wordt geladen\.|A verified English description is not available yet\.|Er is nog geen geverifieerde Nederlandse beschrijving beschikbaar\.)$/i;
      const verified = descriptions.some(body => {
        const paragraphs = [...body.matchAll(/(<p\b[^>]*>)([\s\S]*?)<\/p>/gi)];
        const hasSynopsis = paragraphs.some(([, tag, content]) => !attribute(tag, 'class').split(/\s+/).includes('description-source')
          && attribute(tag, 'role') !== 'status' && textContent(content) && !placeholder.test(textContent(content)));
        const hasSource = paragraphs.some(([, tag, content]) => attribute(tag, 'class').split(/\s+/).includes('description-source')
          && [...content.matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/gi)].some(([, anchor, label]) => {
            try { return new URL(attribute(anchor, 'href')).protocol === 'https:' && Boolean(textContent(label)); } catch { return false; }
          }));
        return hasSynopsis && hasSource;
      });
      if (!verified) errors.push('Missing verified book synopsis');
    }
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
