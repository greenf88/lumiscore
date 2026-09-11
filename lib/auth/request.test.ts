import assert from 'node:assert/strict';
import test from 'node:test';
import { getSafeNextPath } from './request.ts';

test('allows only same-site relative return paths', () => {
  assert.equal(getSafeNextPath('/book/8?from=login'), '/book/8?from=login');
  assert.equal(getSafeNextPath('https://example.com'), '/');
  assert.equal(getSafeNextPath('//example.com/path'), '/');
  assert.equal(getSafeNextPath(null, '/login'), '/login');
});
