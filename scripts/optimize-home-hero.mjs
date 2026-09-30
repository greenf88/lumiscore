// Deterministic derivatives of the existing artwork; no crop or color changes.
// sharp is supplied by the pinned Next dependency in pnpm-lock.yaml.
import { createRequire } from 'node:module';
import { mkdir, stat, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.resolve('next/package.json'));
const sharp = require('sharp');
const results = [];
for (const name of ['dark-reading-scene', 'light-book-stack']) {
  const source = `public/assets/${name}.png`;
  results.push({ file: source, bytes: (await stat(source)).size, width: 1536, height: 1024 });
  for (const width of [1024, 1536]) {
    for (const format of ['avif', 'webp']) {
      const file = `public/assets/${name}-${width}.${format}`;
      const result = await sharp(source).resize({ width, withoutEnlargement: true })
        .toFormat(format, { quality: format === 'avif' ? 60 : 85, effort: 6 }).toFile(file);
      results.push({ file, bytes: result.size, width: result.width, height: result.height });
    }
  }
}
await mkdir('reports/seo-hero', { recursive: true });
await writeFile('reports/seo-hero/image-sizes.json', JSON.stringify({ sharp: sharp.versions.sharp, results }, null, 2));
console.log(JSON.stringify(results, null, 2));
