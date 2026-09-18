'use client';

import { Fragment, useCallback, useState } from 'react';
import type { HeaderAuthState } from '@/lib/auth/header';
import type {
  InformationPageContent,
  InformationTextPart,
} from '@/lib/information/pages';
import { Footer, Header } from './LumiScoreHome';

function RichText({ parts }: { parts: InformationTextPart[] }) {
  return parts.map((part, index) => typeof part === 'string' ? (
    <Fragment key={`${part}-${index}`}>{part}</Fragment>
  ) : (
    <a href={part.href} key={`${part.href}-${index}`}>{part.text}</a>
  ));
}

export function LumiScoreInformationPage({
  content,
  authState,
}: {
  content: InformationPageContent;
  authState: HeaderAuthState;
}) {
  const [query, setQuery] = useState('');
  const toggleTheme = useCallback(() => {
    const next = document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next === 'paper' ? 'light' : 'dark';
    localStorage.setItem('lumiscore-theme', next);
  }, []);

  return (
    <main className="site-shell information-page-shell">
      <Header
        onThemeToggle={toggleTheme}
        query={query}
        onQueryChange={setQuery}
        authState={authState}
        returnTo={content.path}
      />
      <article className="information-page" aria-labelledby="information-page-title">
        <header className="information-hero">
          <span className="eyebrow">{content.eyebrow}</span>
          <h1 id="information-page-title">{content.title}</h1>
          <p>{content.lead}</p>
        </header>
        <div className="information-content">
          {content.sections.map((section) => (
            <section className="information-section" key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((paragraph, index) => (
                <p key={`${section.heading}-paragraph-${index}`}>
                  <RichText parts={paragraph} />
                </p>
              ))}
              {section.bullets && (
                <ul>
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              )}
              {section.afterBullets?.map((paragraph, index) => (
                <p className="information-after-list" key={`${section.heading}-after-list-${index}`}>
                  <RichText parts={paragraph} />
                </p>
              ))}
              {section.email && (
                <a className="information-email" href={section.email.href}>
                  {section.email.address}
                  <span aria-hidden="true">→</span>
                </a>
              )}
            </section>
          ))}
        </div>
      </article>
      <Footer onThemeToggle={toggleTheme} />
    </main>
  );
}
