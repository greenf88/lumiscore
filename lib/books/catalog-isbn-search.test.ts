import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCatalogIsbn } from './catalog-search.ts';

test('recognize the Dog Man ISBN with or without conventional separators', () => {
  for (const query of ['9789493474758', '978-94-93474-75-8', '978 94 93474 75 8', '978‑94‑93474‑75‑8', '９７８９４９３４７４７５８']) {
    assert.equal(normalizeCatalogIsbn(query), '9789493474758', query);
  }
});

test('allow complete ISBN-10 with a check digit X and leave other search terms alone', () => {
  assert.equal(normalizeCatalogIsbn('0-8044-2957-x'), '080442957X');
  for (const query of ['9789493474759', '978949347', '9789493474758 Dog Man', '2001: A Space Odyssey', 'Dav Pilkey', '0-8044-2957-9']) {
    assert.equal(normalizeCatalogIsbn(query), null, query);
  }
});
