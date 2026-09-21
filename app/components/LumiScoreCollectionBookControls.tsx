'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import type { ReadingStatus } from '@/lib/collections/model';
import { useLumiScoreLocale } from './LumiScoreLocale';

const STATUS_KEYS: Record<ReadingStatus, 'collection.wantToRead' | 'collection.reading' | 'collection.read' | 'collection.dnf'> = {
  want_to_read: 'collection.wantToRead',
  reading: 'collection.reading',
  read: 'collection.read',
  dnf: 'collection.dnf',
};

type OpenEditor = 'status' | 'rating' | null;

export function LumiScoreCollectionBookControls({
  workId,
  status,
  rating,
  onStatusChange,
  onRatingChange,
}: {
  workId: string;
  status: ReadingStatus | null;
  rating: number | null;
  onStatusChange: (status: ReadingStatus | null) => void;
  onRatingChange: (rating: number | null) => void;
}) {
  const { t } = useLumiScoreLocale();
  const [open, setOpen] = useState<OpenEditor>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const statusTrigger = useRef<HTMLButtonElement>(null);
  const ratingTrigger = useRef<HTMLButtonElement>(null);

  const closeEditor = (editor: Exclude<OpenEditor, null>) => {
    setOpen(null);
    requestAnimationFrame(() => {
      (editor === 'status' ? statusTrigger : ratingTrigger).current?.focus();
    });
  };

  const handleEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      closeEditor(open);
    }
  };

  const moveRadioFocus = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) return;
    const options = [...(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
      '[role="radio"]:not(:disabled)',
    ) ?? [])];
    const current = options.indexOf(event.currentTarget);
    if (current < 0 || options.length < 2) return;
    event.preventDefault();
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    options[(current + direction + options.length) % options.length]?.focus();
  };

  const reconcileStatus = async () => {
    const response = await fetch(`/api/books/${workId}/status`, { cache: 'no-store' });
    if (!response.ok) return false;
    const payload = await response.json() as { status?: ReadingStatus | null };
    onStatusChange(payload.status ?? null);
    return true;
  };

  const updateStatus = async (next: ReadingStatus | null) => {
    const previous = status;
    onStatusChange(next);
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/books/${workId}/status`, {
        method: next ? 'PUT' : 'DELETE',
        headers: next ? { 'Content-Type': 'application/json' } : undefined,
        body: next ? JSON.stringify({ status: next }) : undefined,
      });
      const payload = await response.json().catch(() => ({})) as {
        status?: ReadingStatus | null;
        code?: string;
      };
      if (response.status === 409 || payload.code === 'rated_work_conflict') {
        onStatusChange('read');
        setError(t('collection.ratedMustRead'));
        return;
      }
      if (!response.ok) throw new Error(t('collection.statusError'));
      onStatusChange(payload.status ?? next);
      closeEditor('status');
    } catch (caught) {
      const reconciled = await reconcileStatus().catch(() => false);
      if (!reconciled) onStatusChange(previous);
      setError(caught instanceof Error ? caught.message : t('collection.statusError'));
    } finally {
      setPending(false);
    }
  };

  const updateRating = async (next: number | null) => {
    const previousRating = rating;
    const previousStatus = status;
    onRatingChange(next);
    if (next !== null) onStatusChange('read');
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/ratings/${workId}`, {
        method: next === null ? 'DELETE' : 'PUT',
        headers: next === null ? undefined : { 'Content-Type': 'application/json' },
        body: next === null ? undefined : JSON.stringify({ rating: next }),
      });
      if (!response.ok) throw new Error(t('collection.ratingError'));
      closeEditor('rating');
    } catch (caught) {
      onRatingChange(previousRating);
      onStatusChange(previousStatus);
      setError(caught instanceof Error ? caught.message : t('collection.ratingError'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="collection-book-controls" onKeyDown={handleEscape}>
      <div className="collection-book-control-triggers">
        <button
          ref={statusTrigger}
          type="button"
          aria-expanded={open === 'status'}
          aria-controls={`collection-status-${workId}`}
          disabled={pending}
          onClick={() => setOpen((current) => current === 'status' ? null : 'status')}
        >
          <span>{t('collection.statusLabel')}</span>
          <strong>{status ? t(STATUS_KEYS[status]) : t('collection.noStatus')}</strong>
        </button>
        <button
          ref={ratingTrigger}
          type="button"
          aria-expanded={open === 'rating'}
          aria-controls={`collection-rating-${workId}`}
          disabled={pending}
          onClick={() => setOpen((current) => current === 'rating' ? null : 'rating')}
        >
          <span>{t('collection.yourScore')}</span>
          <strong>{rating === null ? t('collection.addScore') : `${rating}/10`}</strong>
        </button>
      </div>

      {open === 'status' && (
        <div className="collection-quick-editor" id={`collection-status-${workId}`}>
          <div role="radiogroup" aria-label={t('collection.statusLabel')}>
            {(Object.keys(STATUS_KEYS) as ReadingStatus[]).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={status === value}
                disabled={pending}
                onKeyDown={moveRadioFocus}
                onClick={() => void updateStatus(value)}
              >{t(STATUS_KEYS[value])}</button>
            ))}
          </div>
          <button className="collection-editor-clear" type="button" disabled={pending || status === null}
            onClick={() => void updateStatus(null)}>{t('collection.clearStatus')}</button>
        </div>
      )}

      {open === 'rating' && (
        <div className="collection-quick-editor" id={`collection-rating-${workId}`}>
          <div className="collection-rating-options" role="radiogroup" aria-label={t('detail.chooseRatingLabel')}>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={t('detail.rateOutOf', { rating: value })}
                disabled={pending}
                onKeyDown={moveRadioFocus}
                onClick={() => void updateRating(value)}
              >{value}</button>
            ))}
          </div>
          <button className="collection-editor-clear" type="button" disabled={pending || rating === null}
            onClick={() => void updateRating(null)}>{t('collection.removeScore')}</button>
        </div>
      )}
      {error && <p className="collection-control-message" role="alert">{error}</p>}
    </div>
  );
}
