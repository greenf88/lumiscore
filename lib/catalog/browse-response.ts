/** Validate only Browse's initial SSR card segment. Optional cover streams and
 * every other route continue streaming; never cache an authenticated HTML page. */
export async function guardBrowseResponse(request: {url:string;method:string}, response: Response): Promise<Response> {
  const url = new URL(request.url), locale = url.pathname.startsWith('/nl/') ? 'nl' : 'en';
  if (!/^\/(?:en\/|nl\/)?browse\/?$/.test(url.pathname) || request.method !== 'GET'
    || (response.status !== 200 && response.status < 500)) return response;
  const html = response.headers.get('content-type')?.includes('text/html');
  if (!html && response.status < 500) return response;
  const headers = new Headers(response.headers), started = performance.now();
  const failure = (kind: string) => {
    headers.set('Retry-After', '5'); headers.set('Cache-Control', 'private, no-store');
    headers.delete('content-length');
    console.error(JSON.stringify({event:'browse_response_unavailable',locale,page:Number(url.searchParams.get('page'))||1,
      cardcount:0,upstreamstatus:response.status,latency:Math.round(performance.now()-started),retrycount:0,errorType:kind}));
  };
  if (response.status >= 500) { failure('render_error'); return html ? new Response(response.body,{status:503,headers}) : unavailable(locale,headers); }
  const reader = response.body?.getReader();
  if (!reader) { failure('empty_body'); return unavailable(locale,headers); }
  const decoder = new TextDecoder(), parts: Uint8Array[] = [];let prefix='',bytes=0;
  const deadline = AbortSignal.timeout(12_000);
  try {
    for (;;) {
      const {done,value}=await readWithDeadline(reader,deadline);
      if(value){parts.push(value);bytes+=value.length;prefix+=decoder.decode(value,{stream:true});}
      const end=prefix.match(/<span\b[^>]*\bdata-browse-result-end="(\d+|unavailable)"[^>]*>/);
      if(end){
        const expected=end[1]==='unavailable'?-1:Number(end[1]);
        const count=[...prefix.slice(0,end.index).matchAll(/<a\b[^>]*\bclass="book-card-main-link"[^>]*>/g)].length;
        const total=Number(prefix.match(/data-browse-total="(\d+)"/)?.[1]??-1);
        if(expected<0||count!==expected||(total<0||(!count&&total>0))){failure('zero_or_incomplete_cards');headers.delete('content-length');return new Response(replay(parts,reader),{status:503,headers});}
        if (!count) console.info(JSON.stringify({ event:'browse_empty_200',locale,
          page:Number(url.searchParams.get('page'))||1,cardcount:0,total,reason:'confirmed_empty_catalogue' }));
        return new Response(replay(parts,reader),{status:200,headers});
      }
      if(done||bytes>1_048_576)throw Error('missing_result_marker');
    }
  } catch { void reader.cancel().catch(()=>{});failure('incomplete_or_timed_out_render');return unavailable(locale,headers); }
}
function unavailable(locale:string,headers:Headers){
  headers.set('content-type','text/html; charset=utf-8');
  return new Response(`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>LumiScore</title></head><body><main><h1>${locale==='nl'?'Boeken tijdelijk niet beschikbaar':'Books temporarily unavailable'}</h1></main></body></html>`,{status:503,headers});
}
function replay(parts:Uint8Array[],reader:ReadableStreamDefaultReader<Uint8Array>){
  return new ReadableStream<Uint8Array>({start(c){for(const p of parts)c.enqueue(p);},async pull(c){try{const r=await reader.read();if(r.done)c.close();else c.enqueue(r.value);}catch(e){c.error(e);}},cancel(reason){return reader.cancel(reason);}});
}
async function readWithDeadline(reader:ReadableStreamDefaultReader<Uint8Array>,signal:AbortSignal){
  return new Promise<ReadableStreamReadResult<Uint8Array>>((resolve,reject)=>{
    if(signal.aborted){reject(signal.reason);return;}const abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});
    reader.read().then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}
