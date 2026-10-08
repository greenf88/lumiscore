'use client';
import { useEffect, useState } from 'react';
import type { VerifiedBookDescription } from '../data/books';
import { normalizeVerifiedBookDescription, splitBookDescriptionParagraphs } from '@/lib/books/description-text';
import { publicDescriptionSource } from '@/lib/books/description-source';
import { useLumiScoreLocale } from './LumiScoreLocale';

export function LumiScoreBookDescription({ workId }: { workId: string }) {
  const { locale, t } = useLumiScoreLocale();
  const requestKey = `${workId}:${locale}`;
  const [resolved, setResolved] = useState<{ key: string; description: VerifiedBookDescription | null } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    // Restore the previous asynchronous synopsis flow. Optional external text
    // must not delay the book page; retain the reviewed source/language gates.
    void fetch(`/api/books/${encodeURIComponent(workId)}/description?locale=${encodeURIComponent(locale)}`, {
      headers: { Accept: 'application/json' }, signal: controller.signal,
    }).then(async response => {
      if (!response.ok) return null;
      const payload = await response.json() as { description?: VerifiedBookDescription | null };
      return normalizeVerifiedBookDescription(payload.description);
    }).then(description => {
      if (!controller.signal.aborted) setResolved({ key: requestKey, description });
    }).catch(() => {
      // An unavailable optional synopsis leaves the honest localized fallback.
    });
    return () => controller.abort();
  }, [locale, requestKey, workId]);
  const description = resolved?.key === requestKey ? resolved.description : null;
  const source = description ? publicDescriptionSource(description) : null;
  const paragraphs = description?.language === locale && source ? splitBookDescriptionParagraphs(description.text) : [];
  const isLong = paragraphs.length > 2 && (description!.text.length > 500 || paragraphs.length > 4);
  const visible = paragraphs.slice(0, isLong ? 2 : paragraphs.length);
  return <section className="book-description" aria-labelledby="book-description-heading">
    <h2 id="book-description-heading">{t('description.about')}</h2>
    {paragraphs.length ? <>
      {visible.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      {isLong && <details><summary className="description-toggle">{t('description.readMore')}</summary>
        {paragraphs.slice(2).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </details>}
      <p className="description-source">{locale === 'nl' ? 'Bron' : 'Source'}: <a href={source!.href} rel="noreferrer" target="_blank">{source!.name}</a></p>
    </> : <p>{locale === 'nl' ? 'Er is nog geen geverifieerde Nederlandse beschrijving beschikbaar.' : 'A verified English description is not available yet.'}</p>}
  </section>;
}
