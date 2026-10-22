'use client';
import { BROWSER_METRIC_EVENTS, campaignContext, measurementTestTarget, METRIC_CONTEXT_HEADER, parseMetric, parseMetricContext, type MetricContext, type MetricEvent, type MetricProperties, type MetricEnvelope } from './contract.ts';
const STORAGE_KEY = 'lumiscore-campaign-v1', MAX_AGE = 30 * 60_000;
let queue: MetricEnvelope[] = [], scheduled: ReturnType<typeof setTimeout> | null = null;
export function browserMetricsEnabled(): boolean {
  return typeof window !== 'undefined' && measurementTestTarget(process.env.NEXT_PUBLIC_SUPABASE_URL) && navigator.doNotTrack !== '1' && !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
}
export function browserMetricContext(locale: 'nl' | 'en', surface?: MetricContext['surface']): MetricContext | null {
  if (!browserMetricsEnabled()) return null;
  let prior: MetricContext | null = null;
  try { const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null'); if (saved && typeof saved.expires === 'number' && saved.expires > Date.now() && saved.expires <= Date.now() + MAX_AGE) prior = parseMetricContext(saved.context); } catch { /* Blocked storage does not block the app. */ }
  const context = campaignContext(location.href, document.referrer, locale, prior);
  if (surface) context.surface = surface;
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ expires: Date.now() + MAX_AGE, context })); } catch { /* Attribution unavailable across navigation. */ }
  return context;
}
export function measurementHeaders(locale: 'nl' | 'en', surface?: MetricContext['surface']): Record<string, string> {
  const context = browserMetricContext(locale, surface);
  return context ? { [METRIC_CONTEXT_HEADER]: JSON.stringify(context) } : {};
}
export function flushBrowserMetrics() {
  if (scheduled !== null) clearTimeout(scheduled);
  scheduled = null;
  if (!browserMetricsEnabled()) { queue = []; return; }
  const events = queue.splice(0, 10);
  if (!events.length) return;
  void fetch('/api/product-metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events }), keepalive: true, credentials: 'same-origin' }).catch(() => undefined);
}
export function emitBrowserMetric(event: MetricEvent, properties: MetricProperties, eventId = crypto.randomUUID()) {
  if (!browserMetricsEnabled() || !BROWSER_METRIC_EVENTS.includes(event)) return;
  const context = browserMetricContext(properties.locale, properties.surface), envelope = parseMetric({ event_id: eventId, event, properties: { ...context, ...properties } });
  if (!envelope || queue.length >= 20) return;
  queue.push(envelope);
  if (scheduled === null) scheduled = setTimeout(flushBrowserMetrics, 100);
}
