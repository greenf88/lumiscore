'use client';
import { useEffect } from 'react';
import { overviewScrollKey } from '@/lib/navigation/overview-scroll';
import { splitLocalePath } from '@/lib/i18n/paths';
export function OverviewScrollMemory() {
  useEffect(() => {
    const path = location.pathname;
    const unprefixed = splitLocalePath(path).path;
    if (!['/', '/browse', '/search', '/collections', '/recommendations'].includes(unprefixed) && !/^\/collection\/[a-z0-9-]+$/.test(unprefixed)) return;
    const key = overviewScrollKey(path, location.search);
    let frame = 0;
    let cancelled = false;
    try {
      sessionStorage.removeItem('lumiscore-rating-changed'); // This document loaded fresh; BFCache keeps the listener below.
      const stored = JSON.parse(sessionStorage.getItem(key) ?? 'null');
      if (stored && Number.isFinite(stored.y) && stored.y >= 0 && Date.now() - stored.at < 30 * 60 * 1000) {
        const restore = () => {
          if (cancelled) return;
          window.scrollTo(0, stored.y);
          if (Math.abs(window.scrollY - stored.y) > 2 && frame++ < 120) requestAnimationFrame(restore);
        };
        requestAnimationFrame(restore);
      }
    } catch { /* Optional storage must not break navigation. */ }
    const save = () => { try { sessionStorage.setItem(key, JSON.stringify({ y: scrollY, at: Date.now() })); } catch { /* Optional. */ } };
    const refreshChangedRatings = (e: PageTransitionEvent) => {
      if (e.persisted) { try { if (sessionStorage.getItem('lumiscore-rating-changed')) { sessionStorage.removeItem('lumiscore-rating-changed'); location.reload(); } } catch { /* Optional. */ } }
    };
    window.addEventListener('pagehide', save);
    window.addEventListener('pageshow', refreshChangedRatings);
    return () => { cancelled = true; window.removeEventListener('pagehide', save); window.removeEventListener('pageshow', refreshChangedRatings); };
  }, []);
  return null;
}
