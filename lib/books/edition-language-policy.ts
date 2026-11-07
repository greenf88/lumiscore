// Shared language predicates without server edition ranking/cover registries.
import type {Book} from '../../app/data/books.ts';
import type {Locale} from '../i18n/config.ts';
import {normalizeEditionLanguage} from './edition-ranking.ts';
type LanguageRow={language:string|null};
export function permittedEditionLanguage(edition:LanguageRow,locale:Locale):boolean{return editionHasLanguage(edition,locale);}
export function editionHasLanguage(edition:LanguageRow,locale:Locale):boolean{
 return Boolean(edition.language&&normalizeEditionLanguage(edition.language.trim())===(locale==='nl'?'nld':'eng'));
}
export function isBookPresentationAllowed(book:Pick<Book,'editionAvailable'|'strictEditionLanguage'|'editionLanguage'>,locale:Locale):boolean{
 return book.editionAvailable===true&&book.strictEditionLanguage===locale&&permittedEditionLanguage({language:book.editionLanguage??null},locale);
}
