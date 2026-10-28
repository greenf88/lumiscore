// Deterministic own typography only; never republish book covers as a collage.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const { lists } = JSON.parse(readFileSync(new URL('../lib/catalog/editorial-campaigns-20261028.json', import.meta.url), 'utf8'));
const destination = resolve('public/images/editorial');
mkdirSync(destination, { recursive: true });
const xml = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function lines(text) {
  return text.split(' ').reduce((rows, word) => {
    const last = rows.at(-1);
    if (!last || (last + ' ' + word).length > 32) rows.push(word);
    else rows[rows.length - 1] += ' ' + word;
    return rows;
  }, []);
}
for (const list of lists) for (const locale of ['nl', 'en']) {
  const title = lines(list.title[locale]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#f4efe6"/><rect x="42" y="36" width="1116" height="558" rx="20" fill="#fffdf8" stroke="#d8d6cd"/><path d="M88 77v30m12-35v35m12-27v27" fill="none" stroke="#42646b" stroke-width="6" stroke-linecap="round"/><text x="136" y="105" font-family="Georgia,serif" font-size="39" fill="#42646b">LumiScore</text><text x="88" y="174" font-family="Arial,sans-serif" font-size="23" letter-spacing="3" fill="#536164">${locale === 'nl' ? '10 REDACTIONELE LEESTIPS' : '10 EDITORIAL READING CHOICES'}</text>${title.map((line, index) => `<text x="88" y="${255+index*70}" font-family="Georgia,serif" font-size="56" fill="#1f2328">${xml(line)}</text>`).join('')}<rect x="88" y="491" width="390" height="58" rx="6" fill="#42646b"/><text x="112" y="528" font-family="Arial,sans-serif" font-size="24" fill="#fff">${locale === 'nl' ? 'Ontdek de leesroute →' : 'Explore the reading route →'}</text><text x="1085" y="531" text-anchor="end" font-family="Arial,sans-serif" font-size="24" fill="#536164">lumisco.re</text></svg>`;
  const file = resolve(destination, list.slug + '-' + locale + '.png');
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);
  console.log(file);
}
