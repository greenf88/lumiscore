'use client';

import Link from 'next/link';
import type { Book } from '../data/books';
import { BookCover, ThemeToggle } from './LumiScoreHome';

export function LumiScoreBookDetail({ book }: { book: Book }) {
  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next === 'paper' ? 'light' : 'dark';
    localStorage.setItem('lumiscore-theme', next);
  };

  return (
    <main className="book-detail-shell">
      <header className="detail-header">
        <Link className="wordmark" href="/" aria-label="LumiScore home">
          <span className="logo-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>Lumi<span>Score</span></span>
        </Link>
        <ThemeToggle onToggle={toggleTheme} labeled />
      </header>

      <article className="book-detail">
        <div className="detail-cover-wrap">
          <span className="score-badge detail-score-badge"><strong>—</strong><small>LumiScore</small></span>
          <BookCover book={book} />
        </div>
        <div className="detail-copy">
          <Link className="detail-back-link" href="/#discover">← Back to books</Link>
          <span className="eyebrow">OPEN LIBRARY WORK</span>
          <h1>{book.title}</h1>
          <p className="detail-author">by {book.author}</p>
          <dl className="detail-metadata">
            <div><dt>First published</dt><dd>{book.firstPublishYear ?? 'Unknown'}</dd></div>
            <div><dt>LumiScore</dt><dd>Not rated yet</dd></div>
            {book.isbn13 && <div><dt>ISBN-13</dt><dd>{book.isbn13}</dd></div>}
            {book.openLibraryWorkId && <div><dt>Open Library</dt><dd>{book.openLibraryWorkId}</dd></div>}
          </dl>
          <p className="detail-note">Reader ratings and personalized ranking are not available for this book yet.</p>
        </div>
      </article>
    </main>
  );
}
