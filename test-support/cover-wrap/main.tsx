// Loopback-only geometry fixture. Real shared cards, no DB/Auth/remote images.
import {createRoot} from 'react-dom/client';
import {LumiScoreLocaleProvider} from '../../app/components/LumiScoreLocale';
import {DiscoveryPageShell} from '../../app/components/DiscoveryPageShell';
import {BookCard} from '../../app/components/LumiScoreHome';
import type {Book} from '../../app/data/books';
import '../../app/globals.css';
const locale=location.pathname.startsWith('/en')?'en':'nl';
document.documentElement.dataset.theme=new URLSearchParams(location.search).get('theme')==='ink'?'ink':'paper';
const titles=['Waterschapsheuvel',"Hadrianus' gedenkschriften",'TEST'.repeat(20),'Waterschapsheuvel'];
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#42646b"/><text x="20" y="80" fill="white">TEST ONLY</text></svg>');
const books:Book[]=titles.map((title,i)=>({id:'geometry-'+i,source:'supabase',workId:String(i+1),title,author:'Geometry fixture only',score:null,ratingsCount:0,match:null,cover:'orbit',coverUrls:i===3?[image]:[],strictEditionLanguage:locale,editionAvailable:true,editionLanguage:locale==='nl'?'nld':'eng'}));
createRoot(document.getElementById('root')!).render(<LumiScoreLocaleProvider initialLocale={locale} hasPersistedChoice initialPath="/review"><DiscoveryPageShell authState={{authenticated:false}} path="/review"><section className="featured-section"><h1>Local geometry regression</h1><div className="book-grid browse-grid">{books.map(book=><BookCard key={book.id} book={book} resolveMissingCover={false}/>)}</div></section></DiscoveryPageShell></LumiScoreLocaleProvider>);
