// Standalone LOCAL UI fixture: real components/styles, synthetic API, no Supabase/Auth keys.
// This is responsive/interaction proof, not authentication or database proof.
import { createRoot } from 'react-dom/client';
import { RatingTasteTest } from '../../app/components/RatingTasteTest';
import { LumiScoreLocaleProvider } from '../../app/components/LumiScoreLocale';
import { isLocale, LOCALE_STORAGE_KEY } from '../../lib/i18n/config';
import '../../app/globals.css';
const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
const locale = isLocale(stored) ? stored : 'nl';
const theme = localStorage.getItem('lumiscore-theme') === 'paper' ? 'paper' : 'ink';
document.documentElement.dataset.theme = theme;
createRoot(document.getElementById('root')!).render(
  <LumiScoreLocaleProvider initialLocale={locale} hasPersistedChoice={true}>
    <RatingTasteTest authState={{ authenticated: true, displayName: 'Lokale testlezer', avatarLetter: 'T' }} swipePrototype={false} />
  </LumiScoreLocaleProvider>,
);
