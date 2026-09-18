export type VerifiedBookCoverAsset = {
  side: 'back';
  url: string;
  source: string;
  sourceKey: string;
  isbn13?: string | null;
  verified: true;
};

export type VerifiedBookDescription = {
  text: string;
  source: 'open_library' | 'google_books';
  sourceKey: string;
  verifiedAt: string;
  language?: 'en' | 'nl' | null;
};

export type BookDescriptionEditionCandidate = {
  openLibraryEditionId: string | null;
  isbn13: string | null;
  editionLanguage: string | null;
};

export type Book = {
  id: string;
  source: 'demo' | 'supabase';
  workId?: string | null;
  editionId?: string | null;
  sourceType?: 'open_library' | 'lumiscore_native' | string | null;
  openLibraryWorkId?: string | null;
  openLibraryEditionId?: string | null;
  title: string;
  author: string;
  firstPublishYear?: number | null;
  score: number | null;
  ratingsCount: number | null;
  match: number | null;
  cover: string;
  isbn10?: string | null;
  isbn13?: string | null;
  editionTitle?: string | null;
  editionPublisher?: string | null;
  editionLanguage?: string | null;
  coverUrls?: string[];
  backCover?: VerifiedBookCoverAsset | null;
  descriptionCandidates?: BookDescriptionEditionCandidate[];
  genre?: string;
};

export const books: Book[] = [
  { id: 'project-hail-mary', source: 'demo', title: 'Project Hail Mary', author: 'Andy Weir', score: 8.8, ratingsCount: 482000, match: 96, cover: 'orbit', genre: 'Science fiction' },
  { id: 'will-of-the-many', source: 'demo', title: 'The Will of the Many', author: 'James Islington', score: 8.7, ratingsCount: 84000, match: 91, cover: 'laurel', genre: 'Fantasy' },
  { id: 'demon-copperhead', source: 'demo', title: 'Demon Copperhead', author: 'Barbara Kingsolver', score: 8.6, ratingsCount: 313000, match: 78, cover: 'copper', genre: 'Literary fiction' },
  { id: 'the-women', source: 'demo', title: 'The Women', author: 'Kristin Hannah', score: 8.5, ratingsCount: 624000, match: 88, cover: 'women', genre: 'Historical fiction' },
  { id: 'the-road', source: 'demo', title: 'The Road', author: 'Cormac McCarthy', score: 8.5, ratingsCount: 915000, match: 82, cover: 'road', genre: 'Post-apocalyptic' },
  { id: 'dark-matter', source: 'demo', title: 'Dark Matter', author: 'Blake Crouch', score: 8.4, ratingsCount: 721000, match: 95, cover: 'matter', genre: 'Science fiction' },
];
