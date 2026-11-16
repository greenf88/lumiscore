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
// Requested linked-page repairs; these URLs are not asserted to share a GSC status.
export const sixthPrioritySeoPaths = Object.freeze([
  "/en/book/10138",
  "/en/book/1519",
  "/en/book/1914",
  "/en/book/1915",
  "/en/book/2699",
  "/en/book/1620",
  "/en/book/1892",
  "/en/book/8467",
  "/en/book/2114",
  "/en/book/2118",
  "/en/book/2206",
  "/en/book/2493",
  "/en/book/2251",
  "/nl/book/3505",
  "/nl/book/5021",
  "/nl/book/1654",
  "/nl/book/1724",
  "/nl/book/3168",
  "/en/book/4481",
  "/en/book/2265",
  "/en/book/2266",
  "/en/book/2761",
  "/en/book/8794",
  "/en/book/4424",
  "/en/book/7065",
  "/en/book/2258",
  "/en/book/8563",
  "/en/book/2539",
  "/en/book/8247",
  "/en/book/2202",
  "/nl/book/5117",
  "/en/book/9483"
]);
// Thirteen additional linked-page description repairs requested by the user.
export const seventhPrioritySeoPaths = Object.freeze([
  "/en/book/2219",
  "/en/book/135",
  "/en/book/1900",
  "/en/book/9770",
  "/en/book/1425",
  "/en/book/2848",
  "/en/book/596",
  "/nl/book/5108",
  "/nl/book/5065",
  "/nl/book/5067",
  "/en/book/9854",
  "/en/book/2756",
  "/en/book/2201"
]);
// Eight additional source-verified descriptions selected from submitted GSC CNI examples.
export const eighthPrioritySeoPaths = Object.freeze([
  "/en/book/8305",
  "/en/book/9487",
  "/nl/book/5440",
  "/en/book/9738",
  "/en/book/9999",
  "/en/book/7580",
  "/en/book/8197",
  "/en/book/9087"
]);
// Remaining source-verified descriptions selected from GSC failures and their linked targets.
export const ninthPrioritySeoPaths = Object.freeze([
  "/en/book/8249",
  "/nl/book/2376",
  "/en/book/9652",
  "/en/book/8605",
  "/en/book/9124",
  "/en/book/8315",
  "/en/book/8971",
  "/en/book/1508",
  "/en/book/2958",
  "/en/book/6690",
  "/en/book/4853",
  "/en/book/1609",
  "/en/book/8138",
  "/en/book/9119",
  "/en/book/9312",
  "/en/book/1847",
  "/en/book/9804",
  "/en/book/6820",
  "/en/book/7652",
  "/en/book/9301",
  "/en/book/1506",
  "/en/book/1341",
  "/en/book/2743",
  "/en/book/8384",
  "/en/book/8184",
  "/en/book/8683",
  "/en/book/2399",
  "/en/book/9323",
  "/en/book/9547",
  "/en/book/4323",
  "/en/book/4166",
  "/en/book/8296",
  "/en/book/8240",
  "/en/book/8438",
  "/en/book/3654",
  "/en/book/4807",
  "/en/book/8505",
  "/en/book/1453",
  "/en/book/7299",
  "/en/book/6621",
  "/en/book/8093",
  "/en/book/4252",
  "/en/book/8332",
  "/en/book/4322",
  "/en/book/7279",
  "/en/book/10100",
  "/en/book/9484",
  "/en/book/9799",
  "/en/book/8329",
  "/en/book/2683",
  "/en/book/9706",
  "/en/book/8466",
  "/en/book/1624",
  "/en/book/1876",
  "/en/book/4274",
  "/en/book/8472",
  "/en/book/9504",
  "/en/book/2532",
  "/en/book/2466",
  "/nl/book/5074",
  "/nl/book/5079",
  "/en/book/2767",
  "/en/book/9515",
  "/en/book/1405",
  "/en/book/9264",
  "/en/book/9416",
  "/en/book/4500",
  "/en/book/8725",
  "/en/book/9507"
]);
// Remaining source-verified descriptions selected from GSC failures and their linked targets.
export const tenthPrioritySeoPaths = Object.freeze([
  "/en/book/7512",
  "/en/book/4186"
]);
// Remaining sixty descriptions, independently verified against exact edition identities.
export const eleventhPrioritySeoPaths = Object.freeze([
  "/en/book/4185",
  "/en/book/4445",
  "/en/book/4447",
  "/en/book/8967",
  "/en/book/9871",
  "/en/book/10036",
  "/en/book/8307",
  "/en/book/9090",
  "/en/book/10053",
  "/en/book/1471",
  "/en/book/1839",
  "/en/book/1890",
  "/en/book/2126",
  "/en/book/2392",
  "/en/book/2458",
  "/en/book/2715",
  "/en/book/3032",
  "/en/book/4110",
  "/en/book/4245",
  "/en/book/4299",
  "/en/book/4823",
  "/en/book/8520",
  "/en/book/8550",
  "/en/book/8591",
  "/en/book/8817",
  "/en/book/8838",
  "/en/book/9092",
  "/en/book/9266",
  "/en/book/9274",
  "/en/book/9355",
  "/en/book/9785",
  "/en/book/9863",
  "/nl/book/5063",
  "/nl/book/5069",
  "/en/book/10020",
  "/en/book/10128",
  "/en/book/2741",
  "/en/book/3813",
  "/en/book/3845",
  "/en/book/4330",
  "/en/book/4545",
  "/en/book/7514",
  "/en/book/8632",
  "/en/book/8841",
  "/en/book/8909",
  "/en/book/8972",
  "/en/book/9555",
  "/en/book/9965",
  "/en/book/9968",
  "/en/book/4370",
  "/en/book/8219",
  "/en/book/8421",
  "/en/book/8832",
  "/en/book/9490",
  "/en/book/1408",
  "/en/book/2151",
  "/en/book/8603",
  "/en/book/8978",
  "/en/book/9229",
  "/en/book/9435"
]);
// Remaining thirty-one descriptions, independently verified against exact edition identities.
export const twelfthPrioritySeoPaths = Object.freeze([
  "/en/book/4702",
  "/en/book/8931",
  "/en/book/1426",
  "/en/book/1503",
  "/en/book/1799",
  "/en/book/1830",
  "/en/book/1950",
  "/en/book/2074",
  "/en/book/2803",
  "/en/book/4149",
  "/en/book/4183",
  "/en/book/4340",
  "/en/book/4379",
  "/en/book/632",
  "/en/book/653",
  "/en/book/8400",
  "/en/book/8541",
  "/en/book/8636",
  "/en/book/8758",
  "/en/book/8781",
  "/en/book/8800",
  "/en/book/8991",
  "/en/book/9162",
  "/en/book/9184",
  "/en/book/9236",
  "/en/book/9358",
  "/en/book/9406",
  "/en/book/9822",
  "/en/book/9930",
  "/en/book/9946",
  "/nl/book/5109"
]);
// Fourteen remaining descriptions, independently verified against exact edition identities.
export const thirteenthPrioritySeoPaths = Object.freeze([
  "/en/book/1477",
  "/en/book/1502",
  "/en/book/1615",
  "/en/book/1676",
  "/en/book/1944",
  "/en/book/2122",
  "/en/book/2148",
  "/en/book/4360",
  "/en/book/633",
  "/en/book/8430",
  "/en/book/8805",
  "/en/book/9231",
  "/en/book/9814",
  "/en/book/9846"
]);
// Eleven supporting-page descriptions verified against exact edition identities.
export const fourteenthPrioritySeoPaths = Object.freeze([
  "/en/book/10021",
  "/en/book/1430",
  "/en/book/1664",
  "/en/book/2147",
  "/en/book/4410",
  "/en/book/586",
  "/en/book/631",
  "/en/book/8486",
  "/en/book/9138",
  "/en/book/9344",
  "/en/book/9793"
]);
// Ten supporting-page descriptions verified against exact edition identities.
export const fifteenthPrioritySeoPaths = Object.freeze([
  "/en/book/1419",
  "/en/book/1958",
  "/en/book/2095",
  "/en/book/2110",
  "/en/book/3116",
  "/en/book/686",
  "/en/book/8913",
  "/en/book/9112",
  "/en/book/9213",
  "/en/book/9906"
]);
// Twenty further canonical book pages with reviewed descriptions and reading links.
export const sixteenthPrioritySeoPaths = Object.freeze([
  "/en/book/7801",
  "/en/book/7928",
  "/en/book/4277",
  "/en/book/1402",
  "/en/book/7248",
  "/en/book/7185",
  "/en/book/7611",
  "/en/book/8901",
  "/en/book/1307",
  "/en/book/9797",
  "/nl/book/3269",
  "/nl/book/6488",
  "/en/book/4886",
  "/en/book/8713",
  "/en/book/6686",
  "/en/book/8326",
  "/en/book/6756",
  "/nl/book/5714",
  "/en/book/7482",
  "/en/book/9856"
]);
// Thirty further GSC examples with reviewed descriptions and contextual reading links.
export const seventeenthPrioritySeoPaths = Object.freeze([
  "/nl/book/1625",
  "/en/book/9534",
  "/en/book/3779",
  "/nl/book/1707",
  "/en/book/3743",
  "/en/book/3674",
  "/en/book/1894",
  "/en/book/605",
  "/en/book/8727",
  "/en/book/1907",
  "/en/book/8937",
  "/en/book/2760",
  "/nl/book/3458",
  "/nl/book/1347",
  "/nl/book/1703",
  "/nl/book/6290",
  "/nl/book/3279",
  "/en/book/10049",
  "/en/book/9494",
  "/en/book/2135",
  "/nl/book/2353",
  "/nl/book/5023",
  "/nl/book/1828",
  "/en/book/8029",
  "/en/book/10114",
  "/en/book/3660",
  "/en/book/9762",
  "/en/book/8854",
  "/en/book/4442",
  "/en/book/3753"
]);
// Thirty additional canonical GSC examples with reviewed descriptions and reading links.
export const eighteenthPrioritySeoPaths = Object.freeze([
  "/en/book/7437",
  "/nl/book/1839",
  "/nl/book/5895",
  "/nl/book/5469",
  "/nl/book/5579",
  "/en/book/6628",
  "/en/book/8207",
  "/nl/book/5408",
  "/en/book/3771",
  "/en/book/9298",
  "/en/book/1965",
  "/en/book/4291",
  "/nl/book/5684",
  "/en/book/7855",
  "/nl/book/3217",
  "/nl/book/5165",
  "/en/book/3725",
  "/en/book/7672",
  "/nl/book/1503",
  "/nl/book/1482",
  "/en/book/7404",
  "/nl/book/5130",
  "/nl/book/3293",
  "/nl/book/5438",
  "/en/book/9420",
  "/nl/book/5820",
  "/en/book/9654",
  "/nl/book/5277",
  "/nl/book/5546",
  "/nl/book/1676"
]);
// Thirty additional canonical GSC examples with reviewed descriptions and reading links.
export const nineteenthPrioritySeoPaths = Object.freeze([
  "/en/book/3078",
  "/en/book/9844",
  "/en/book/3973",
  "/en/book/2433",
  "/en/book/8545",
  "/en/book/8516",
  "/en/book/4849",
  "/en/book/8864",
  "/en/book/9226",
  "/nl/book/5520",
  "/en/book/7716",
  "/nl/book/5707",
  "/nl/book/2369",
  "/en/book/4206",
  "/en/book/2109",
  "/nl/book/3501",
  "/nl/book/3305",
  "/nl/book/3016",
  "/nl/book/5756",
  "/nl/book/6094",
  "/nl/book/6312",
  "/nl/book/5923",
  "/nl/book/6057",
  "/nl/book/5536",
  "/en/book/2672",
  "/en/book/4219",
  "/en/book/7643",
  "/en/book/2308",
  "/en/book/4429",
  "/en/book/4584"
]);
export const prioritySeoPaths = Object.freeze([...firstPrioritySeoPaths, ...secondPrioritySeoPaths, ...thirdPrioritySeoPaths, ...fourthPrioritySeoPaths, ...fifthPrioritySeoPaths, ...sixthPrioritySeoPaths, ...seventhPrioritySeoPaths, ...eighthPrioritySeoPaths, ...ninthPrioritySeoPaths, ...tenthPrioritySeoPaths, ...eleventhPrioritySeoPaths, ...twelfthPrioritySeoPaths, ...thirteenthPrioritySeoPaths, ...fourteenthPrioritySeoPaths, ...fifteenthPrioritySeoPaths, ...sixteenthPrioritySeoPaths, ...seventeenthPrioritySeoPaths, ...eighteenthPrioritySeoPaths, ...nineteenthPrioritySeoPaths]);
export const prioritySeoCohort = path => nineteenthPrioritySeoPaths.includes(path) ? 'recovery-19'
  : eighteenthPrioritySeoPaths.includes(path) ? 'recovery-18'
  : seventeenthPrioritySeoPaths.includes(path) ? 'recovery-17'
  : sixteenthPrioritySeoPaths.includes(path) ? 'recovery-16'
  : fifteenthPrioritySeoPaths.includes(path) ? 'recovery-15'
  : fourteenthPrioritySeoPaths.includes(path) ? 'recovery-14'
  : thirteenthPrioritySeoPaths.includes(path) ? 'recovery-13'
  : twelfthPrioritySeoPaths.includes(path) ? 'recovery-12'
  : eleventhPrioritySeoPaths.includes(path) ? 'recovery-11'
  : tenthPrioritySeoPaths.includes(path) ? 'recovery-10'
  : ninthPrioritySeoPaths.includes(path) ? 'recovery-9'
  : eighthPrioritySeoPaths.includes(path) ? 'recovery-8'
  : seventhPrioritySeoPaths.includes(path) ? 'recovery-7'
  : sixthPrioritySeoPaths.includes(path) ? 'recovery-6'
  : fifthPrioritySeoPaths.includes(path) ? 'recovery-5'
  : fourthPrioritySeoPaths.includes(path) ? 'recovery-4'
  : thirdPrioritySeoPaths.includes(path) ? 'recovery-3'
  : secondPrioritySeoPaths.includes(path) ? 'recovery-2' : 'recovery-1';
export const requiresVerifiedSynopsis = path => (secondPrioritySeoPaths.includes(path) || thirdPrioritySeoPaths.includes(path) || fourthPrioritySeoPaths.includes(path) || fifthPrioritySeoPaths.includes(path) || sixthPrioritySeoPaths.includes(path) || seventhPrioritySeoPaths.includes(path) || eighthPrioritySeoPaths.includes(path) || ninthPrioritySeoPaths.includes(path) || tenthPrioritySeoPaths.includes(path) || eleventhPrioritySeoPaths.includes(path) || twelfthPrioritySeoPaths.includes(path) || thirteenthPrioritySeoPaths.includes(path) || fourteenthPrioritySeoPaths.includes(path) || fifteenthPrioritySeoPaths.includes(path) || sixteenthPrioritySeoPaths.includes(path) || seventeenthPrioritySeoPaths.includes(path) || eighteenthPrioritySeoPaths.includes(path) || nineteenthPrioritySeoPaths.includes(path)) && /\/book\//.test(path);

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
