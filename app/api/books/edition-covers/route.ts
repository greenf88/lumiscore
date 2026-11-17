import {loadCatalogBooksByIds} from '@/lib/supabase/books';
import {withEditionCoverEvidence} from '@/lib/books/edition-cover-evidence';
/** Public exact-edition evidence only. No caller-supplied URLs, ISBN guesses or
 * Work-keyed fallbacks; no session data or authentication-dependent caching. */
export async function GET(request:Request){
  const params=new URL(request.url).searchParams,locale=params.get('locale');
  const ids=(params.get('ids')??'').split(',');
  if(!['nl','en'].includes(locale??'')||ids.length>16||!ids.every(id=>/^[1-9][0-9]{0,14}$/.test(id)))return Response.json({covers:[]},{status:400});
  try{
    const books=await loadCatalogBooksByIds([...new Set(ids)],undefined,locale as 'nl'|'en');
    const covered=await withEditionCoverEvidence(books);
    return Response.json({covers:covered.map(b=>({workId:b.workId,editionId:b.editionId,urls:b.coverUrls??[]}))},{headers:{'Cache-Control':'public, max-age=60, s-maxage=300'}});
  }catch{return Response.json({covers:[]},{status:503,headers:{'Cache-Control':'no-store'}});}
}
