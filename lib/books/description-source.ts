import type { VerifiedBookDescription } from '@/app/data/books';
import { reviewedDescriptionSource } from './reviewed-descriptions.ts';
import { safePublicSource } from './stored-presentation.ts';

export function publicDescriptionSource(description: VerifiedBookDescription): { name: string; href: string } | null {
  if (description.source === 'official_publisher' || description.source === 'official_catalog') {
    if(safePublicSource(description.sourceUrl)&&description.sourceUrl===description.sourceKey&&description.sourceName)
      return {name:description.sourceName,href:description.sourceUrl};
    return reviewedDescriptionSource(description.sourceKey, description.source);
  }
  if (description.source === 'open_library' && /^OL\d+[WM]$/.test(description.sourceKey)) return {
    name: 'Open Library', href: `https://openlibrary.org/${description.sourceKey.endsWith('W') ? 'works' : 'books'}/${description.sourceKey}`,
  };
  if (description.source === 'google_books' && /^\d{13}$/.test(description.sourceKey)) return {
    name: 'Google Books', href: `https://books.google.com/books?vid=ISBN${description.sourceKey}`,
  };
  return null;
}
