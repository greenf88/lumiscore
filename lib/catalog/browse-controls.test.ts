import test from 'node:test';
import assert from 'node:assert/strict';
import { browseFilterChips, browseFilterGroupCount, clearBrowseFilters } from './browse-controls.ts';
import { editorialHref, editorialQuery } from './editorial-query.ts';
import { getSafeBrowseReturnPath } from '../navigation/browse-return.ts';
import { translate } from '../i18n/translations.ts';

const categories = [{ id: 'fiction_fantasy', nl: 'Fantasy', en: 'Fantasy' },
  { id: 'fiction_mystery_crime', nl: 'Detectives & misdaadfictie', en: 'Mystery & Crime Fiction' }];
const state = editorialQuery({ q: 'Een boek', author: '42', category: categories.map(c => c.id),
  language: ['nl', 'en'], selection: 'lumiscore-selectie-1000', page: '4', pageSize: '128', sort: 'highest' });

test('badge counts content groups, not individual checkboxes, sorting, page or display settings', () => {
  assert.equal(browseFilterGroupCount(editorialQuery({ pageSize: '128', sort: 'newest', page: '4' })), 0);
  assert.equal(browseFilterGroupCount(state), 5);
  assert.equal(browseFilterGroupCount(editorialQuery({ category: categories.map(c => c.id), language: ['nl', 'en'] })), 2);
});

test('each chip removes only its own applied filter and resets pagination while retaining other context', () => {
  const chips = browseFilterChips(state, categories, { id: '42', name: 'Auteur A' }, 'nl');
  assert.equal(chips.length, 7);
  for (const chip of chips) {
    const url = new URL(chip.href, 'https://lumisco.re');
    assert.ok(getSafeBrowseReturnPath(chip.href));
    const next = editorialQuery(Object.fromEntries([...new Set(url.searchParams.keys())].map(k => [k, url.searchParams.getAll(k)])));
    assert.equal(next.page, 1); assert.equal(next.sort, 'highest'); assert.equal(next.pageSize, 128);
    assert.equal(next.query, chip.key === 'q' ? '' : state.query);
    assert.equal(next.author, chip.key === 'author' ? '' : state.author);
    assert.equal(next.selection, chip.key === 'selection' ? '' : state.selection);
    assert.deepEqual(next.categories, state.categories.filter(id => chip.key !== `category-${id}`));
    assert.deepEqual(next.languages, state.languages.filter(id => chip.key !== `language-${id}`));
  }
  assert.match(chips[1].label, /Auteur A/);
});

test('clear all preserves display and sort, removes every content group, and does not mutate original state', () => {
  const cleared = clearBrowseFilters(state);
  assert.equal(browseFilterGroupCount(cleared), 0); assert.equal(cleared.page, 1);
  assert.equal(cleared.sort, 'highest'); assert.equal(cleared.pageSize, 128);
  assert.equal(state.categories.length, 2); assert.equal(state.page, 4);
  assert.ok(getSafeBrowseReturnPath(editorialHref('/browse', cleared)));
});

test('empty filters create no chips; unknown category stays removable, never fabricated as a public category', () => {
  assert.deepEqual(browseFilterChips(editorialQuery({}), [], null, 'en'), []);
  const chips = browseFilterChips(editorialQuery({ category: 'not_in_facets', author: '42' }), [], null, 'en');
  assert.equal(chips[0].label, 'Author: #42'); assert.equal(chips[1].label, 'not_in_facets');
  assert.ok(getSafeBrowseReturnPath(chips[1].href));
});

test('chip values use URL encoding and cannot create external return destinations', () => {
  const query = editorialQuery({ q: 'a&author=9?returnTo=https://other.example', author: '42' });
  const chip = browseFilterChips(query, [], { id: '42', name: '<script>test</script>' }, 'en')[1];
  assert.equal(new URL(chip.href, 'https://lumisco.re').pathname, '/browse');
  assert.equal(new URL(chip.href, 'https://lumisco.re').searchParams.get('q'), query.query);
});

test('new Browse copy is complete in NL/EN with no changes to public rating thresholds', () => {
  assert.equal(translate('nl', 'browse.searchPlaceholder'), 'Zoek op titel of auteur');
  assert.equal(translate('en', 'browse.heading'), 'Discover books');
  assert.equal(translate('nl', 'browse.noReliableScore'), 'Nog geen betrouwbare score');
  assert.equal(translate('en', 'browse.noReliableScore'), 'Not enough ratings');
  assert.equal(translate('en', 'browse.resultCount', { count: 0 }), '0 results');
  assert.equal(translate('nl', 'browse.resultCountOne'), '1 resultaat');
  assert.equal(translate('en', 'browse.activeGroupOne'), '1 active filter group');
});
