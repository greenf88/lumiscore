'use client';

import { useState } from 'react';
import type { ReadingStatus } from '@/lib/collections/model';
import { useLumiScoreLocale } from './LumiScoreLocale';

const STATUS_KEYS: Record<ReadingStatus, 'collection.wantToRead' | 'collection.reading' | 'collection.read' | 'collection.dnf'> = {
  want_to_read: 'collection.wantToRead',
  reading: 'collection.reading',
  read: 'collection.read',
  dnf: 'collection.dnf',
};

export function LumiScoreReadingStatus({
  workId,
  status,
  authenticated,
  returnTo,
  compact = false,
  showGuestCta = true,
  onStatusChange,
}: {
  workId: string;
  status: ReadingStatus | null;
  authenticated: boolean;
  returnTo: string;
  compact?: boolean;
  showGuestCta?: boolean;
  onStatusChange: (status: ReadingStatus | null) => void;
}) {
  const { t } = useLumiScoreLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const loginHref = `/login?next=${encodeURIComponent(returnTo)}`;

  if (!authenticated) {
    return showGuestCta
      ? <a className="status-sign-in" href={loginHref}>{t('collection.signInTrack')}</a>
      : null;
  }

  const updateStatus = async (nextValue: string) => {
    const previous = status;
    const next = (nextValue || null) as ReadingStatus | null;
    onStatusChange(next);
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/books/${workId}/status`, {
        method: next ? 'PUT' : 'DELETE',
        headers: next ? { 'Content-Type': 'application/json' } : undefined,
        body: next ? JSON.stringify({ status: next }) : undefined,
      });
      if (response.status === 401) {
        window.location.assign(loginHref);
        return;
      }
      if (!response.ok) throw new Error(t('collection.statusError'));
    } catch (caught) {
      onStatusChange(previous);
      setError(caught instanceof Error ? caught.message : t('collection.statusError'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={`reading-status-control${compact ? ' is-compact' : ''}`}>
      <label>
        <span>{t('collection.statusLabel')}</span>
        <select
          value={status ?? ''}
          disabled={pending}
          aria-label={t('collection.statusLabel')}
          onChange={(event) => void updateStatus(event.target.value)}
        >
          <option value="">{pending ? t('collection.savingStatus') : t('collection.setStatus')}</option>
          {(Object.keys(STATUS_KEYS) as ReadingStatus[]).map((value) => (
            <option key={value} value={value}>{t(STATUS_KEYS[value])}</option>
          ))}
        </select>
      </label>
      <span className="reading-status-error" role="status" aria-live="polite">{error}</span>
    </div>
  );
}

