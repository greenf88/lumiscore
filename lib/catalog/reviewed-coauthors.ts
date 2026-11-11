import type { Locale } from '../i18n/config.ts';

// Additional public credits for Works whose catalog row has one primary author.
// Keep the bibliographic source and ISBN with each credit for review.
export const REVIEWED_COAUTHORS = [
  {
    workId: '10473', primaryAuthor: 'Thomas van Grinsven', isbn: '9789030511731',
    name: 'Rutger Vink', slug: 'rutger-vink',
    source: 'https://metadata.isbn.nl/2095854/de-avonturen-van-rutger-thomas-en-paco.html',
  },
  {
    workId: '10474', primaryAuthor: 'Mark Haayema', isbn: '9789062228386',
    name: 'Mick Schellens', slug: 'mick-schellens',
    source: 'https://singeluitgeverijen.nl/volt/boek/ollie-moos-opgeruimd-staat-netjes/',
  },
] as const;

type WorkCreditIdentity = { workId?: string | null; author: string };

export function reviewedCoauthor(book: WorkCreditIdentity) {
  return REVIEWED_COAUTHORS.find(credit =>
    credit.workId === book.workId && credit.primaryAuthor === book.author,
  );
}

export function bookAuthorByline(book: WorkCreditIdentity, locale: Locale) {
  const additional = reviewedCoauthor(book);
  return additional ? [book.author, additional.name].join(locale === 'nl' ? ' en ' : ' and ') : book.author;
}
