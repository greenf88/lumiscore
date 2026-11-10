import { notFound } from 'next/navigation';
import { DiscoveryPageShell } from '@/app/components/DiscoveryPageShell';
import { NEWS_PATH, publishedNews } from '@/lib/editorial/news';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { createPageMetadata } from '@/lib/seo/page-metadata';
import { loadHeaderAuthState } from '@/lib/supabase/auth';

const description = 'Boekennieuws op LumiScore, met bronverwijzingen en links naar de boeken waar het om gaat.';

export async function generateMetadata() {
  if ((await resolveRequestLocale()).locale !== 'nl') return {};
  return createPageMetadata({ title: 'Boekennieuws | LumiScore', description, canonicalPath: `/nl${NEWS_PATH}` });
}

export default async function NewsPage() {
  if ((await resolveRequestLocale()).locale !== 'nl') notFound();
  const authState = await loadHeaderAuthState().catch(() => ({ authenticated: false }));

  return <DiscoveryPageShell path={NEWS_PATH} authState={authState}>
    <section className="information-page information-page-compact" aria-labelledby="news-title">
      <header className="information-hero">
        <h1 id="news-title">Boekennieuws</h1>
        <p>{description}</p>
      </header>
      {publishedNews.map(article => <article key={article.slug} className="information-section">
        <h2><a href={`/nl${article.path}`}>{article.title}</a></h2>
        <p>{article.description}</p>
      </article>)}
    </section>
  </DiscoveryPageShell>;
}
