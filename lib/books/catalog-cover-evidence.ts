// Server catalogue hydration only. Never import the evidence inventory in a UI
// component: the browser receives URLs for its selected books, not this index.
import evidence from './catalog-cover-evidence-20261117.json' with {type:'json'};
import reviewedCovers from './catalog-reviewed-covers-20261117.json' with {type:'json'};
import alternativeCovers from './catalog-alternative-covers-20261117.json' with {type:'json'};
import type {Book} from '../../app/data/books.ts';
import {editionSourceCoverUrls} from './edition-cover-evidence.ts';
import {normalizeEditionLanguage} from './edition-ranking.ts';
import {safePublicCoverUrl} from './stored-presentation.ts';

type ReviewedCatalogCover={workId:string;editionId:string;authorId:string;author:string;title:string;isbn13:string;language:string;openLibraryWorkId:string|null;openLibraryEditionId:string|null;coverUrl:string;evidenceUrl:string};
const reviewedByEdition=new Map((reviewedCovers as ReviewedCatalogCover[]).map(row=>[row.editionId,row]));
type ReviewedAlternativeCover=Omit<ReviewedCatalogCover,'editionId'|'isbn13'>&{isbn13:string|null;publisher:string|null};
// Database IDs are generated during the guarded catalogue transaction. Bind new
// editions to their full bibliographic identity, including their real ISBN/OLID,
// instead of predicting IDs or attaching a new jacket to the previous edition.
const alternativesByWorkLanguage=new Map((alternativeCovers as ReviewedAlternativeCover[]).map(row=>[`${row.workId}:${row.language}`,row]));

const byEdition=new Map(evidence.map(row=>[row.source.key.slice('/books/'.length),row]));
const identity=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
/** Reuse bibliographic evidence already acquired for the exact edition. Never
 * select an edition, alter a title, trust a Work-level cover, or replace an
 * approved current image. Missing source images still use the normal fallback. */
export function withCatalogCoverEvidence(books:readonly Book[]):Book[]{
  return books.map(book=>{
    if(book.coverUrls?.length||book.storedPresentationUnavailable||!book.editionAvailable||!book.strictEditionLanguage)return book;
    const language=normalizeEditionLanguage(book.editionLanguage??'');
    if(language!==(book.strictEditionLanguage==='nl'?'nld':'eng'))return book;
    const reviewed=reviewedByEdition.get(book.editionId??'');
    if(reviewed&&reviewed.workId===book.workId&&reviewed.authorId===book.authorId&&
      identity(reviewed.author)===identity(book.author)&&reviewed.title===(book.editionTitle??book.title)&&
      reviewed.isbn13===book.isbn13&&reviewed.language===language&&
      reviewed.openLibraryWorkId===(book.openLibraryWorkId??null)&&
      reviewed.openLibraryEditionId===(book.openLibraryEditionId??null)&&safePublicCoverUrl(reviewed.coverUrl))
      return {...book,coverUrls:[reviewed.coverUrl]};
    const alternative=alternativesByWorkLanguage.get(`${book.workId}:${language}`);
    if(alternative&&(alternative.isbn13||alternative.openLibraryEditionId)&&
      alternative.authorId===book.authorId&&identity(alternative.author)===identity(book.author)&&
      alternative.title.trim()===(book.editionTitle??book.title).trim()&&alternative.isbn13===(book.isbn13??null)&&
      (alternative.publisher?.trim()??null)===(book.editionPublisher?.trim()??null)&&
      alternative.openLibraryWorkId===(book.openLibraryWorkId??null)&&
      alternative.openLibraryEditionId===(book.openLibraryEditionId??null)&&safePublicCoverUrl(alternative.coverUrl))
      return {...book,coverUrls:[alternative.coverUrl]};
    const row=byEdition.get(book.openLibraryEditionId??'');
    if(!row||identity(row.author)!==identity(book.author))return book;
    const coverUrls=editionSourceCoverUrls(book,row.source);
    return coverUrls.length?{...book,coverUrls}:book;
  });
}
