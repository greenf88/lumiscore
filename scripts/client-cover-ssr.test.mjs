import assert from 'node:assert/strict';import test from 'node:test';
import{createServer}from'vite';import react from'@vitejs/plugin-react';
import{createElement}from'react';import{renderToPipeableStream}from'react-dom/server';import{PassThrough}from'node:stream';import{fileURLToPath}from'node:url';
import{getInitialBookCoverUrls}from'../lib/books/book-cover-state.ts';
import{REVIEWED_COVER_OVERRIDES}from'../lib/books/reviewed-cover-overrides.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
test('real shared cover SSR preserves strict sources and lazy legacy fallback without requests',{timeout:30000},async()=>{
 const saved={url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY};
 process.env.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:1';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='synthetic-public';
 const server=await createServer({root,configFile:false,plugins:[react()],resolve:{alias:{'@':root}},server:{middlewareMode:true},logLevel:'error'});
 try{const{BookCover}=await server.ssrLoadModule('/app/components/LumiScoreHome.tsx'),{LumiScoreLocaleProvider}=await server.ssrLoadModule('/app/components/LumiScoreLocale.tsx');
  const reviewed=REVIEWED_COVER_OVERRIDES[0];
  const legacy={...reviewed,id:'work-'+reviewed.workId,source:'supabase',score:8.1,ratingsCount:7,match:null,cover:'orbit'};
  assert.equal(getInitialBookCoverUrls(legacy)[0],reviewed.coverUrl,'actual existing reviewed fallback, not an ISBN guess');
  for(const locale of['en','nl'])for(const strict of[false,true]){
   const book=strict?{...legacy,strictEditionLanguage:locale,editionLanguage:locale==='nl'?'nld':'eng',editionAvailable:true,editionId:'42',coverUrls:['https://example.invalid/exact-edition.jpg']}:legacy;
   const expected=getInitialBookCoverUrls(book)[0];assert.ok(expected);
   const html=await new Promise((resolve,reject)=>{const sink=new PassThrough();let text='';sink.on('data',b=>text+=b);sink.on('end',()=>resolve(text));sink.on('error',reject);const stream=renderToPipeableStream(createElement(LumiScoreLocaleProvider,{initialLocale:locale,hasPersistedChoice:false},createElement(BookCover,{book,label:'Exact edition',presentation:'detail',publicScoreDisplay:'8.1'})),{onAllReady(){stream.pipe(sink);},onError:reject});});
   assert.ok(html.includes(expected.replaceAll('&','&amp;')),'same initial selected/legacy source');assert.match(html,/width="660" height="1000"/);assert.match(html,/alt="Exact edition"/);assert.match(html,/8\.1/);
  }
 }finally{await server.close();for(const[k,v]of[['NEXT_PUBLIC_SUPABASE_URL',saved.url],['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',saved.key]])if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
