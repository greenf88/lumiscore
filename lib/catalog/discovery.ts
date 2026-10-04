export type PublicCategory = { id: string; nl: string; en: string };
export type AuthorOption = { id: string; name: string };
export function recommendationLimit(value: unknown): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 10 && n <= 25 ? n : 20;
}
export function recommendationReturnPath(value: unknown): string | null {
  if (value === '/taste-test/result') return value;
  if (value === '/bookmatch') return value;
  if (typeof value !== 'string' || !/^\/recommendations(?:\?limit=\d{2})?$/.test(value)) return null;
  const n = new URL(value, 'https://lumisco.re').searchParams.get('limit');
  return n === null ? '/recommendations' : Number(n) >= 10 && Number(n) <= 25 ? `/recommendations?limit=${Number(n)}` : null;
}
