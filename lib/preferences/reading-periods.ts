export const READING_PERIODS = [
  'before_1950', '1950_1979', '1980_1999', '2000_2014',
  '2015_present', 'all_periods', 'no_preference',
] as const;

export type ReadingPeriod = typeof READING_PERIODS[number];

export type ReaderEraPreferences = {
  readingPeriods: ReadingPeriod[];
  onboardingDismissed: boolean;
};

export const EMPTY_READER_ERA_PREFERENCES: ReaderEraPreferences = {
  readingPeriods: [],
  onboardingDismissed: false,
};

const specialReadingPeriods = new Set<ReadingPeriod>(['all_periods', 'no_preference']);

export function isReadingPeriod(value: unknown): value is ReadingPeriod {
  return typeof value === 'string' && (READING_PERIODS as readonly string[]).includes(value);
}

export function normalizeReadingPeriods(value: unknown): ReadingPeriod[] | null {
  if (!Array.isArray(value) || !value.every(isReadingPeriod)) return null;
  const unique = [...new Set(value)];
  const special = unique.filter((period) => specialReadingPeriods.has(period));
  if (special.length > 1 || (special.length === 1 && unique.length > 1)) return null;
  return READING_PERIODS.filter((period) => unique.includes(period));
}

export function toggleReadingPeriod(
  current: readonly ReadingPeriod[],
  period: ReadingPeriod,
): ReadingPeriod[] {
  if (current.includes(period)) return current.filter((item) => item !== period);
  if (specialReadingPeriods.has(period)) return [period];
  return [...current.filter((item) => !specialReadingPeriods.has(item)), period];
}

export function readingPeriodContainsYear(period: ReadingPeriod, year: number): boolean {
  if (period === 'all_periods') return true;
  if (period === 'no_preference') return false;
  if (period === 'before_1950') return year < 1950;
  if (period === '1950_1979') return year >= 1950 && year <= 1979;
  if (period === '1980_1999') return year >= 1980 && year <= 1999;
  if (period === '2000_2014') return year >= 2000 && year <= 2014;
  return year >= 2015;
}

export function hasDirectReadingEraPreference(periods: readonly ReadingPeriod[]): boolean {
  return periods.length > 0 && !periods.includes('all_periods') && !periods.includes('no_preference');
}
