import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  INFORMATION_PAGE_KEYS,
  getInformationPageContent,
  serializeInformationPageJsonLd,
  type InformationTextPart,
} from './pages.ts';

const EXPECTED_PATHS = {
  about: '/over-ons',
  howItWorks: '/zo-werkt-het',
  publishers: '/voor-uitgevers',
  contact: '/contact',
} as const;

function linksFrom(parts: InformationTextPart[] | undefined) {
  return (parts ?? []).flatMap((part) =>
    typeof part === 'string' ? [] : [part.href],
  );
}

test('all information routes exist and use the shared public route renderer', async () => {
  for (const [key, path] of Object.entries(EXPECTED_PATHS)) {
    const source = await readFile(
      new URL(`../../app${path}/page.tsx`, import.meta.url),
      'utf8',
    );
    assert.match(source, /LumiScoreInformationRoute/);
    assert.match(source, new RegExp(`pageKey="${key}"`));
    assert.match(source, /generateMetadata/);
  }
});

test('Dutch and English pages have unique SEO metadata and stable canonicals', () => {
  for (const locale of ['nl', 'en'] as const) {
    const pages = INFORMATION_PAGE_KEYS.map((key) =>
      getInformationPageContent(key, locale),
    );
    assert.equal(new Set(pages.map((page) => page.path)).size, 4);
    assert.equal(new Set(pages.map((page) => page.seoTitle)).size, 4);
    assert.equal(new Set(pages.map((page) => page.seoDescription)).size, 4);
    for (const page of pages) {
      assert.equal(page.path, EXPECTED_PATHS[page.key]);
      assert.ok(page.title.length > 0);
      assert.ok(page.lead.length > 0);
      assert.match(page.seoTitle, /LumiScore/);
      assert.ok(page.seoDescription.length >= 80);
    }
  }
});

test('structured data is valid, localized and matches each visible page', () => {
  for (const locale of ['nl', 'en'] as const) {
    for (const key of INFORMATION_PAGE_KEYS) {
      const page = getInformationPageContent(key, locale);
      const structured = JSON.parse(serializeInformationPageJsonLd(page));
      assert.equal(Array.isArray(structured), true);
      assert.equal(structured[0]['@type'], page.schemaType);
      assert.equal(structured[0].name, page.title);
      assert.equal(structured[0].description, page.seoDescription);
      assert.equal(structured[1]['@type'], 'BreadcrumbList');
      assert.equal(structured[1].itemListElement[1].name, page.title);
      assert.match(structured[0].url, new RegExp(`${page.path}$`));
    }
  }
});

test('information links are real internal routes and mail links use the approved address', () => {
  const allowedInternalPaths = new Set([
    '/browse',
    '/collections',
    '/over-ons',
    '/zo-werkt-het',
    '/voor-uitgevers',
    '/login?next=%2Fzo-werkt-het',
  ]);

  for (const locale of ['nl', 'en'] as const) {
    for (const key of INFORMATION_PAGE_KEYS) {
      const page = getInformationPageContent(key, locale);
      const links = page.sections.flatMap((section) => [
        ...(section.paragraphs ?? []).flatMap(linksFrom),
        ...(section.afterBullets ?? []).flatMap(linksFrom),
      ]);
      for (const href of links) assert.equal(allowedInternalPaths.has(href), true, href);
    }

    const publisherEmail = getInformationPageContent('publishers', locale)
      .sections.flatMap((section) => section.email ? [section.email] : [])[0];
    const contactEmail = getInformationPageContent('contact', locale)
      .sections.flatMap((section) => section.email ? [section.email] : [])[0];
    assert.equal(publisherEmail?.address, 'hello@lumisco.re');
    assert.equal(
      publisherEmail?.href,
      'mailto:hello@lumisco.re?subject=Vraag%20van%20uitgever%20over%20LumiScore',
    );
    assert.equal(contactEmail?.address, 'hello@lumisco.re');
    assert.equal(
      contactEmail?.href,
      'mailto:hello@lumisco.re?subject=Contact%20via%20LumiScore',
    );
  }
});

test('information navigation is complete on desktop footer and mobile menu', async () => {
  const [home, translations, styles, route] = await Promise.all([
    readFile(new URL('../../app/components/LumiScoreHome.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../i18n/translations.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../app/globals.css', import.meta.url), 'utf8'),
    readFile(new URL('../../app/components/LumiScoreInformationRoute.tsx', import.meta.url), 'utf8'),
  ]);

  for (const path of Object.values(EXPECTED_PATHS)) {
    assert.match(home, new RegExp(`href="${path}"`, 'g'));
  }
  assert.match(translations, /'footer\.about': 'About us'/);
  assert.match(translations, /'footer\.about': 'Over ons'/);
  assert.match(translations, /'footer\.contact': 'Contact'/);
  assert.doesNotMatch(translations, /'footer\.help'/);
  assert.doesNotMatch(translations, /'footer\.helpComing'/);
  assert.match(home, /mobile-navigation-panel[\s\S]*href="\/over-ons"[\s\S]*href="\/contact"/);
  assert.match(styles, /\.information-page-shell[^}]*var\(--bg\)/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*\.information-page/);
  assert.match(route, /\.catch\(\(\) => \(\{ authenticated: false \}\)\)/);
});

test('information content contains no known address or deployment-host typos', () => {
  const serialized = JSON.stringify(
    (['nl', 'en'] as const).flatMap((locale) =>
      INFORMATION_PAGE_KEYS.map((key) => getInformationPageContent(key, locale)),
    ),
  );
  assert.doesNotMatch(serialized, /lumiscor\.re/i);
  assert.doesNotMatch(serialized, /hel[l]@/i);
  assert.doesNotMatch(serialized, /vercel\.app/i);
});
