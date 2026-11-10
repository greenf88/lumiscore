import { notFound } from 'next/navigation';
import { DiscoveryPageShell } from '@/app/components/DiscoveryPageShell';
import { NEWS_PATH, publishedNews } from '@/lib/editorial/news';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { createPageMetadata } from '@/lib/seo/page-metadata';
import { absoluteLumiScoreUrl } from '@/lib/seo/site-origin';
import { loadHeaderAuthState } from '@/lib/supabase/auth';

type Props = { params: Promise<{ slug: string }> };

async function findArticle({ params }: Props) {
  const [{ slug }, { locale }] = await Promise.all([params, resolveRequestLocale()]);
  return locale === 'nl' ? publishedNews.find(article => article.slug === slug) : undefined;
}

export async function generateMetadata(props: Props) {
  const article = await findArticle(props);
  if (!article) return {};
  const metadata = createPageMetadata({
    title: `${article.title} | LumiScore`, description: article.description, canonicalPath: `/nl${article.path}`,
    type: 'article', image: article.image,
  });
  return { ...metadata, openGraph: { ...metadata.openGraph, locale: 'nl_NL',
    images: [{ url: absoluteLumiScoreUrl(article.image), width: 1200, height: 630, alt: article.imageAlt }],
  } };
}

export default async function NewsArticlePage(props: Props) {
  const article = await findArticle(props);
  if (!article) notFound();
  const authState = await loadHeaderAuthState().catch(() => ({ authenticated: false }));
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    image: [absoluteLumiScoreUrl(article.image)],
    inLanguage: 'nl',
    datePublished: article.date,
    mainEntityOfPage: absoluteLumiScoreUrl(`/nl${article.path}`),
    publisher: { '@type': 'Organization', name: 'LumiScore', url: absoluteLumiScoreUrl('/') },
  };

  return <DiscoveryPageShell path={article.path} authState={authState}>
    <article className="information-page information-page-compact" aria-labelledby="article-title">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replaceAll('<', '\\u003c') }} />
      <header className="information-hero">
        <a className="eyebrow" href={`/nl${NEWS_PATH}`}>← Boekennieuws</a>
        <h1 id="article-title">{article.title}</h1>
        <p>{article.lead}</p>
        <time className="information-disclaimer" dateTime={article.date}>
          {new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long', timeZone: 'Europe/Amsterdam' }).format(new Date(article.date))}
        </time>
      </header>
      <div className="information-content">
        {article.sections.map(section => <section className="information-section" key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        </section>)}
        <section className="information-section">
          <h2>Bronnen</h2>
          <ul>{article.sources.map(source => <li key={source.href}><a href={source.href}>{source.title}</a> ({source.date})</li>)}</ul>
        </section>
        <section className="information-section">
          <h2>Verder lezen</h2>
          <div className="information-actions">
            <a className="ui-control ui-primary" href={article.book.href}>Bekijk {article.book.title}</a>
            <a className="ui-control ui-secondary" href="/nl/taste-test">Ontdek je leessmaak</a>
          </div>
        </section>
      </div>
    </article>
  </DiscoveryPageShell>;
}
