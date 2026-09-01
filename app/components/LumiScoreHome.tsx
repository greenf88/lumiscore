'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { books, type Book } from '../data/books';
import { getOpenLibraryCoverUrl } from '@/lib/books/covers';

function BookCover({ book, small = false }: { book: Book; small?: boolean }) {
  const coverUrl = getOpenLibraryCoverUrl(book.isbn13);

  return (
    <div className={`book-cover cover-${book.cover}${small ? ' book-cover-small' : ''}`} aria-hidden="true">
      <span className="cover-kicker">Lumi edition</span>
      <span className="cover-title">{book.title}</span>
      <span className="cover-mark">✦</span>
      <span className="cover-author">{book.author}</span>
      {coverUrl && (
        <Image
          className="book-cover-image"
          src={coverUrl}
          alt=""
          fill
          sizes={small ? '43px' : '(max-width: 820px) 245px, (max-width: 1180px) 30vw, 15vw'}
          loading="lazy"
          unoptimized
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
    </div>
  );
}

function SearchBar({ query, onChange, mobile = false }: { query: string; onChange: (value: string) => void; mobile?: boolean }) {
  return (
    <label className={`search-bar${mobile ? ' search-bar-mobile' : ''}`}>
      <span className="sr-only">Search books, authors, or ISBNs</span>
      <span className="search-icon" aria-hidden="true" />
      <input value={query} onChange={(event) => onChange(event.target.value)} placeholder="Search books, authors, ISBNs" />
      {!mobile && <kbd>⌘ K</kbd>}
    </label>
  );
}

function ThemeToggle({ onToggle, labeled = false }: { onToggle: () => void; labeled?: boolean }) {
  return (
    <button className={`theme-toggle${labeled ? ' theme-toggle-labeled' : ''}`} type="button" onClick={onToggle} aria-label="Toggle Ink and Paper theme">
      {labeled && <><span className="toggle-label toggle-label-ink">Ink</span><span className="toggle-label toggle-label-paper">Paper</span></>}
      <span className="theme-sun" aria-hidden="true">☼</span>
      <span className="theme-track"><span className="theme-thumb" /></span>
      <span className="theme-moon" aria-hidden="true">☾</span>
    </button>
  );
}

function Header({ onThemeToggle, query, onQueryChange }: { onThemeToggle: () => void; query: string; onQueryChange: (value: string) => void }) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <header className="site-header">
      <a className="wordmark" href="#top" aria-label="LumiScore home">
        <span className="logo-mark" aria-hidden="true"><i /><i /><i /></span>
        <span>Lumi<span>Score</span></span>
      </a>
      <div className="header-search"><SearchBar query={query} onChange={onQueryChange} /></div>
      <nav className="main-nav" aria-label="Main navigation">
        <a href="#discover">Discover</a>
        <a href="#lists">My lists</a>
        <button className="mobile-search-button" type="button" aria-label="Open search" aria-expanded={mobileSearchOpen} onClick={() => setMobileSearchOpen((open) => !open)}><span className="search-icon" aria-hidden="true" /></button>
        <ThemeToggle onToggle={onThemeToggle} />
        <button className="avatar" type="button" aria-label="Open profile">RG</button>
      </nav>
      {mobileSearchOpen && <div className="mobile-search-drawer"><SearchBar query={query} onChange={onQueryChange} mobile /></div>}
    </header>
  );
}

function RecommendationRow({ book }: { book: Book }) {
  return (
    <a className="recommendation-row" href={`#${book.id}`}>
      <BookCover book={book} small />
      <span className="recommendation-copy">
        <strong>{book.title}</strong>
        <span>{book.author}</span>
        <span className="match-line"><i /> {book.match}% match</span>
      </span>
      <span className="mini-score"><strong>{book.score.toFixed(1)}</strong><small>LumiScore</small></span>
    </a>
  );
}

function RecommendationPanel({ books }: { books: Book[] }) {
  const recommendations = [books[1], books[2], books[5]].filter(
    (book): book is Book => Boolean(book),
  );
  return (
    <aside className="recommendation-panel" aria-labelledby="up-next-title">
      <div className="panel-heading">
        <div><span className="eyebrow">CURATED FOR YOUR TASTE</span><h2 id="up-next-title">Up next for you</h2></div>
        <button type="button" aria-label="Refresh recommendations">↻</button>
      </div>
      <div className="recommendation-list">{recommendations.map((book) => <RecommendationRow key={book.id} book={book} />)}</div>
      <a className="view-all" href="#discover">View all recommendations <span>→</span></a>
    </aside>
  );
}

function Hero({ books }: { books: Book[] }) {
  return (
    <section className="hero" id="top">
      <div className="hero-photo" aria-hidden="true" />
      <div className="hero-wash" aria-hidden="true" />
      <div className="hero-inner">
        <div className="hero-copy">
          <span className="eyebrow hero-eyebrow"><i /> YOUR NEXT FIVE-STAR READ</span>
          <h1>Find your next<br /><em>great read</em></h1>
          <p className="hero-primary">Smart recommendations. Real reader matches.</p>
          <p className="hero-paper-copy">LumiScore analyzes millions of reader ratings to help you discover books you&apos;ll truly love.</p>
          <a className="primary-cta" href="#discover">Find your next book <span>→</span></a>
          <div className="paper-features">
            <div><i>✦</i><span><strong>Smart recommendations</strong><small>Personalized for you</small></span></div>
            <div><i>✓</i><span><strong>Trusted by readers</strong><small>Real ratings. Real matches.</small></span></div>
          </div>
          <a className="learn-link" href="#how-it-works">New here? Learn how LumiScore works <span>→</span></a>
          <dl className="hero-stats">
            <div><dt>4.2M+</dt><dd>Books rated</dd></div><div><dt>860K</dt><dd>Active readers</dd></div><div><dt>94%</dt><dd>Find a match</dd></div>
          </dl>
        </div>
        <RecommendationPanel books={books} />
      </div>
    </section>
  );
}

