// Server catalogue hydration only. Never import the evidence inventory in a UI
// component: the browser receives URLs for its selected books, not this index.
import evidence from './catalog-cover-evidence-20261117.json' with {type:'json'};
import reviewedCovers from './catalog-reviewed-covers-20261117.json' with {type:'json'};
import type {Book} from '../../app/data/books.ts';
import {editionSourceCoverUrls} from './edition-cover-evidence.ts';
import {normalizeEditionLanguage} from './edition-ranking.ts';
import {safePublicCoverUrl} from './stored-presentation.ts';

type ReviewedCatalogCover={workId:string;editionId:string;authorId:string;author:string;title:string;isbn13:string;language:string;openLibraryWorkId:string|null;openLibraryEditionId:string|null;coverUrl:string;evidenceUrl:string};
const reviewedByEdition=new Map((reviewedCovers as ReviewedCatalogCover[]).map(row=>[row.editionId,row]));

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
    const row=byEdition.get(book.openLibraryEditionId??'');
    if(!row||identity(row.author)!==identity(book.author))return book;
    const coverUrls=editionSourceCoverUrls(book,row.source);
    return coverUrls.length?{...book,coverUrls}:book;
  });
}
