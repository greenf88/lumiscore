import { METRIC_EVENTS, parseMetric } from './contract.ts';
export type CounterRow = { day: string; event: string; dimensions: Record<string, unknown>; n: number };
export function productMeasurementReport(input: { available: boolean; period: { from: string; through: string }; rows: CounterRow[]; includeSynthetic?: boolean }) {
  const unavailable = (note: string) => ({ period: input.period, available: false, scope: input.includeSynthetic ? 'synthetic' : 'production', counts: null, ratios: null, excludedSynthetic: input.rows.filter(r => r.dimensions.traffic === 'synthetic').reduce((n, r) => n + r.n, 0), note });
  if (!input.available) return unavailable('Instrumentation/storage unavailable; not zero.');
  const counts = Object.fromEntries(METRIC_EVENTS.map(event => [event, 0]));
  let excludedSynthetic = 0, excludedUnknown = 0;
  const rows: CounterRow[] = [];
  for (const row of input.rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.day) || row.day < input.period.from || row.day > input.period.through || !Number.isSafeInteger(row.n) || row.n < 0 || !parseMetric({ event_id: 'b0000000-0000-4000-8000-000000000001', event: row.event, properties: row.dimensions })) throw Error('Invalid measurement report row');
    if (row.dimensions.traffic === 'synthetic' && !input.includeSynthetic) { excludedSynthetic += row.n; continue; }
    if (!row.dimensions.traffic) { excludedUnknown += row.n; continue; }
    rows.push(row); counts[row.event] += row.n;
  }
  if (!input.includeSynthetic && !rows.length) return unavailable('Production collection is inactive. Synthetic/unknown-origin events are not a production baseline.');
  const ratio = (numerator: number, denominator: number) => ({ numerator, denominator, value: denominator ? numerator / denominator : null, unit: 'event ratio; not visitor conversion' });
  const sum = (event: string, match: (row: CounterRow) => boolean = () => true) => rows.filter(r => r.event === event && match(r)).reduce((n, r) => n + r.n, 0);
  const campaign = (r: CounterRow) => r.dimensions.campaign === 'dystopie_202610' && r.dimensions.source === 'facebook';
  return { period: input.period, available: true, scope: input.includeSynthetic ? 'synthetic' : 'production', counts, rows, excludedSynthetic, excludedUnknown,
    units: { pageViews: 'page_opened events, including new document loads; not unique visits', sessions: null, users: null, uniquePeople: null },
    campaign: { pageViews: sum('page_opened', campaign), listOpens: sum('editorial_list_opened', campaign), bookClicks: sum('book_card_opened', campaign), newRatings: sum('rating_saved', r => campaign(r) && r.dimensions.operation === 'new'), changedRatings: sum('rating_saved', r => campaign(r) && r.dimensions.operation === 'updated') },
    ratios: { opensPerImpression: ratio(counts.recommendation_open, counts.recommendation_impression), completedPerStarted: ratio(counts.taste_round_completed, counts.taste_round_started), campaignClicksPerListOpen: ratio(sum('book_card_opened', campaign), sum('editorial_list_opened', campaign)) },
    linkedFunnelConversion: null,
    note: 'Aggregate event counts and unlinked event ratios only. No session/user identifiers: unique visits, person conversion, exact drop-off and retention are unknown. Ratios may exceed 1; starts/completions can cross periods. DNT/GPC, blocked JS, offline drops, unknown referrers, 90-day retention, rate limiting and busy/outage loss limit coverage. 517 ratings/19 rounds are unvalidated historical reports, not this baseline.' };
}
