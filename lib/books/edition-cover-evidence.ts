// Public bibliographic reads only. Never writes the legacy Work-keyed cache.
import type { Book } from '../../app/data/books.ts';
import { normalizeOpenLibraryId, normalizeIsbn13, getOpenLibraryCoverIdUrl, uniqueCoverUrls } from './covers.ts';
import { normalizeEditionLanguage } from './edition-ranking.ts';

type SourceEdition={key?:string;title?:string;works?:{key?:string}[];languages?:{key?:string}[];isbn_13?:string[];covers?:number[]};
const cache=new Map<string,{expires:number;value:SourceEdition|null}>();
const pending=new Map<string,Promise<SourceEdition|null>>();
const TTL=24*60*60*1000, FAILURE_TTL=60*1000, BATCH=50;
const normalizedTitle=(s:string)=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
export function editionSourceCoverUrls(book:Book,source:SourceEdition|null):string[]{
  if(!book.editionAvailable || !source || normalizeOpenLibraryId(source.key,'edition')!==book.openLibraryEditionId ||
    !source.works?.some(w=>normalizeOpenLibraryId(w.key,'work')===book.openLibraryWorkId) ||
    !source.title || normalizedTitle(source.title)!==normalizedTitle(book.title))return [];
  const languages=[...new Set((source.languages??[]).map(l=>normalizeEditionLanguage(l.key??'')))];
  if(languages.length!==1 || languages[0]!==normalizeEditionLanguage(book.editionLanguage??''))return [];
  if(book.isbn13 && !source.isbn_13?.some(i=>normalizeIsbn13(i)===book.isbn13))return [];
  return uniqueCoverUrls((source.covers??[]).filter(id=>Number.isSafeInteger(id)&&id>0).map(getOpenLibraryCoverIdUrl));
}
/** One bounded batch per visible page; no ISBN image guesses or Work-cover fallback. */
export async function withEditionCoverEvidence(books:readonly Book[],fetcher:typeof fetch=fetch):Promise<Book[]>{
  const ids=[...new Set(books.flatMap(b=>b.editionAvailable && !b.coverUrls?.length && b.openLibraryEditionId?[b.openLibraryEditionId]:[]))];
  const missing=ids.filter(id=>!pending.has(id)&&(cache.get(id)?.expires??0)<=Date.now());
  if(cache.size>2000)for(const key of [...cache.keys()].slice(0,500))cache.delete(key);
  for(let start=0;start<missing.length;start+=BATCH){
    const batch=missing.slice(start,start+BATCH);
    const task=(async()=>{
      try{
        const url=new URL('https://openlibrary.org/api/get_many');url.searchParams.set('keys',JSON.stringify(batch.map(id=>'/books/'+id)));
        const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(3500)});
        if(!response.ok)return null;
        const body=await response.json() as {status?:string;result?:Record<string,SourceEdition>};
        return body.status==='ok'?body.result??null:null;
      }catch{return null;}
    })();
    for(const id of batch){
      const value=task.then(rows=>{const edition=rows?.['/books/'+id]??null;cache.set(id,{value:edition,expires:Date.now()+(rows?TTL:FAILURE_TTL)});return edition;}).finally(()=>pending.delete(id));
      pending.set(id,value);
    }
  }
  const sources=new Map(await Promise.all(ids.map(async id=>[id,pending.has(id)?await pending.get(id)!:cache.get(id)?.value??null] as const)));
  return books.map(book=>({...book,coverUrls:uniqueCoverUrls([...(book.coverUrls??[]),...editionSourceCoverUrls(book,sources.get(book.openLibraryEditionId??'')??null)])}));
}
export function clearEditionCoverEvidenceCacheForTests(){cache.clear();pending.clear();}
/** Same evidence and bounded source request, but no cover dependency on card text/actions.
 * Only server-rendered page loaders opt in. JSON callers keep the awaited path. */
export function deferEditionCoverEvidence(books:readonly Book[],fetcher:typeof fetch=fetch):Book[]{
  const resolved=withEditionCoverEvidence(books,fetcher).catch(()=>{
    console.warn('Optional edition cover evidence unavailable; keeping verified card identity and neutral cover.');
    return [...books];
  });
  return books.map((book,index)=>book.coverUrls?.length || !book.openLibraryEditionId ? book : {
    ...book, editionCoverUrls:resolved.then(rows=>rows[index].coverUrls??[]),
  });
}
export async function withRecommendationEditionCovers<T extends {book:Book}>(rows:readonly T[]):Promise<T[]>{
  const books=await withEditionCoverEvidence(rows.map(r=>r.book));
  return rows.map((row,i)=>({...row,book:books[i]}));
}
