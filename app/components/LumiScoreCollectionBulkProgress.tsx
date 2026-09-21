'use client';

import type { ReadingStatus } from '@/lib/collections/model';
import {
  COLLECTION_BULK_FILTERS,
  type CollectionBulkFilter,
} from '@/lib/collections/bulk-progress';
import { useLumiScoreLocale } from './LumiScoreLocale';

const FILTER_KEYS: Record<CollectionBulkFilter,
  | 'collection.filterAll'
  | 'collection.filterUnknown'
  | 'collection.read'
  | 'collection.reading'
  | 'collection.wantToRead'
  | 'collection.dnf'
  | 'collection.filterRated'> = {
    all: 'collection.filterAll',
    unknown: 'collection.filterUnknown',
    read: 'collection.read',
    reading: 'collection.reading',
    want_to_read: 'collection.wantToRead',
    dnf: 'collection.dnf',
    rated: 'collection.filterRated',
  };

export function LumiScoreCollectionBulkProgress({
  active,
  filter,
  visibleWorkIds,
  selectedWorkIds,
  ratedWorkIds,
  pending,
  message,
  error,
  onToggleActive,
  onFilterChange,
  onSelectVisible,
  onSelectUnknown,
  onDeselectRated,
  onClearSelection,
  onApply,
}: {
  active: boolean;
  filter: CollectionBulkFilter;
  visibleWorkIds: readonly string[];
  selectedWorkIds: ReadonlySet<string>;
  ratedWorkIds: ReadonlySet<string>;
  pending: boolean;
  message: string;
  error: string;
  onToggleActive: () => void;
  onFilterChange: (filter: CollectionBulkFilter) => void;
  onSelectVisible: () => void;
  onSelectUnknown: () => void;
  onDeselectRated: () => void;
  onClearSelection: () => void;
  onApply: (status: ReadingStatus | null) => void;
}) {
  const { t } = useLumiScoreLocale();
  const selectedRated = [...selectedWorkIds].filter((workId) => ratedWorkIds.has(workId)).length;

  return (
    <section className="collection-bulk-progress" aria-labelledby="collection-bulk-heading">
      <div>
        <h2 id="collection-bulk-heading">{t('collection.bulkHeading')}</h2>
        <p>{t('collection.bulkCopy')}</p>
      </div>
      <button className="collection-bulk-toggle" type="button" aria-expanded={active}
        onClick={onToggleActive}>{active ? t('collection.bulkClose') : t('collection.bulkOpen')}</button>

      {active && (
        <div className="collection-bulk-panel">
          <div className="collection-bulk-filters" role="group" aria-label={t('collection.filterLabel')}>
            {COLLECTION_BULK_FILTERS.map((value) => (
              <button key={value} type="button" aria-pressed={filter === value}
                onClick={() => onFilterChange(value)}>{t(FILTER_KEYS[value])}</button>
            ))}
          </div>
          <div className="collection-bulk-selection-actions">
            <button type="button" onClick={onSelectVisible}>{t('collection.selectFilter')}</button>
            <button type="button" onClick={onSelectUnknown}>{t('collection.selectUnknown')}</button>
            {selectedRated > 0 && (
              <button type="button" onClick={onDeselectRated}>
                {t('collection.deselectRated', { count: selectedRated })}
              </button>
            )}
            <button type="button" disabled={selectedWorkIds.size === 0}
              onClick={onClearSelection}>{t('collection.clearSelection')}</button>
          </div>
          <p className="collection-bulk-visible-count">
            {t('collection.visibleCount', { count: visibleWorkIds.length })}
          </p>
        </div>
      )}

      {active && selectedWorkIds.size > 0 && (
        <div className="collection-bulk-action-bar" role="region" aria-label={t('collection.bulkActions')}>
          <strong>{t('collection.selectedCount', { count: selectedWorkIds.size })}</strong>
          <div>
            {(['read', 'reading', 'want_to_read', 'dnf'] as ReadingStatus[]).map((status) => (
              <button key={status} type="button" disabled={pending}
                onClick={() => onApply(status)}>{t(FILTER_KEYS[status])}</button>
            ))}
            <button type="button" disabled={pending} onClick={() => onApply(null)}>
              {t('collection.clearStatus')}
            </button>
          </div>
        </div>
      )}
      <div className="collection-bulk-feedback" aria-live="polite">
        {message && <p>{message}</p>}
        {error && <p role="alert">{error}</p>}
      </div>
    </section>
  );
}
