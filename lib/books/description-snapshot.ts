import {createHash} from 'node:crypto';
import type {Book, VerifiedBookDescription} from '../../app/data/books.ts';
import type {Locale} from '../i18n/config.ts';
import {normalizeVerifiedBookDescription} from './description-text.ts';
import {sourceDescriptionLocale} from './description-language.ts';

export type DescriptionSnapshot = {work_id:string;edition_id:string;locale:Locale;binding_hash:string;
 bound_author_id:string;bound_title:string;bound_language:string;bound_isbn13:string|null;bound_open_library_work_id:string;
 text:string|null;source_key:string;fetched_at:string;checked_at:string;provider_status:'resolved'|'temporary_failure'|'confirmed_missing'|'withdrawn';
 validation:'identity_and_language_verified';};
export function descriptionBinding(book:Book,locale:Locale):string|null {
 if(!book.workId||!book.editionId||!book.authorId||!book.editionAvailable||book.strictEditionLanguage!==locale||!book.openLibraryEditionId||!book.openLibraryWorkId)return null;
 return createHash('sha256').update(JSON.stringify([book.workId,book.authorId,book.editionId,book.editionTitle??book.title,
  book.editionLanguage,book.isbn13??null,book.openLibraryWorkId??null,book.openLibraryEditionId,locale])).digest('hex');
}
export function readDescriptionSnapshot(row:DescriptionSnapshot|null,book:Book,locale:Locale,now=Date.now()) {
 const binding=descriptionBinding(book,locale);
 if(!row||row.provider_status==='withdrawn'||row.provider_status==='confirmed_missing'||!binding||row.binding_hash!==binding||String(row.work_id)!==book.workId||String(row.edition_id)!==book.editionId
  ||row.locale!==locale||row.source_key!==book.openLibraryEditionId||row.validation!=='identity_and_language_verified')return null;
 const fetched=Date.parse(row.fetched_at),checked=Date.parse(row.checked_at),age=now-fetched;
 if(!Number.isFinite(fetched)||!Number.isFinite(checked)||checked<fetched||age<0||age>90*86400000)return null;
 const description=normalizeVerifiedBookDescription({text:row.text,source:'open_library',sourceKey:row.source_key,verifiedAt:row.fetched_at,language:locale});
 if(!description||sourceDescriptionLocale(description.text)!==locale)return null;
 return {description,fresh:row.provider_status==='resolved'&&age<30*86400000,providerStatus:row.provider_status};
}
/** A withdrawal belongs to a source identity, not to its age or typography. */
export function isDescriptionSnapshotWithdrawn(row:DescriptionSnapshot|null,book:Book,locale:Locale):boolean {
 return !!row&&row.provider_status==='withdrawn'&&String(row.work_id)===book.workId
  &&String(row.edition_id)===book.editionId&&row.locale===locale&&row.source_key===book.openLibraryEditionId;
}
export function createDescriptionSnapshot(book:Book,locale:Locale,description:VerifiedBookDescription,now=Date.now()):DescriptionSnapshot|null {
 const binding=descriptionBinding(book,locale),value=normalizeVerifiedBookDescription(description);
 // Reviewed central summaries always win. Only the existing exact-edition OL
 // adapter has source-cache permission verified for this implementation.
 if(!binding||!value||value.source!=='open_library'||value.sourceKey!==book.openLibraryEditionId
  ||value.language!==locale||sourceDescriptionLocale(value.text)!==locale)return null;
 // A cached provider response is not a new fetch. Retrying must never reset
 // the maximum retention age of its last-known-good content.
 const fetched=Date.parse(value.verifiedAt);
 if(!Number.isFinite(fetched)||fetched>now||now-fetched>90*86400000)return null;
 const at=new Date(now).toISOString(),fetchedAt=new Date(fetched).toISOString();
 return {work_id:book.workId!,edition_id:book.editionId!,locale,binding_hash:binding,text:value.text,
  bound_author_id:book.authorId!,bound_title:book.editionTitle??book.title,bound_language:book.editionLanguage!,
  bound_isbn13:book.isbn13??null,bound_open_library_work_id:book.openLibraryWorkId!,
  source_key:value.sourceKey,fetched_at:fetchedAt,checked_at:at,provider_status:'resolved',validation:'identity_and_language_verified'};
}
