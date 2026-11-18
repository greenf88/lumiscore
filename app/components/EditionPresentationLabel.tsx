'use client';
import type {Book} from '../data/books';
import {useLumiScoreLocale} from './LumiScoreLocale';
export function EditionPresentationLabel({book, showAlternatives=false}:{book:Book;showAlternatives?:boolean}){
  const {locale}=useLumiScoreLocale();
  if(book.editionAvailable===false){
    const alternative=locale==='en'?'nl':'en';
    const canOpen=showAlternatives && /^[1-9]\d*$/.test(book.workId??'') && book.detailLocales?.includes(alternative);
    return <div className="edition-language-label">
      <p role="status">{locale==='nl'?'Er is geen geverifieerde Nederlandse editie beschikbaar.':'A verified English edition is not available.'}</p>
      {canOpen && <a className="edition-alternative-link" href={`/${alternative}/book/${book.workId}`} hrefLang={alternative}>
        {locale==='en'?'Read about the Dutch edition →':'Bekijk de Engelse editie →'}
      </a>}
    </div>;
  }
  return book.englishEditionFallback && locale==='nl'?<small className="edition-language-label">Engelse editie</small>:null;
}
