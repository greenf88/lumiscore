// Standalone LOCAL UI fixture: real components/styles, synthetic API, no Supabase/Auth keys.
// This is responsive/interaction proof, not authentication or database proof.
import { createRoot } from 'react-dom/client';
import { RatingTasteTest } from '../../app/components/RatingTasteTest';
import { CoverPreview } from './CoverPreview';
import { HomePreview } from './HomePreview';
import { TasteRatingResult } from '../../app/components/TasteRatingResult';
import { LumiScoreLocaleProvider } from '../../app/components/LumiScoreLocale';
import { isLocale, LOCALE_STORAGE_KEY } from '../../lib/i18n/config';
import '../../app/globals.css';
const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
const locale = isLocale(stored) ? stored : 'nl';
const theme = localStorage.getItem('lumiscore-theme') === 'paper' ? 'paper' : 'ink';
document.documentElement.dataset.theme = theme;
createRoot(document.getElementById('root')!).render(
  <LumiScoreLocaleProvider initialLocale={locale} hasPersistedChoice={true}>
    {location.pathname === '/covers' ? <CoverPreview />
      : location.pathname === '/' ? <HomePreview guest={new URLSearchParams(location.search).has('guest')} />
      : location.pathname === '/recommendations' ? <HomePreview fullRecommendations />
      : location.pathname === '/taste-test/result' ? <TasteRatingResult authState={{ authenticated: true, displayName: 'Lokale testlezer', avatarLetter: 'T' }} />
      : <RatingTasteTest authState={{ authenticated: true, displayName: 'Lokale testlezer', avatarLetter: 'T' }} swipePrototype={false} />}
  </LumiScoreLocaleProvider>,
);
