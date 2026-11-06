import assert from 'node:assert/strict';
import test from 'node:test';
import { browseJumpPages } from './browse-jumps.ts';

test('Browse links reach every audited EN and NL page in at most ten clicks', () => {
  for (const pageCount of [1, 2, 5, 210, 399, 1000]) {
    const distance = new Map([[1, 0]]);
    const queue = [1];
    for (const page of queue) {
      const jumps = browseJumpPages(page, pageCount);
      assert.equal(new Set(jumps).size, jumps.length);
      assert(jumps.every(target => target > 1 && target < pageCount && Math.abs(target - page) > 1));
      for (const target of [1, page - 1, page + 1, pageCount, ...jumps]) {
        if (target < 1 || target > pageCount || distance.has(target)) continue;
        distance.set(target, distance.get(page)! + 1);
        queue.push(target);
      }
    }
    assert.equal(distance.size, pageCount);
    assert(Math.max(...distance.values()) <= 10);
  }
});
