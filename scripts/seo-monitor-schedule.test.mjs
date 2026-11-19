import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduledSeoPaths, dailySeoRegressionPaths } from './operations/seo-monitor-schedule.mjs';
import { prioritySeoPaths } from './operations/priority-seo-pages.mjs';

test('weekly rotation checks every monitored URL, without duplicate non-core requests', () => {
  const counts = new Map();
  for (let day = 0; day < 7; day++) {
    const paths = scheduledSeoPaths(prioritySeoPaths, { daily: true, date: new Date(Date.UTC(2026, 10, 15 + day)) });
    assert.equal(new Set(paths).size, paths.length);
    for (const core of dailySeoRegressionPaths.filter(path => prioritySeoPaths.includes(path))) assert.ok(paths.includes(core));
    for (const path of paths) counts.set(path, (counts.get(path) ?? 0) + 1);
    assert.ok(paths.length <= Math.ceil(prioritySeoPaths.length / 7) + dailySeoRegressionPaths.length);
  }
  assert.equal(counts.size, prioritySeoPaths.length);
  for (const [path, count] of counts) assert.equal(count, dailySeoRegressionPaths.includes(path) ? 7 : 1);
});

test('manual full audit remains available and does not mutate the cohort', () => {
  assert.deepEqual(scheduledSeoPaths(prioritySeoPaths), [...prioritySeoPaths]);
  assert.notEqual(scheduledSeoPaths(prioritySeoPaths), prioritySeoPaths);
});

test('rotation is deterministic in UTC and rejects invalid dates', () => {
  assert.deepEqual(scheduledSeoPaths(prioritySeoPaths, { daily: true, date: new Date('2026-11-19T01:00:00Z') }), scheduledSeoPaths(prioritySeoPaths, { daily: true, date: new Date('2026-11-19T23:59:59Z') }));
  assert.throws(() => scheduledSeoPaths(prioritySeoPaths, { daily: true, date: new Date('invalid') }), /Invalid/);
});
