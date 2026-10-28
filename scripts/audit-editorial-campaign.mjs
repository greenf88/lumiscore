// Read-only, bounded public-source review. Input is a public catalogue export, never credentials.
import { readFileSync } from 'node:fs';
import { selectStrictEdition } from '../lib/books/strict-edition.ts';
import { editionSourceCoverUrls } from '../lib/books/edition-cover-evidence.ts';

const [input, rawIds, mode] = process.argv.slice(2);
if (!input || !rawIds || !/^[\d,]+$/.test(rawIds)) throw new Error('Usage: audit-editorial-campaign.mjs public-catalogue.json workIds');
const rows = JSON.parse(readFileSync(input, 'utf8'));
const ids = [...new Set(rawIds.split(',').map(Number))];
if (ids.length > 120) throw new Error('Review is limited to 120 Works');
if (mode === '--works') {
  const output = [];
  for (let offset = 0; offset < ids.length; offset += 30) {
    const group = ids.slice(offset, offset + 30).map(id => rows.find(w => w.id === id)).filter(Boolean);
    const keys = group.map(w => '/works/' + w.source);
    const response = await fetch('https://openlibrary.org/api/get_many?keys=' + encodeURIComponent(JSON.stringify(keys)), { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Open Library HTTP ' + response.status);
    const data = (await response.json()).result;
    for (const w of group) {
      const source = data['/works/' + w.source];
      const description = source?.description;
      output.push({ id: w.id, title: source?.title, description: (typeof description === 'string' ? description : description?.value ?? '').slice(0, 900), subjects: source?.subjects?.slice(0, 12) ?? [], links: source?.links ?? [] });
    }
  }
  console.log(JSON.stringify(output));
  process.exit(0);
}
const selected = ids.flatMap(id => {
  const work = rows.find(w => w.id === id);
  if (!work) return [{ workId: id, missing: true }];
  return ['nl', 'en'].map(locale => ({ workId: id, locale, work, edition: selectStrictEdition(work.editions, locale, work.title) }));
});
const keys = [...new Set(selected.filter(s => s.edition?.open_library_edition_id).map(s => '/books/' + s.edition.open_library_edition_id))];
const evidence = {};
for (let offset = 0; offset < keys.length; offset += 40) {
  const response = await fetch('https://openlibrary.org/api/get_many?keys=' + encodeURIComponent(JSON.stringify(keys.slice(offset, offset + 40))), { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Open Library returned HTTP ' + response.status);
  Object.assign(evidence, (await response.json()).result);
}
const result = selected.map(s => {
  if (s.missing || !s.edition) return { workId: s.workId, locale: s.locale, error: 'no suitable edition' };
  const e = s.edition;
  const source = evidence['/books/' + e.open_library_edition_id];
  const book = { editionAvailable: true, openLibraryWorkId: s.work.source, openLibraryEditionId: e.open_library_edition_id, editionLanguage: e.language, editionTitle: e.title, title: e.title, isbn13: e.isbn_13 };
  const checked = editionSourceCoverUrls(book, source);
  const description = source?.description;
  return { workId: s.workId, locale: s.locale, title: e.title, author: s.work.author, sourceWork: s.work.source, editionId: e.id,
    editionSource: e.open_library_edition_id, isbn: e.isbn_13, language: e.language,
    format: source?.physical_format ?? source?.pagination ?? null, pages: source?.number_of_pages ?? null,
    verified: checked, sourceDescription: (typeof description === 'string' ? description : description?.value ?? '').slice(0, 600),
    sourceSubjects: (source?.subjects ?? []).slice(0, 8),
    checkedAt: new Date().toISOString() };
});
console.log(JSON.stringify([...new Map(result.map(r => [r.editionId ?? r.workId, r])).values()]));
