// LOCAL ONLY: real interface, synthetic identities; never a catalog or Auth seed.
import type { Book } from '../../app/data/books';
import type { HomepagePersonalization } from '../../lib/supabase/taste-test';
import { LumiScoreHome, RecommendationsSection } from '../../app/components/LumiScoreHome';
import { DiscoveryPageShell } from '../../app/components/DiscoveryPageShell';

const titles = ['De stad aan het einde van de wereld', 'Een reis door het onbekende', 'Het huis tussen de sterren'];
const books: Book[] = Array.from({ length: 20 }, (_, index) => ({
  id: `local-overview-${index}`, workId: String(991001 + index), source: 'demo',
  title: index === 3 ? 'Een uitzonderlijk lange geschiedenis van een huis tussen de sterren' : `${titles[index % titles.length]} ${index + 1}`,
  author: index === 3 ? 'Synthetische Auteur met een Lange Naam' : 'Synthetische Auteur',
  firstPublishYear: 1990 + index, cover: 'orbit', coverUrls: ['/compact-cover.svg'],
  score: index < 8 ? 9 - index / 10 : null, ratingsCount: null,
  ratingBand: index < 8 ? '3–4' : null, match: null,
}));
const authState = { authenticated: true, displayName: 'Lokale testlezer', avatarLetter: 'T' };
const personal = (limit: number): HomepagePersonalization => ({
  authenticated: true, hasEvidence: true, ratingCount: 20, tasteTestAnsweredCount: 20,
  recommendations: books.slice(0, limit).map(book => ({
    book: { ...book, score: null, ratingBand: null }, matchScore: null, matchLabel: 'Early match',
    matchConfidence: 'low', explanation: 'Lokale visuele fixture — geen echt persoonlijk advies.',
    coverageLevel: 'partial', metadataConfidence: .7, collaborativeExplanation: '',
  })),
});

export function HomePreview({ guest = false, fullRecommendations = false }: { guest?: boolean; fullRecommendations?: boolean }) {
  if (fullRecommendations) return <DiscoveryPageShell authState={authState} path="/recommendations">
    <RecommendationsSection personalization={personal(20)} returnTo="/recommendations" />
  </DiscoveryPageShell>;
  return <LumiScoreHome initialBooks={books.slice(0, 8)} catalogStats={{ books: 20, categories: 0 }}
    personalization={guest ? { authenticated: false, hasEvidence: false, ratingCount: 0, tasteTestAnsweredCount: 0, recommendations: [] } : personal(3)}
    authState={guest ? { authenticated: false } : authState} catalogUnavailable={false} seriesContinuations={[]}
    dutchDiscovery={{ popular: { books: [], current: false, personalized: false, sourceName: '', sourceUrl: '', year: 0, week: 0 }, classics: { books: [], personalized: false } }} />;
}
