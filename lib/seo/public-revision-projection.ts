import {createHash} from 'node:crypto';
import type {Book} from '../../app/data/books.ts';
import type {Locale} from '../i18n/config.ts';
import {suzanneBookGuide} from '../editorial/landing-guides.ts';
import {normalizeVerifiedBookDescription} from '../books/description-text.ts';
export const PUBLIC_PROJECTION_VERSION='catalog_public_v2';
export type PublicSourceDisposition={work_id:string|number;edition_id:string|number;locale:string;source_key:string;provider_status:string};
/** Deliberately partial coverage: unknown/unreviewed optional content has no date.
 * Ratings, caches, provider fetch times and private progress are not content dates.
 * Changing a visible score alone does not enqueue/advance a page revision. */
export function publicBookRevisionHash(book:Book,locale:Locale,relations:readonly unknown[],disposition?:PublicSourceDisposition):string|null {
 const d=normalizeVerifiedBookDescription(book.storedDescription);
 const reviewedText=!!d&&d.language===locale&&['official_catalog','official_publisher'].includes(d.source);
 const withdrawn=disposition?.provider_status==='withdrawn'&&String(disposition.work_id)===book.workId&&String(disposition.edition_id)===book.editionId
  &&disposition.locale===locale&&disposition.source_key===book.openLibraryEditionId;
 if(!book.workId||!book.authorId||book.author==='Unknown author'||book.storedPresentationUnavailable||!book.editionAvailable
  ||book.strictEditionLanguage!==locale||!book.editionId||!book.editionFormat||['unknown','other'].includes(book.editionFormat)
  ||(!reviewedText&&!withdrawn)||!book.coverUrls?.length)return null;
 const value={version:PUBLIC_PROJECTION_VERSION,policy:'strict-locale-pr85',locale,
 work:[book.workId,book.workTitle??null,book.authorId,book.author,book.firstPublishYear??null],
 edition:[book.editionId,book.title,book.editionTitle,book.editionLanguage,book.isbn13??null,book.editionPublisher??null,book.editionFormat],
 summary:reviewedText&&d?[d.text,d.source,d.sourceUrl??d.sourceKey,d.sourceName??null]:['withdrawn',disposition!.source_key],
 cover:[...book.coverUrls,book.cardCoverUrl??null],relations:[...relations].sort((a,b)=>{
  const x=JSON.stringify(a),y=JSON.stringify(b);return x<y?-1:x>y?1:0;
 }),
 guide:suzanneBookGuide(book,locale)};
 return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
