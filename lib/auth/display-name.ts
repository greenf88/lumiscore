export const DISPLAY_NAME_MAX_LENGTH = 40;

export type DisplayNameValidationError =
  | 'required'
  | 'too_long'
  | 'invalid_characters';

export type DisplayNameValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: DisplayNameValidationError };

const CONTROL_OR_INVISIBLE_CHARACTER = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const NON_STANDARD_SPACE = /[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/u;

export function normalizeDisplayName(value: unknown): DisplayNameValidationResult {
  if (typeof value !== 'string') return { ok: false, error: 'required' };

  const displayName = value.trim().normalize('NFC');
  if (!displayName) return { ok: false, error: 'required' };
  if ([...displayName].length > DISPLAY_NAME_MAX_LENGTH) {
    return { ok: false, error: 'too_long' };
  }
  if (
    CONTROL_OR_INVISIBLE_CHARACTER.test(displayName) ||
    NON_STANDARD_SPACE.test(displayName)
  ) {
    return { ok: false, error: 'invalid_characters' };
  }

  return { ok: true, value: displayName };
}

export function readDisplayName(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  const result = normalizeDisplayName(metadata?.display_name);
  return result.ok ? result.value : null;
}

export function getAccountAvatarLetter(
  displayName: string | null,
  email: string | null | undefined,
): string {
  const source = displayName ?? email?.trim() ?? '';
  const first = [...source][0];
  if (!first) return '?';

  return [...first.toLocaleUpperCase()][0] ?? '?';
}
