export type Book = {
  id: string;
  workId?: string | null;
  title: string;
  author: string;
  score: number;
  ratingsCount: number;
  match: number;
  cover: string;
  isbn13?: string | null;
  genre?: string;
};

export const books: Book[] = [
  { id: 'project-hail-mary', title: 'Project Hail Mary', author: 'Andy Weir', score: 8.8, ratingsCount: 482000, match: 96, cover: 'orbit', genre: 'Science fiction' },
  { id: 'will-of-the-many', title: 'The Will of the Many', author: 'James Islington', score: 8.7, ratingsCount: 84000, match: 91, cover: 'laurel', genre: 'Fantasy' },
  { id: 'demon-copperhead', title: 'Demon Copperhead', author: 'Barbara Kingsolver', score: 8.6, ratingsCount: 313000, match: 78, cover: 'copper', genre: 'Literary fiction' },
  { id: 'the-women', title: 'The Women', author: 'Kristin Hannah', score: 8.5, ratingsCount: 624000, match: 88, cover: 'women', genre: 'Historical fiction' },
  { id: 'the-road', title: 'The Road', author: 'Cormac McCarthy', score: 8.5, ratingsCount: 915000, match: 82, cover: 'road', genre: 'Post-apocalyptic' },
  { id: 'dark-matter', title: 'Dark Matter', author: 'Blake Crouch', score: 8.4, ratingsCount: 721000, match: 95, cover: 'matter', genre: 'Science fiction' },
];
