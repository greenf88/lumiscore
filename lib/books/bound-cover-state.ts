import type {Book} from '../../app/data/books.ts';
type Identity=Pick<Book,'id'|'workId'|'openLibraryWorkId'|'isbn13'|'editionId'|'strictEditionLanguage'|'editionLanguage'|'editionTitle'|'coverUrls'>;
const part=(value:string|null|undefined)=>value?.trim()??'';
export function getBookCoverIdentity(book:Identity):string{
 return JSON.stringify([part(book.workId),part(book.openLibraryWorkId),part(book.isbn13),part(book.id),part(book.editionId),part(book.strictEditionLanguage),part(book.editionLanguage),part(book.editionTitle),book.coverUrls??[]]);
}
/** Normal catalogue loaders already resolved and bound these sources. No
 * whole-registry download or new source/ISBN guess belongs in their browser. */
export function getInitialBoundCoverUrls(book:Pick<Book,'coverUrls'>):string[]{return [...new Set(book.coverUrls??[])];}
export function hasBoundCover(book:Pick<Book,'coverUrls'>):boolean{return getInitialBoundCoverUrls(book).length>0;}
