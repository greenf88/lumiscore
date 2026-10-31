'use client';
import { Suspense, use } from 'react';
import type { VerifiedBookDescription } from '../data/books';
import type { BookDescriptionResolution } from '@/lib/books/description-resolution';
import { splitBookDescriptionParagraphs } from '@/lib/books/description-text';
import { publicDescriptionSource } from '@/lib/books/description-source';
import { useLumiScoreLocale } from './LumiScoreLocale';

export function LumiScoreBookDescription({ description, state='confirmed_missing' }: { description: VerifiedBookDescription | null; englishEditionFallback?:boolean; state?:BookDescriptionResolution['state'] | 'loading' }) {
  const { locale, t } = useLumiScoreLocale();
  const source = description ? publicDescriptionSource(description) : null;
  const allowed=description?.language === locale;
  const paragraphs = allowed && source && description ? splitBookDescriptionParagraphs(description.text) : [];
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
    </> : <p role={state==='temporary_failure'?'status':undefined}>{state==='loading'
      ? locale==='nl'?'De beschrijving wordt geladen.':'Loading the description.'
      : state==='temporary_failure'
        ? locale==='nl'?'De beschrijving kon tijdelijk niet worden geladen. Probeer later opnieuw.':'The description could not load right now. Please try again later.'
        : locale==='nl'
          ? 'Er is nog geen geverifieerde Nederlandse beschrijving beschikbaar.'
          : 'A verified English description is not available yet.'}</p>}
  </section>;
}

function ResolvedDescription({resolution,englishEditionFallback}:{resolution:Promise<BookDescriptionResolution>;englishEditionFallback?:boolean}) {
  const result=use(resolution);
  return <LumiScoreBookDescription {...result} englishEditionFallback={englishEditionFallback} />;
}

/** The complete response still includes the synopsis; optional sources never hold the title/actions. */
export function StreamedBookDescription(props:{resolution:Promise<BookDescriptionResolution>;englishEditionFallback?:boolean}) {
  return <Suspense fallback={<LumiScoreBookDescription description={null} state="loading" englishEditionFallback={props.englishEditionFallback} />}>
    <ResolvedDescription {...props}/>
  </Suspense>;
}
