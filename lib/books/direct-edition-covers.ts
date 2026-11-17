import type {Book} from '../../app/data/books.ts';
import {editionSourceCoverUrls} from './edition-cover-evidence.ts';

type Source=Parameters<typeof editionSourceCoverUrls>[1];
/** Optional, public background reads. Separate from the existing streamed page
 * loader so a slow source never becomes a dependency of a rating or card text. */
export function createDirectEditionCoverResolver(fetcher:typeof fetch=fetch){
  const cache=new Map<string,{expires:number;value:Source}>();
  const pending=new Map<string,Promise<Source>>();
  let active=0;
  const waiting:Array<()=>void>=[];
  async function read(id:string):Promise<Source>{
    const cached=cache.get(id);if(cached&&cached.expires>Date.now())return cached.value;
    const inflight=pending.get(id);if(inflight)return inflight;
    const task=(async()=>{
      if(active>=4)await new Promise<void>(resolve=>waiting.push(resolve));
      else active++;
      let value:Source=null;
      try{
        const response=await fetcher(`https://openlibrary.org/books/${id}.json`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(8000)});
        if(response.ok)value=await response.json() as Source;
      }catch{/* Missing cover evidence leaves the usable neutral cover. */}
      finally{const next=waiting.shift();if(next)next();else active--;}
      if(cache.size>2000)cache.delete(cache.keys().next().value!);
      cache.set(id,{value,expires:Date.now()+(value?86400000:60000)});
      return value;
    })().finally(()=>pending.delete(id));
    pending.set(id,task);return task;
  }
  return async(books:readonly Book[]):Promise<Book[]>=>Promise.all(books.map(async book=>{
    if(book.coverUrls?.length||!book.editionAvailable||!book.openLibraryEditionId||!/^OL[0-9]+M$/.test(book.openLibraryEditionId))return book;
    const urls=editionSourceCoverUrls(book,await read(book.openLibraryEditionId));
    return {...book,coverUrls:urls};
  }));
}
export const withDirectEditionCovers=createDirectEditionCoverResolver();
