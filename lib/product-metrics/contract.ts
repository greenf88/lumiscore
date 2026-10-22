export const METRIC_EVENTS = ['recommendation_impression', 'recommendation_open', 'want_to_read_saved', 'taste_round_started', 'taste_round_completed', 'page_opened', 'editorial_list_opened', 'book_card_opened', 'book_detail_opened', 'rating_saved', 'taste_result_opened', 'sign_in_succeeded'] as const;
export const METRIC_SURFACES = ['home', 'recommendations', 'taste_result', 'book_detail', 'collection', 'editorial', 'browse', 'login', 'taste_test', 'other'] as const;
export const RANKER_VERSION = '8f337dd';
export const METRIC_CONTEXT_HEADER = 'x-lumiscore-product-context';
export type MetricEvent = typeof METRIC_EVENTS[number];
export type MetricContext = { locale: 'nl' | 'en'; surface: typeof METRIC_SURFACES[number]; source: 'facebook' | 'google' | 'bing' | 'other_search' | 'direct_unknown'; medium: 'organic_social' | 'organic_search' | 'unknown'; campaign: 'dystopie_202610' | 'none'; traffic: 'synthetic' };
export type MetricProperties = { locale: 'nl' | 'en'; surface?: typeof METRIC_SURFACES[number]; work_id?: number; position?: number; ranker_version?: string; goal?: number; source?: MetricContext['source']; medium?: MetricContext['medium']; campaign?: MetricContext['campaign']; traffic?: 'synthetic'; list_id?: 'dystopie-vanaf-1990' | 'other'; operation?: 'new' | 'updated' };
export type MetricEnvelope = { event_id: string; event: MetricEvent; properties: MetricProperties };
export const isMetricReceipt = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const exact = (object: Record<string, unknown>, keys: readonly string[]) => Object.keys(object).every(k => keys.includes(k));
export function measurementTestTarget(url: string | undefined | null): boolean {
  try { return new URL(url ?? '').origin === 'https://hlvujbrmfdlrfxdjwsmb.supabase.co'; } catch { return false; }
}
export function parseMetricContext(value: unknown): MetricContext | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (!exact(p, ['locale', 'surface', 'source', 'medium', 'campaign', 'traffic']) || !['nl', 'en'].includes(String(p.locale)) || !METRIC_SURFACES.includes(p.surface as MetricContext['surface']) || p.traffic !== 'synthetic') return null;
  const attributed = p.source === 'facebook' && p.medium === 'organic_social' && p.campaign === 'dystopie_202610';
  const search = ['google', 'bing', 'other_search'].includes(String(p.source)) && p.medium === 'organic_search' && p.campaign === 'none';
  const unknown = p.source === 'direct_unknown' && p.medium === 'unknown' && p.campaign === 'none';
  return attributed || search || unknown ? p as MetricContext : null;
}
export function parseMetric(value: unknown): MetricEnvelope | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!exact(v, ['event_id', 'event', 'properties']) || !isMetricReceipt(v.event_id) || !METRIC_EVENTS.includes(v.event as MetricEvent)) return null;
  if (!v.properties || typeof v.properties !== 'object' || Array.isArray(v.properties)) return null;
  const p = v.properties as Record<string, unknown>, event = v.event as MetricEvent;
  if (!['nl', 'en'].includes(String(p.locale))) return null;
  const contextKeys = ['source', 'medium', 'campaign', 'traffic'];
  const hasContext = contextKeys.some(k => k in p);
  if (hasContext && !parseMetricContext(Object.fromEntries(['locale', 'surface', ...contextKeys].map(k => [k, p[k]])))) return null;
  const common = ['locale', 'surface', ...contextKeys];
  const round = event.startsWith('taste_round_'), recommendation = event.startsWith('recommendation_');
  const book = recommendation || ['want_to_read_saved', 'book_card_opened', 'book_detail_opened', 'rating_saved'].includes(event);
  const allowed = [...common, ...(round ? ['goal'] : []), ...(book ? ['work_id'] : []), ...(recommendation ? ['position', 'ranker_version'] : []), ...(event === 'want_to_read_saved' ? ['ranker_version'] : []), ...(['editorial_list_opened', 'book_card_opened'].includes(event) ? ['list_id'] : []), ...(event === 'rating_saved' ? ['operation'] : [])];
  if (!exact(p, allowed)) return null;
  if (p.surface !== undefined && !METRIC_SURFACES.includes(p.surface as MetricContext['surface'])) return null;
  if (round && (typeof p.goal !== 'number' || ![10, 15, 20, 30].includes(p.goal))) return null;
  if (book && (typeof p.work_id !== 'number' || !Number.isSafeInteger(p.work_id) || p.work_id < 1)) return null;
  if (!round && !METRIC_SURFACES.includes(p.surface as MetricContext['surface'])) return null;
  if (recommendation && (typeof p.position !== 'number' || !Number.isInteger(p.position) || p.position < 1 || p.position > 100 || p.ranker_version !== RANKER_VERSION)) return null;
  if (p.ranker_version !== undefined && p.ranker_version !== RANKER_VERSION) return null;
  if (p.list_id !== undefined && !['dystopie-vanaf-1990', 'other'].includes(String(p.list_id))) return null;
  if (event === 'rating_saved' && !['new', 'updated'].includes(String(p.operation))) return null;
  return value as MetricEnvelope;
}
export const BROWSER_METRIC_EVENTS: readonly MetricEvent[] = ['recommendation_impression', 'recommendation_open', 'page_opened', 'editorial_list_opened', 'book_card_opened', 'book_detail_opened', 'taste_result_opened'];
export function metricSurfaceForPath(path: string): MetricContext['surface'] {
  const p = path.replace(/^\/(nl|en)(?=\/|$)/, '') || '/';
  if (p === '/') return 'home';
  if (/^\/books?\/\d+\/?$/.test(p)) return 'book_detail';
  if (/^\/toplijsten\/[^/]+\/?$/.test(p)) return 'editorial';
  if (p === '/taste-test/result') return 'taste_result';
  if (p === '/taste-test') return 'taste_test';
  if (p === '/login') return 'login';
  if (p === '/browse' || p === '/search') return 'browse';
  if (p === '/recommendations') return 'recommendations';
  if (p.startsWith('/collection/')) return 'collection';
  return 'other';
}
export function campaignContext(url: string, referrer: string, locale: 'nl' | 'en', prior: MetricContext | null = null): MetricContext {
  const current = new URL(url), surface = metricSurfaceForPath(current.pathname);
  const base: MetricContext = { locale, surface, source: 'direct_unknown', medium: 'unknown', campaign: 'none', traffic: 'synthetic' };
  if (current.searchParams.get('utm_source') === 'facebook' && current.searchParams.get('utm_medium') === 'organic_social' && current.searchParams.get('utm_campaign') === 'dystopie_202610') return { ...base, source: 'facebook', medium: 'organic_social', campaign: 'dystopie_202610' };
  if ([...current.searchParams.keys()].some(k => k.startsWith('utm_'))) return base;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    const source = ['google.com', 'www.google.com', 'google.nl', 'www.google.nl'].includes(host) ? 'google' : ['bing.com', 'www.bing.com'].includes(host) ? 'bing' : ['duckduckgo.com', 'www.duckduckgo.com'].includes(host) ? 'other_search' : null;
    if (source) return { ...base, source, medium: 'organic_search' };
  } catch { /* Absent/private referrer remains unknown. */ }
  return prior ? { ...prior, locale, surface } : base;
}
export function impressionTimer(send: () => void, schedule: (f: () => void) => ReturnType<typeof setTimeout> = f => setTimeout(f, 1000), cancel: (id: ReturnType<typeof setTimeout>) => void = clearTimeout) {
  let timer: ReturnType<typeof setTimeout> | null = null, impressed = false;
  return { visible(fraction: number) { if (impressed) return; if (fraction >= .5) { if (timer === null) timer = schedule(() => { timer = null; impressed = true; send(); }); } else if (timer !== null) { cancel(timer); timer = null; } }, stop() { if (timer !== null) cancel(timer); timer = null; }, get impressed() { return impressed; } };
}
