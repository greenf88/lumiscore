export const NEW_ACCOUNT_PASSWORD_MIN_LENGTH = 8;

export function isValidNewAccountPassword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    [...value].length >= NEW_ACCOUNT_PASSWORD_MIN_LENGTH
  );
}
