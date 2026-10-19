// Synthetic rendering fixture only. No database, accounts, writes or live Dune data.
import {createRoot} from 'react-dom/client';
import {LumiScoreLocaleProvider} from '../../app/components/LumiScoreLocale';
import {LumiScoreCollectionPage} from '../../app/components/LumiScoreCollectionPage';
import type {CollectionBook} from '../../lib/collections/model';
import type {CollectionPageData} from '../../lib/supabase/collections';
import '../../app/globals.css';
const locale=location.pathname.startsWith('/en')?'en':'nl';
document.documentElement.dataset.theme=location.search.includes('paper')?'paper':'ink';
const all=Array.from({length:6},(_,i)=>({workId:String(i+1),sequenceNumber:i+1,publicationOrder:i+1,subgroup:null,book:{id:'work-'+(i+1),source:'supabase',workId:String(i+1),title:'Synthetic collection volume '+(i+1),author:'Synthetic author',cover:'orbit',score:null,ratingsCount:null,match:null}})) as CollectionBook[];
const data:CollectionPageData={collection:{id:'synthetic',slug:'synthetic-language',name:locale==='nl'?'Lokale taalcontrole — synthetisch':'Local language check — synthetic',collectionType:'series',description:null,expectedMainSeriesTotal:6},books:all.filter(b=>!['2','5'].includes(b.workId)),progressBooks:all,authenticated:true,statuses:{'2':'read','5':'read'},ratedWorkIds:['5'],userRatings:{'5':8},progress:{read:2,cataloguedTotal:6,total:6,percentage:33},highlightedUnreadWorkId:null};
createRoot(document.getElementById('root')!).render(<LumiScoreLocaleProvider initialLocale={locale} hasPersistedChoice initialPath="/collection/synthetic-language"><LumiScoreCollectionPage data={data}/></LumiScoreLocaleProvider>);
