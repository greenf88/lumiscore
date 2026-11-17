'use client';
import { useLumiScoreLocale } from './LumiScoreLocale';
export function TastePainting() {
  const {locale} = useLumiScoreLocale();
  return <div className="taste-painting" role="status"><div className="taste-painting-art" aria-hidden="true"><span>✦</span><i/><i/><i/></div>
    <strong>{locale === 'nl' ? 'We zijn je leessmaak aan het schilderen…' : 'We’re painting your reading taste…'}</strong>
    <p>{locale === 'nl' ? 'Je leespersonage en nieuwe leestips komen eraan.' : 'Your reading character and new book suggestions are on their way.'}</p></div>;
}
