import test from 'node:test';
import assert from 'node:assert/strict';
import { newSearchObservation, searchObservationEvent } from './search-observation.ts';
import { createSearchSelectionCache, type PublicSearchSelection } from './search-selection-cache.ts';

test('operational search event permits counters only, never query/IDs/profile/rating fields', () => {
  const value = Object.assign(newSearchObservation('nl'), { databaseRequests: 9, worksLoaded: 300, editionsLoaded: 603,
    query: 'DO_NOT_LOG_QUERY', userId: 'DO_NOT_LOG_USER', workIds: ['DO_NOT_LOG_WORK'], scores: [9] });
  const event = searchObservationEvent(value);
  assert.equal(event.event, 'public_search_counts'); assert.equal(event.dataClass, 'public');
  assert.equal(event.worksLoaded, 300); assert.equal(event.editionsLoaded, 603);
  assert.doesNotMatch(JSON.stringify(event), /DO_NOT_LOG|query|userId|workIds|"scores":/);
});

test('cache observer distinguishes fresh, shared pending and actual cache without reloading', async () => {
  const cached = createSearchSelectionCache(), statuses: string[] = [];
  const value: PublicSearchSelection = { books: [], aliases: new Map(), categories: [], selectedAuthor: null };
  const read = async () => value, observe = (state: string) => { statuses.push(state); };
  await Promise.all([cached('same', read, observe), cached('same', read, observe)]);
  await cached('same', read, observe);
  assert.deepEqual(statuses, ['fresh', 'coalesced', 'cache']);
});
