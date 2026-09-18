import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DISPLAY_NAME_MAX_LENGTH,
  getAccountAvatarLetter,
  normalizeDisplayName,
  readDisplayName,
} from './display-name.ts';

test('normalizes trimmed Unicode display names without restricting accents', () => {
  assert.deepEqual(normalizeDisplayName('  José van Dijk-Smit  '), {
    ok: true,
    value: 'José van Dijk-Smit',
  });
  assert.deepEqual(normalizeDisplayName("Zoë O'Connor"), {
    ok: true,
    value: "Zoë O'Connor",
  });
  assert.deepEqual(normalizeDisplayName('山田 太郎'), {
    ok: true,
    value: '山田 太郎',
  });
});

test('rejects empty, overlong, control and invisible display names', () => {
  assert.deepEqual(normalizeDisplayName('   '), { ok: false, error: 'required' });
  assert.deepEqual(normalizeDisplayName('a'.repeat(DISPLAY_NAME_MAX_LENGTH + 1)), {
    ok: false,
    error: 'too_long',
  });
  assert.deepEqual(normalizeDisplayName('Jane\nDoe'), {
    ok: false,
    error: 'invalid_characters',
  });
  assert.deepEqual(normalizeDisplayName('Jane\u200bDoe'), {
    ok: false,
    error: 'invalid_characters',
  });
});

test('reads only valid display metadata and derives a safe avatar fallback', () => {
  assert.equal(readDisplayName({ display_name: '  Élodie  ' }), 'Élodie');
  assert.equal(readDisplayName({ display_name: '\u200b' }), null);
  assert.equal(getAccountAvatarLetter('Élodie', 'reader@example.test'), 'É');
  assert.equal(getAccountAvatarLetter(null, 'reader@example.test'), 'R');
  assert.equal(getAccountAvatarLetter(null, null), '?');
});
