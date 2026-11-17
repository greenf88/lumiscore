import type {Book} from '../../app/data/books.ts';
type Waiter={book:Book;resolve:(urls:string[])=>void};
const cache=new Map<string,{expires:number;result:Promise<string[]>}>();
const queues=new Map<string,Waiter[]>();
const key=(book:Book)=>`${book.strictEditionLanguage}:${book.workId}:${book.editionId}`;
export function coverUrlsForEdition(book:Book,rows:unknown):string[]{
  if(!Array.isArray(rows))return [];
  const row=rows.find(x=>x?.workId===book.workId&&x?.editionId===book.editionId);
  return Array.isArray(row?.urls)?row.urls.filter((url:unknown):url is string=>typeof url==='string'&&url.startsWith('https://')):[];
}
/** Coalesce mounted missing covers into bounded public requests. Rating actions
 * never await these. A different edition or locale cannot reuse the response. */
export function loadExactEditionCovers(book:Book):Promise<string[]>{
  if(!book.workId||!book.editionId||!book.strictEditionLanguage||!book.editionAvailable)return Promise.resolve([]);
  const id=key(book),cached=cache.get(id);if(cached&&cached.expires>Date.now())return cached.result;
  if(cache.size>500)cache.delete(cache.keys().next().value!);
  const locale=book.strictEditionLanguage;
  const result=new Promise<string[]>(resolve=>{
    const waiting=queues.get(locale);if(waiting){waiting.push({book,resolve});return;}
    queues.set(locale,[{book,resolve}]);
    setTimeout(()=>{
      const batch=queues.get(locale)??[];queues.delete(locale);
      for(let i=0;i<batch.length;i+=16){
        const chunk=batch.slice(i,i+16),ids=[...new Set(chunk.map(x=>x.book.workId))].join(',');
        fetch(`/api/books/edition-covers?locale=${locale}&ids=${ids}`,{credentials:'omit',signal:AbortSignal.timeout(12000)})
          .then(async r=>r.ok?await r.json() as {covers?:unknown}:null)
          .catch(()=>null).then(data=>{for(const x of chunk){const urls=coverUrlsForEdition(x.book,data?.covers);cache.set(key(x.book),{expires:Date.now()+(urls.length?3600000:60000),result:Promise.resolve(urls)});x.resolve(urls);}});
      }
    },25);
  });
  cache.set(id,{expires:Date.now()+60000,result});return result;
}
