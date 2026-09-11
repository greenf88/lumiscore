import type { Metadata } from 'next';
import { LumiScoreWordmark } from '@/app/components/LumiScoreWordmark';

export const metadata: Metadata = {
  title: 'Book not found — LumiScore',
  robots: { index: false, follow: false },
};

export default function BookNotFound() {
  return (
    <main className="book-detail-shell book-not-found-shell">
      <header className="detail-header">
        <LumiScoreWordmark />
      </header>
      <section className="book-not-found" aria-labelledby="book-not-found-title">
        <span className="eyebrow">BOOK NOT FOUND</span>
        <h1 id="book-not-found-title">This book isn&apos;t in the catalog.</h1>
        <p>The link may be incorrect, or the book may no longer be available.</p>
        <a className="primary-cta" href="/#discover">Browse the catalog <span>→</span></a>
      </section>
    </main>
  );
}
