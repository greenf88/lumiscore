'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { RecommendationsSection } from './LumiScoreHome';
import type { HomepagePersonalization } from '@/lib/supabase/taste-test';
import { parseGuestTasteTestAnswers, getGuestTasteTestProgress, TASTE_TEST_GUEST_STORAGE_KEY } from '@/lib/taste-test/guest-storage';
import { useLumiScoreLocale } from './LumiScoreLocale';
const subscribe = (notify: () => void) => { window.addEventListener('storage', notify); return () => window.removeEventListener('storage', notify); };
const snapshot = () => { try { return localStorage.getItem(TASTE_TEST_GUEST_STORAGE_KEY); } catch { return null; } };
export function RecommendationOverview({ personalization, limit }: { personalization: HomepagePersonalization; limit: number }) {
  const { locale } = useLumiScoreLocale();
  const stored = useSyncExternalStore(subscribe, snapshot, () => null);
  const complete = getGuestTasteTestProgress(parseGuestTasteTestAnswers(stored)).complete;
  const [result, setResult] = useState<{ locale: string; limit: number; guest: HomepagePersonalization | null } | null>(null);
  useEffect(() => {
    if (personalization.authenticated) return;
    const answers = parseGuestTasteTestAnswers(stored);
    if (!getGuestTasteTestProgress(answers).complete) return;
    const controller = new AbortController();
    fetch('/api/recommendations/guest', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, locale, limit }), signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(); return r.json() as Promise<HomepagePersonalization>; })
      .then(guest => { if (!controller.signal.aborted) setResult({ locale, limit, guest }); })
      .catch(() => { if (!controller.signal.aborted) setResult({ locale, limit, guest: null }); });
    return () => controller.abort();
  }, [personalization.authenticated, locale, limit, stored]);
  const current = result?.locale === locale && result.limit === limit ? result : null;
  if (!personalization.authenticated && complete && !current) return <p role="status">{locale === 'nl' ? 'Aanbevelingen laden…' : 'Loading recommendations…'}</p>;
  if (!personalization.authenticated && complete && current && !current.guest) return <p role="status">{locale === 'nl' ? 'Aanbevelingen zijn tijdelijk niet beschikbaar. Vernieuw de pagina om opnieuw te proberen.' : 'Recommendations are temporarily unavailable. Refresh the page to try again.'}</p>;
  const guest = current?.guest;
  return <RecommendationsSection personalization={personalization.authenticated ? personalization : guest ?? personalization} limit={limit} returnTo={`/recommendations?limit=${limit}`} />;
}
