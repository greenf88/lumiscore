'use client';
import type {HeaderAuthState} from '@/lib/auth/header';
import type {ReadingProfileData} from '@/lib/supabase/reading-profile';
import {DiscoveryPageShell} from './DiscoveryPageShell';
import {LocaleLink,useLumiScoreLocale} from './LumiScoreLocale';
import {TasteProfileSummary} from './TasteProfileSummary';
import {localizedHref} from '@/lib/i18n/paths';
export function LumiScoreReadingProfile({authState,email,data}:{authState:HeaderAuthState;email:string|null;data:ReadingProfileData|null}) {
  const {locale}=useLumiScoreLocale(),nl=locale==='nl';
  return <DiscoveryPageShell authState={authState} path="/account">
    <section className="reading-profile-page" aria-labelledby="reading-profile-title">
      <span className="eyebrow">{nl?'Account':'Account'}</span>
      <h1 id="reading-profile-title">{nl?'Mijn leesprofiel':'My reading profile'}</h1>
      {authState.displayName&&<p className="reading-profile-name">{authState.displayName}</p>}
      {email&&<p className="reading-profile-email">{email}</p>}
      {!data?<p role="alert">{nl?'Je leesprofiel kon niet laden. Je gegevens blijven bewaard. Probeer later opnieuw.':'Your reading profile could not load. Your data is safe. Please try again later.'}</p>:<>
        <dl className="reading-profile-totals" aria-label={nl?'Jouw boeken':'Your books'}>
          {(['read','rated','wantToRead','reading'] as const).map((key,i)=><div key={key}>
            <dt>{(nl?['Gelezen','Beoordeeld','Wil ik lezen','Aan het lezen']:['Read','Rated','Want to read','Reading'])[i]}</dt>
            <dd>{data.totals[key].toLocaleString(nl?'nl-NL':'en-US')}</dd>
          </div>)}
        </dl>
        <p className="reading-profile-count-note">{nl?'Beoordeelde boeken tellen ook als gelezen.':'Rated books also count as read.'}</p>
        <section aria-labelledby="account-taste-title">
          <TasteProfileSummary profile={data.profile} headingId="account-taste-title" level={2} />
          <LocaleLink className="reading-profile-action" href="/taste-test">{nl?(data.profile.ratingCount?'Smaaktest bijwerken':'Ontdek je leessmaak'):(data.profile.ratingCount?'Update your taste test':'Discover your reading taste')}</LocaleLink>
        </section>
      </>}
      <nav className="reading-profile-navigation" aria-label={nl?'Jouw account':'Your account'}>
        <LocaleLink href="/my-books">{nl?'Mijn boeken':'My books'}<span aria-hidden="true">→</span></LocaleLink>
        <LocaleLink href="/reading-preferences?next=%2Faccount">{nl?'Leesvoorkeuren':'Reading preferences'}<span aria-hidden="true">→</span></LocaleLink>
        <form action="/auth/sign-out" method="post"><input type="hidden" name="next" value={localizedHref('/',locale)} /><button type="submit">{nl?'Uitloggen':'Sign out'}</button></form>
      </nav>
    </section>
  </DiscoveryPageShell>;
}
