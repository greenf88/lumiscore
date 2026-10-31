import {CATALOG_SEARCH_MAX_LIMIT,CATALOG_SEARCH_LIMIT,normalizeCatalogSearchQuery,type CatalogSearchResult} from '../books/catalog-search.ts';
import {searchQuery} from '../catalog/editorial-query.ts';
import type {Locale} from '../i18n/config.ts';

/** Suggestions share the complete locale-eligible SQL selection with results.
 * Limiting raw matches first can hide suitable translations. Only one visible
 * window is hydrated; no external book enrichment is required for suggestions. */
export async function searchCatalog(query:string,limit=CATALOG_SEARCH_LIMIT,locale:Locale='en'):Promise<CatalogSearchResult[]> {
 const q=normalizeCatalogSearchQuery(query);
 if(q.length<2)return [];
 const take=Math.min(CATALOG_SEARCH_MAX_LIMIT,Math.max(1,Math.trunc(limit)));
 const pageSize=take<=16?16:take<=32?32:take<=64?64:128;
 const {loadSearchCatalog}=await import('./search-catalog');
 const result=await loadSearchCatalog(searchQuery({q,pageSize:String(pageSize),sort:'relevance'}),locale);
 if(!result.available)throw new Error('Catalog search unavailable');
 return result.books.slice(0,take);
}
