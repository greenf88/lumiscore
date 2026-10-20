// Loopback-only public fixture. No production module imports this backend.
const dune = ['Children of Dune', 'Dune Messiah', 'God Emperor of Dune', 'Heretics of Dune', 'Chapterhouse: Dune', 'Dune'];
import {selectStrictEdition,withStrictEdition} from '../../lib/books/strict-edition';
import type {Book} from '../../app/data/books';
import type {Locale} from '../../lib/i18n/config';
export const works = Array.from({ length: 168 }, (_, i) => ({
  id: 991001 + i, title: i < 6 ? dune[i] : i === 6 ? 'Dune — forbidden edition' : i===167?'Dune — missing edition title':'A quiet chapter ' + i,
  first_publish_year: 1965 + i % 45, open_library_id: null, source_type: 'fiction', work_type: 'novel',
  author_id: i < 7 ? 1 : 2, authors: { id: i < 7 ? 1 : 2, name: i < 7 ? 'Frank Herbert' : 'Ada Vermeer' },
}));
export const editions = works.flatMap(w => (w.id === 991007 ? ['ger'] : ['nld', 'eng']).map((language, i) => ({
  id: w.id * 10 + i, work_id: w.id, title: w.id===991168?null:language === 'nld' && w.title === 'Dune' ? 'Duin' : w.title,
  language, isbn_10: null, isbn_13: null, open_library_edition_id: null, publisher: 'Synthetic review',
})));
const categories = [{ id: 'fiction_fantasy', label_nl: 'Fantasy', label_en: 'Fantasy' },
  { id: 'fiction_science_fiction', label_nl: 'Sciencefiction', label_en: 'Science fiction' }];
const category = (id: number) => id % 2 ? 'fiction_fantasy' : 'fiction_science_fiction';
export async function loadCatalogBook(id:string,locale:Locale='en'){
  const w=works.find(w=>String(w.id)===id);if(!w)return null;
  const b:Book={id:'work-'+id,workId:id,title:w.title,author:w.authors.name,score:null,ratingsCount:null,match:null,cover:'orbit',source:'supabase'};
  return withStrictEdition(b,selectStrictEdition(editions.filter(e=>e.work_id===w.id),locale,w.title),locale);
}
export const supabase = {
  from(table: string) {
    let rows: Record<string, unknown>[] = table === 'works' ? works : table === 'editions' ? editions : table === 'catalog_categories' ? categories
      : table === 'authors' ? [{id:1,name:'Frank Herbert'},{id:2,name:'Ada Vermeer'}] : [];
    let single = false;
    const q = {
      select() { return q; },
      in(key: string, values: unknown[]) { rows = rows.filter(r => values.map(String).includes(String(r[key]))); return q; },
      eq(key: string, value: unknown) { rows = rows.filter(r => String(r[key]) === String(value)); return q; },
      order(key: string) { rows = rows.toSorted((a,b) => String(a[key]).localeCompare(String(b[key]),'en',{numeric:true})); return q; },
      range(from: number,to: number) { rows = rows.slice(from,to+1); return q; },
      maybeSingle() { single = true; return q; },
      abortSignal() { return q; },
      then(resolve: (r:unknown)=>unknown) { return Promise.resolve(resolve({data:single?rows[0]??null:rows,error:null})); },
    };
    return q;
  },
  rpc(name: string, args: Record<string, unknown>) {
    const run=async()=>{
    if(name==='get_work_rating_summaries_v2') return {data:(args.target_work_ids as number[]).map(id=>({work_id:id,lumiscore:8.3,rating_count_band:'3–4',evidence_status:'available'})),error:null};
    if(name!=='catalog_discovery_page') throw Error('Unexpected fixture RPC');
    if(args.p_query==='fixture-load-error') return {data:null,error:{code:'TEST',message:'Synthetic query failure'}};
    const query=String(args.p_query).toLowerCase(),cats=args.p_categories as string[],langs=args.p_languages as string[];
    const rows=works.filter(w=>(w.title+' '+w.authors.name).toLowerCase().includes(query)
      &&(!args.p_author_id||w.author_id===Number(args.p_author_id))
      &&(!cats.length||cats.includes(category(w.id)))
      &&(!args.p_selection||w.id%3!==0)
      &&(!langs.length||editions.some(e=>e.work_id===w.id&&langs.some(l=>l==='nl'?e.language==='nld':e.language==='eng'))))
      .toSorted((a,b)=>(args.p_sort==='newest'?b.first_publish_year-a.first_publish_year:0)||a.title.localeCompare(b.title)||a.id-b.id);
    const size=Number(args.p_page_size),total=rows.length,page=Math.min(Number(args.p_page),Math.max(1,Math.ceil(total/size)));
    return {data:{workIds:rows.slice((page-1)*size,page*size).map(w=>w.id),total,page,selectionCount:111,facets:{fiction_fantasy:3,fiction_science_fiction:3}},error:null};
    };
    const task=run();return Object.assign(task,{abortSignal(){return task;}});
  },
};