function formatRatings(count: number) {
  return count >= 1000 ? `${Math.round(count / 1000)}k ratings` : `${count} ratings`;
}

function BookCard({ book, wanted, onToggle }: { book: Book; wanted: boolean; onToggle: (id: string) => void }) {
  return (
    <article className="book-card" id={book.id}>
      <div className="card-cover-wrap">
        <BookCover book={book} />
        <span className="score-badge"><strong>{book.score.toFixed(1)}</strong><small>LumiScore</small></span>
      </div>
      <div className="book-card-body">
        <span className="book-genre">{book.genre}</span>
        <h3>{book.title}</h3>
        <p>{book.author}</p>
        <div className="book-meta"><span>{formatRatings(book.ratingsCount)}</span><span className="book-match"><i /> {book.match}% match</span></div>
        <button className={`want-button${wanted ? ' is-wanted' : ''}`} type="button" onClick={() => onToggle(book.id)} aria-pressed={wanted}>
          <span aria-hidden="true">{wanted ? '✓' : '+'}</span>{wanted ? 'Want to read' : 'Want to read'}
        </button>
      </div>
    </article>
  );
}

function FeaturedBooks({ books, query, wanted, onToggle }: { books: Book[]; query: string; wanted: Set<string>; onToggle: (id: string) => void }) {
  const filteredBooks = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return books;
    return books.filter((book) => `${book.title} ${book.author} ${book.genre ?? ''}`.toLowerCase().includes(search));
  }, [books, query]);

  return (
    <section className="featured-section" id="discover" aria-labelledby="featured-title">
      <div className="section-heading">
        <div><span className="eyebrow">CHOSEN BY READERS</span><h2 id="featured-title">{query ? 'Search results' : 'Featured today'}</h2></div>
        <div className="section-tools"><span>{filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}</span><a href="#top">Explore all <b>→</b></a></div>
      </div>
      {filteredBooks.length > 0 ? (
        <div className="book-grid">{filteredBooks.map((book) => <BookCard key={book.id} book={book} wanted={wanted.has(book.id)} onToggle={onToggle} />)}</div>
      ) : (
        <div className="empty-results"><span>⌕</span><h3>No books found</h3><p>Try another title, author, or genre.</p></div>
      )}
    </section>
  );
}

const values = [
  { icon: '✦', title: 'Personalized picks', copy: 'Made for your reading taste' },
  { icon: '◎', title: 'Real reader matches', copy: 'Taste-based, not sponsored' },
  { icon: '8.7', title: 'Trusted scores', copy: 'Millions of ratings distilled' },
  { icon: '✓', title: 'Track & discover', copy: 'One library, always with you' },
];

function ValueStrip() {
  return (
    <section className="value-strip" id="how-it-works" aria-label="Why LumiScore">
      <div className="value-inner">{values.map((value) => (
        <div className="value-item" key={value.title}><span className="value-icon">{value.icon}</span><span><strong>{value.title}</strong><small>{value.copy}</small></span></div>
      ))}</div>
    </section>
  );
}

function Footer({ onThemeToggle }: { onThemeToggle: () => void }) {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <a className="wordmark" href="#top"><span className="logo-mark" aria-hidden="true"><i /><i /><i /></span><span>Lumi<span>Score</span></span></a>
        <p>Your next great read is closer than you think.</p>
        <a className="domain-link" href="#top">lumisco.re</a>
      </div>
      <nav className="footer-nav" aria-label="Footer navigation"><a href="#top">About</a><a href="#how-it-works">How it works</a><a href="#top">For publishers</a><a href="#top">Help</a></nav>
      <div className="footer-theme"><span>Reading mode</span><ThemeToggle onToggle={onThemeToggle} labeled /></div>
      <div className="footer-bottom"><span>© 2026 LumiScore</span><span>Made for readers everywhere.</span></div>
    </footer>
  );
}

export function LumiScoreHome() {
  const [catalogBooks, setCatalogBooks] = useState<Book[]>(books);
  const [query, setQuery] = useState('');
  const [wanted, setWanted] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ) {
      return;
    }

    let active = true;

    void import('@/lib/supabase/books')
      .then(({ addEditionIsbns }) => addEditionIsbns(books))
      .then((enrichedBooks) => {
        if (active) setCatalogBooks(enrichedBooks);
      })
      .catch(() => {
        // The local catalog and styled cover placeholders remain available.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let animationFrame = 0;
    try {
      const stored = JSON.parse(localStorage.getItem('lumiscore-wanted') ?? '[]') as string[];
      animationFrame = requestAnimationFrame(() => setWanted(new Set(stored)));
    } catch { /* local preference is optional */ }
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('.search-bar input')?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next === 'paper' ? 'light' : 'dark';
    localStorage.setItem('lumiscore-theme', next);
  };

  const toggleWanted = (id: string) => {
    setWanted((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('lumiscore-wanted', JSON.stringify([...next]));
      return next;
    });
  };

  return (
    <main className="site-shell">
      <Header onThemeToggle={toggleTheme} query={query} onQueryChange={setQuery} />
      <Hero books={catalogBooks} />
      <FeaturedBooks books={catalogBooks} query={query} wanted={wanted} onToggle={toggleWanted} />
      <ValueStrip />
      <Footer onThemeToggle={toggleTheme} />
    </main>
  );
}
