import assert from 'node:assert/strict';
import test from 'node:test';
import { hasRecentRecoveryAuthentication, validatePasswordUpdate } from './password-recovery.ts';
import { getSafeNextPath } from './request.ts';

test('recent recovery boundary includes 900s and 60s clock skew, but no password-only session', () => {
  const now = 2_000_000_000;
  const recovery = (timestamp: number) => ({ amr: [{ method: 'recovery', timestamp }] });
  assert.equal(hasRecentRecoveryAuthentication(recovery(now - 900), now), true);
  assert.equal(hasRecentRecoveryAuthentication(recovery(now - 901), now), false);
  assert.equal(hasRecentRecoveryAuthentication(recovery(now + 60), now), true);
  assert.equal(hasRecentRecoveryAuthentication(recovery(now + 61), now), false);
  assert.equal(hasRecentRecoveryAuthentication({ amr: [{ method: 'password', timestamp: now }] }, now), false);
  assert.equal(hasRecentRecoveryAuthentication({ amr: [{ method: 'recovery', timestamp: String(now) }] }, now), false);
  assert.equal(hasRecentRecoveryAuthentication(recovery(Number.NaN), now), false);
  assert.equal(hasRecentRecoveryAuthentication(recovery(Number.POSITIVE_INFINITY), now), false);
});

test('app minimum counts Unicode codepoints, not UTF-16 units; malformed values fail', () => {
  const seven = '📖'.repeat(7);
  const eight = '📖'.repeat(8);
  assert.equal(validatePasswordUpdate(seven, seven).ok, false);
  assert.equal(validatePasswordUpdate(eight, eight).ok, true);
  for (const password of [null, undefined, 12345678, {}, []]) {
    assert.equal(validatePasswordUpdate(password, password).ok, false);
  }
  assert.equal(validatePasswordUpdate('12345678', '12345679').ok, false);
});

test('return URL keeps legitimate state but refuses external/control-character paths', () => {
  assert.equal(getSafeNextPath('/browse?sort=highest&page=2#books'), '/browse?sort=highest&page=2#books');
  for (const path of ['https://outside.example/', '//outside.example/', '/\\outside.example/', '/\noutside']) {
    assert.equal(getSafeNextPath(path), '/');
  }
});
