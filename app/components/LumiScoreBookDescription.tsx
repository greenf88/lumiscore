'use client';

import { useEffect, useState } from 'react';
import type { VerifiedBookDescription } from '../data/books';
import {
  normalizeVerifiedBookDescription,
  splitBookDescriptionParagraphs,
} from '@/lib/books/description-text';
import { useLumiScoreLocale } from './LumiScoreLocale';

type LumiScoreBookDescriptionProps = {
  workId: string;
};

export function LumiScoreBookDescription({
  workId,
}: LumiScoreBookDescriptionProps) {
  const { locale, t } = useLumiScoreLocale();
  const requestKey = `${workId}:${locale}`;
  const [resolved, setResolved] = useState<{
    key: string;
    description: VerifiedBookDescription | null;
  } | null>(null);
  const [expansion, setExpansion] = useState<{ key: string; expanded: boolean } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/books/${workId}/description?locale=${encodeURIComponent(locale)}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = (await response.json()) as {
          description?: VerifiedBookDescription | null;
        };
        return normalizeVerifiedBookDescription(payload.description);
      })
      .then((value) => {
        if (!controller.signal.aborted) {
          setResolved({ key: requestKey, description: value });
        }
      })
      .catch(() => {
        // A synopsis is optional; keep the section absent on request failure.
      });
    return () => controller.abort();
  }, [locale, requestKey, workId]);

  const description = resolved?.key === requestKey ? resolved.description : null;
  const expanded = expansion?.key === requestKey && expansion.expanded;

  if (!description) return null;

  const paragraphs = splitBookDescriptionParagraphs(description.text);
  if (paragraphs.length === 0) return null;
  const isLong =
    paragraphs.length > 2 &&
    (description.text.length > 500 || paragraphs.length > 4);
  const visibleParagraphs = expanded
    ? paragraphs
    : paragraphs.slice(0, isLong ? 2 : paragraphs.length);

  return (
    <section className="book-description" aria-labelledby="book-description-heading">
      <h2 id="book-description-heading">{t('description.about')}</h2>
      <div id="book-description-content">
        {visibleParagraphs.map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 32)}`}>{paragraph}</p>
        ))}
      </div>
      {isLong && (
        <button
          type="button"
          className="description-toggle"
          aria-controls="book-description-content"
          aria-expanded={expanded}
          onClick={() => setExpansion({ key: requestKey, expanded: !expanded })}
        >
          {expanded ? t('description.showLess') : t('description.readMore')}
        </button>
      )}
    </section>
  );
}
