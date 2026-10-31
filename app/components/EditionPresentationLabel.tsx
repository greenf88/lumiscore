'use client';
import type {Book} from '../data/books';
import {useLumiScoreLocale} from './LumiScoreLocale';
export function EditionPresentationLabel({book}:{book:Book}){
  const {locale}=useLumiScoreLocale();
  if(book.editionAvailable===false)return <p className="edition-language-label" role="status">{locale==='nl'?'Er is geen geverifieerde Nederlandse editie beschikbaar.':'A verified English edition is not available.'}</p>;
  return book.englishEditionFallback && locale==='nl'?<small className="edition-language-label">Engelse editie</small>:null;
}
