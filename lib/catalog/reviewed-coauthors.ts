import type { Locale } from '../i18n/config.ts';

// Additional public credits for Works whose catalog row has one primary author.
// Keep the bibliographic source and ISBN with each credit for review.
type ReviewedCoauthor = {
  workId?: string;
  primaryAuthor: string;
  isbn: string;
  name: string;
  slug: string;
  source: string;
};

export const REVIEWED_COAUTHORS: readonly ReviewedCoauthor[] = [
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
  {
    primaryAuthor: 'M.J. Arlidge', isbn: '9789049213343',
    name: 'Alex Khan', slug: 'alex-khan',
    source: 'https://www.lannoo.com/nl-be/thrillers-spanning/haar-laatste-adem-9789049213343',
  },
];

type WorkCreditIdentity = { workId?: string | null; isbn13?: string | null; author: string };

export function reviewedCoauthor(book: WorkCreditIdentity) {
  return REVIEWED_COAUTHORS.find(credit =>
    credit.primaryAuthor === book.author
      && (credit.workId ? credit.workId === book.workId : credit.isbn === book.isbn13),
  );
}

export function bookAuthorByline(book: WorkCreditIdentity, locale: Locale) {
  const additional = reviewedCoauthor(book);
  return additional ? [book.author, additional.name].join(locale === 'nl' ? ' en ' : ' and ') : book.author;
}
