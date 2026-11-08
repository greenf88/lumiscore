// Real TEST SDK reads through the shared application loaders. No writes/provider calls.
import {createServer} from 'vite';import assert from 'node:assert/strict';
if(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname!=='hlvujbrmfdlrfxdjwsmb.supabase.co')throw Error('Only TEST');
const v=await createServer({root:process.cwd(),configFile:false,envFile:false,resolve:{alias:{'@':process.cwd()}},css:{postcss:{plugins:[]}},server:{middlewareMode:true,hmr:false}});
try{
 const {loadCatalogBooksByIds}=await v.ssrLoadModule('/lib/supabase/books.ts');
 const {publicBookRevisionHash}=await v.ssrLoadModule('/lib/seo/public-revision-projection.ts');
 const {supabase}=await v.ssrLoadModule('/lib/supabase/client.ts');
 const books=await loadCatalogBooksByIds(['8800306'],undefined,'nl');assert.equal(books.length,1);
 const links=await supabase.from('collection_books').select('work_id,collection_id,sequence_number,publication_order,subgroup,collections(slug,name,collection_type,description,expected_main_series_total)').eq('work_id',8800306);if(links.error)throw links.error;
 const hash=publicBookRevisionHash(books[0],'nl',links.data);assert.match(hash,/^[a-f0-9]{64}$/);
 const {loadPublishedBookRevisions}=await v.ssrLoadModule('/lib/supabase/public-revisions.ts');const map=await loadPublishedBookRevisions('nl');
 const {verifiedPageLastmod}=await v.ssrLoadModule('/lib/seo/verified-lastmod.ts');
 console.log(JSON.stringify({at:new Date().toISOString(),workId:books[0].workId,editionId:books[0].editionId,locale:'nl',currentHash:hash,storedControlledSummary:!!books[0].storedDescription,source:books[0].storedDescription?.sourceUrl,ledger:[...map],lastmod:verifiedPageLastmod(map.get('/nl/book/8800306'))}));
}finally{await v.close();}
