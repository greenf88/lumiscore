// LOCAL public bibliographic capture, real components; NOT hosted/Auth/storage proof.
import {createRoot} from 'react-dom/client';
import {LumiScoreLocaleProvider} from '../../app/components/LumiScoreLocale';
import {DiscoveryPageShell} from '../../app/components/DiscoveryPageShell';
import {BookCard} from '../../app/components/LumiScoreHome';
import {LumiScoreBookDetail} from '../../app/components/LumiScoreBookDetail';
import {EditionPresentationLabel} from '../../app/components/EditionPresentationLabel';
import {BookCover} from '../../app/components/LumiScoreHome';
import {DirectRatingScores} from '../../app/components/DirectRatingScores';
import {selectStrictEdition,withStrictEdition,unavailableEdition} from '../../lib/books/strict-edition';
import {editionSourceCoverUrls} from '../../lib/books/edition-cover-evidence';
import {capturedWorks,reviewedProposalWorks,sourceEditions} from './cases';
import type {Book,VerifiedBookDescription} from '../../app/data/books';
import {EMPTY_RATING_STATE} from '../../lib/ratings/model';
import '../../app/globals.css';
const locale=location.pathname.startsWith('/en')?'en':'nl',params=new URLSearchParams(location.search);
const proposal=params.get('proposal')==='1',rows=proposal?reviewedProposalWorks:capturedWorks;
document.documentElement.dataset.theme=localStorage.getItem('lumiscore-theme')==='ink'?'ink':'paper';
const books=rows.map(row=>{const base:Book={id:'work-'+row.id,source:'supabase',workId:String(row.id),title:row.title,author:row.authors.name,
 openLibraryWorkId:row.open_library_id,firstPublishYear:row.first_publish_year,cover:'orbit',score:null,ratingsCount:null,match:null};
 const book=withStrictEdition(base,selectStrictEdition(row.editions,locale,row.title),locale)??unavailableEdition(base,locale);
 return {...book,coverUrls:editionSourceCoverUrls(book,sourceEditions['/books/'+book.openLibraryEditionId])};});
const chosen=books.find(b=>b.workId===(params.get('work')??'1456'))!;
const excerpt:VerifiedBookDescription|null=chosen.workId==='1342'&&locale==='nl'?{text:'Philippe is veertig, commercieel directeur, getrouwd en vader van twee kinderen.',source:'open_library',sourceKey:'OL61048815M',verifiedAt:'2026-10-18',language:'nl'}:null;
const detail=params.get('view')==='detail',taste=params.get('view')==='taste';
createRoot(document.getElementById('root')!).render(<LumiScoreLocaleProvider initialLocale={locale} hasPersistedChoice initialPath={'/review'+location.search}>
 {detail?<LumiScoreBookDetail book={chosen} description={excerpt} initialRatingState={EMPTY_RATING_STATE} initialReadingStatus={null} collectionContext={null}
 personalization={{authenticated:false,hasEvidence:false,candidate:null,match:null}} authState={{authenticated:false}} returnNavigation={{kind:'browse',href:'/review'}}/>:
 <DiscoveryPageShell authState={{authenticated:false}} path={'/review'+location.search}>
  <section className="featured-section"><p className="eyebrow">Lokale broncapture · geen opslag</p><h1>{locale==='nl'?'Editiecontrole':'Edition review'}</h1>
  <p>{proposal?'Wat-als met het NIET toegepaste Grunberg-correctievoorstel.':'Huidige cataloguswaarden. Grunberg bevat nog een foutieve taalcode; zie apart voorstel.'}</p>
  {taste?<div className="taste-rating-test taste-direct-test"><article className="book-card taste-rating-card"><div className="taste-book-identity"><BookCover book={chosen} presentation="taste" resolveMissing={false}/><div className="book-card-body"><h2>{chosen.title}</h2><p>{chosen.author}</p><EditionPresentationLabel book={chosen}/></div></div>
   <DirectRatingScores workId={chosen.workId!} pending={false} selection={null} onRate={()=>{}}/></article></div>:
  <div className="book-grid">{books.filter(book=>book.editionAvailable).map(book=><BookCard key={book.workId} book={book} resolveMissingCover={false}/>)}</div>}
  </section>
 </DiscoveryPageShell>}
 </LumiScoreLocaleProvider>);
