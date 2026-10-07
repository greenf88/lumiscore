// LOCAL visual fixture only. Provider examples are not catalog or user records.
import type { Book } from '../../app/data/books';
import { BookCard, BookCover } from '../../app/components/LumiScoreHome';

const cover = 'https://covers.openlibrary.org/b/id/12547191-L.jpg?default=false';
const sample: Book = {
  id: 'local-cover-example', workId: '990101', source: 'demo',
  title: 'Covercontrole', author: 'Open Library-bronvoorbeeld 12547191',
  cover: 'orbit', score: null, ratingsCount: null, match: null, coverUrls: [cover],
};
export function CoverPreview() {
  return <main style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
    <h1>Lokale covercontrole</h1>
    <p>Alleen een visuele bronfixture. Geen catalogus- of gebruikersgegevens.</p>
    <div className="book-grid">
      <BookCard book={sample} resolveMissingCover={false} />
      <BookCard book={{ ...sample, id: 'local-cover-fallback', title: 'Fallbackcontrole', coverUrls: ['/missing-local-cover.jpg', cover] }} resolveMissingCover={false} />
    </div>
    <h2>Compacte lijst</h2>
    <BookCover book={sample} small resolveMissing={false} label="Compacte cover" />
    <h2>Smaaktest — medium</h2>
    <div className="taste-book-identity" style={{ marginBottom: 16 }}>
      <BookCover book={sample} presentation="taste" resolveMissing={false} label="Smaaktestcover" />
      <div className="book-card-body"><h3>Covercontrole</h3><p>Open Library-bronvoorbeeld 12547191</p></div>
    </div>
    <h2>Boekdetail — groot</h2>
    <div className="detail-cover-wrap" style={{ width: 200 }}>
      <BookCover book={sample} presentation="detail" resolveMissing={false} label="Detailcover" />
    </div>
  </main>;
}
