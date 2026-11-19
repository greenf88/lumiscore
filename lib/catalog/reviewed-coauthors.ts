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
    primaryAuthor: 'Ronald Giphart', isbn: '9781472139702',
    name: 'Mark van Vugt', slug: 'mark-van-vugt',
    source: 'https://www.hachette.co.uk/titles/ronald-giphart-2/mismatch/9781472139702/',
  },
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
  {
    primaryAuthor: 'Paul R. Daugherty', isbn: '9781633693869',
    name: 'H. James Wilson', slug: 'h-james-wilson',
    source: 'https://books.google.com/books?id=SpECtAEACAAJ',
  },
  ...[
  {
    "primaryAuthor": "Robert A. Baron",
    "isbn": "9780721615660",
    "name": "Donn Erwin Byrne",
    "slug": "donn-erwin-byrne",
    "source": "https://books.google.com/books?vid=ISBN9780721615660&hl=en"
  },
  {
    "primaryAuthor": "Robert A. Baron",
    "isbn": "9780721615660",
    "name": "Barry H. Kantowitz",
    "slug": "barry-h-kantowitz",
    "source": "https://books.google.com/books?vid=ISBN9780721615660&hl=en"
  },
  {
    "primaryAuthor": "Adam Gazzaley",
    "isbn": "9780262034944",
    "name": "Larry D. Rosen",
    "slug": "larry-d-rosen",
    "source": "https://books.google.com/books?vid=ISBN9780262034944&hl=en"
  },
  {
    "primaryAuthor": "Brad Feld",
    "isbn": "9781119259756",
    "name": "Jason Mendelson",
    "slug": "jason-mendelson",
    "source": "https://books.google.com/books?vid=ISBN9781119259756&hl=en"
  },
  {
    "primaryAuthor": "Richard Meran Barsam",
    "isbn": "9780393644999",
    "name": "Dave Monahan",
    "slug": "dave-monahan",
    "source": "https://books.google.com/books?vid=ISBN9780393644999&hl=en"
  },
  {
    "primaryAuthor": "Gene Kim",
    "isbn": "9781942788003",
    "name": "Patrick Debois",
    "slug": "patrick-debois",
    "source": "https://books.google.com/books?vid=ISBN9781942788003&hl=en"
  },
  {
    "primaryAuthor": "Gene Kim",
    "isbn": "9781942788003",
    "name": "John Willis",
    "slug": "john-willis",
    "source": "https://books.google.com/books?vid=ISBN9781942788003&hl=en"
  },
  {
    "primaryAuthor": "Gene Kim",
    "isbn": "9781942788003",
    "name": "Jez Humble",
    "slug": "jez-humble",
    "source": "https://books.google.com/books?vid=ISBN9781942788003&hl=en"
  },
  {
    "primaryAuthor": "Kevin De Bruyne",
    "isbn": "9789089314826",
    "name": "Raoul De Groote",
    "slug": "raoul-de-groote",
    "source": "https://books.google.com/books?vid=ISBN9789089314826&hl=en"
  },
  {
    "primaryAuthor": "Theo IJzermans",
    "isbn": "9789070512125",
    "name": "Coen Dirkx",
    "slug": "coen-dirkx",
    "source": "https://www.bibliotheek.nl/catalogus/titel.427630282.html/beren-op-de-weg--spinsels-in-je-hoofd/"
  },
  {
    "primaryAuthor": "Henk Smeets",
    "isbn": "9789074352161",
    "name": "Corzas Nanuruw",
    "slug": "corzas-nanuruw",
    "source": "https://tseg.nl/article/view/7622"
  },
  {
    "primaryAuthor": "Ajay Agrawal",
    "isbn": "9781633695672",
    "name": "Joshua Gans",
    "slug": "joshua-gans",
    "source": "https://books.google.com/books?vid=ISBN9781633695672&hl=en"
  },
  {
    "primaryAuthor": "Ajay Agrawal",
    "isbn": "9781633695672",
    "name": "Avi Goldfarb",
    "slug": "avi-goldfarb",
    "source": "https://books.google.com/books?vid=ISBN9781633695672&hl=en"
  },
  {
    "primaryAuthor": "Michael A. Seeds",
    "isbn": "9780538733533",
    "name": "Dana E. Backman",
    "slug": "dana-e-backman",
    "source": "https://books.google.com/books?vid=ISBN9780538733533&hl=en"
  },
  {
    "primaryAuthor": "Gerald Corey",
    "isbn": "9780534514402",
    "name": "Marianne Schneider Corey",
    "slug": "marianne-schneider-corey",
    "source": "https://books.google.com/books?vid=ISBN9780534514402&hl=en"
  },
  {
    "primaryAuthor": "Gerald Corey",
    "isbn": "9780534514402",
    "name": "Patrick Callanan",
    "slug": "patrick-callanan",
    "source": "https://books.google.com/books?vid=ISBN9780534514402&hl=en"
  },
  {
    "primaryAuthor": "Mee-Yan Cheung-Judge",
    "isbn": "9780749460945",
    "name": "Linda Holbeche",
    "slug": "linda-holbeche",
    "source": "https://books.google.com/books?vid=ISBN9780749460945&hl=en"
  },
  {
    "primaryAuthor": "Sally Winston",
    "isbn": "9781626254343",
    "name": "Martin N. Seif",
    "slug": "martin-n-seif",
    "source": "https://books.google.com/books?vid=ISBN9781626254343&hl=en"
  },
  {
    "primaryAuthor": "Yedidyah Langsam",
    "isbn": "9788120311770",
    "name": "Moshe J. Augenstein",
    "slug": "moshe-j-augenstein",
    "source": "https://opac.duls.du.ac.in/cgi-bin/koha/opac-detail.pl?biblionumber=27186"
  },
  {
    "primaryAuthor": "Yedidyah Langsam",
    "isbn": "9788120311770",
    "name": "Aaron M. Tenenbaum",
    "slug": "aaron-m-tenenbaum",
    "source": "https://opac.duls.du.ac.in/cgi-bin/koha/opac-detail.pl?biblionumber=27186"
  },
  {
    "primaryAuthor": "Robert E. Howard",
    "isbn": "9780441116713",
    "name": "L. Sprague de Camp",
    "slug": "l-sprague-de-camp",
    "source": "https://books.google.com/books?vid=ISBN9780441116713&hl=en"
  },
  {
    "primaryAuthor": "Robert E. Howard",
    "isbn": "9780441116713",
    "name": "Lin Carter",
    "slug": "lin-carter",
    "source": "https://books.google.com/books?vid=ISBN9780441116713&hl=en"
  },
  {
    "primaryAuthor": "Alexander Osterwalder",
    "isbn": "9781118968055",
    "name": "Yves Pigneur",
    "slug": "yves-pigneur",
    "source": "https://books.google.com/books?vid=ISBN9781118968055&hl=en"
  },
  {
    "primaryAuthor": "Alexander Osterwalder",
    "isbn": "9781118968055",
    "name": "Gregory Bernarda",
    "slug": "gregory-bernarda",
    "source": "https://books.google.com/books?vid=ISBN9781118968055&hl=en"
  },
  {
    "primaryAuthor": "Alexander Osterwalder",
    "isbn": "9781118968055",
    "name": "Alan Smith",
    "slug": "alan-smith",
    "source": "https://books.google.com/books?vid=ISBN9781118968055&hl=en"
  },
  {
    "primaryAuthor": "Richard G. Schroeder",
    "isbn": "9781118582794",
    "name": "Myrtle W. Clark",
    "slug": "myrtle-w-clark",
    "source": "https://books.google.com/books?vid=ISBN9781118582794&hl=en"
  },
  {
    "primaryAuthor": "Richard G. Schroeder",
    "isbn": "9781118582794",
    "name": "Jack M. Cathey",
    "slug": "jack-m-cathey",
    "source": "https://books.google.com/books?vid=ISBN9781118582794&hl=en"
  },
  {
    "primaryAuthor": "Robert H. Frank",
    "isbn": "9780072289626",
    "name": "Ben Bernanke",
    "slug": "ben-bernanke",
    "source": "https://books.google.com/books?vid=ISBN9780072289626&hl=en"
  },
  {
    "primaryAuthor": "Bob de Graaff",
    "isbn": "9789040084508",
    "name": "Elsbeth Locher-Scholten",
    "slug": "elsbeth-locher-scholten",
    "source": "https://books.google.com/books?vid=ISBN9789040084508&hl=en"
  },
  {
    "primaryAuthor": "Aravind Shenoy",
    "isbn": "9781484218532",
    "name": "Anirudh Prabhu",
    "slug": "anirudh-prabhu",
    "source": "https://books.google.com/books?vid=ISBN9781484218532&hl=en"
  },
  {
    "primaryAuthor": "Amarinder Singh",
    "isbn": "9789351941507",
    "name": "Tajindar Shergill",
    "slug": "tajindar-shergill",
    "source": "https://books.google.com/books?vid=ISBN9789351941507&hl=en"
  },
  {
    "primaryAuthor": "Barnabas Kindersley",
    "isbn": "9780789402011",
    "name": "Anabel Kindersley",
    "slug": "anabel-kindersley",
    "source": "https://books.google.com/books?vid=ISBN9780789402011&hl=en"
  },
  {
    "primaryAuthor": "J. Robert King",
    "isbn": "9780786953059",
    "name": "Jeff Grubb",
    "slug": "jeff-grubb",
    "source": "https://books.google.com/books?vid=ISBN9780786953059&hl=en"
  },
  {
    "primaryAuthor": "Terry Pratchett",
    "isbn": "9780552159845",
    "name": "Neil Gaiman",
    "slug": "neil-gaiman",
    "source": "https://books.google.com/books?vid=ISBN9780552159845&hl=en"
  },
  {
    "primaryAuthor": "Terry Pratchett",
    "isbn": "9789022586631",
    "name": "Neil Gaiman",
    "slug": "neil-gaiman",
    "source": "https://books.google.com/books?vid=ISBN9789022586631&hl=en"
  },
  {
    "primaryAuthor": "Bill Martin Jr.",
    "isbn": "9780671748944",
    "name": "John Archambault",
    "slug": "john-archambault",
    "source": "https://parents.simonandschuster.com/9798347119820"
  }
]
];

type WorkCreditIdentity = { workId?: string | null; isbn13?: string | null; author: string };

export function reviewedCoauthors(book: WorkCreditIdentity) {
  return REVIEWED_COAUTHORS.filter(credit =>
    credit.primaryAuthor === book.author
      && (credit.workId ? credit.workId === book.workId : credit.isbn === book.isbn13),
  );
}

/** Compatibility for callers that only need the first additional credit. */
export function reviewedCoauthor(book: WorkCreditIdentity) {
  return reviewedCoauthors(book)[0];
}

export function bookAuthorByline(book: WorkCreditIdentity, locale: Locale) {
  const names = [book.author, ...reviewedCoauthors(book).map(credit => credit.name)];
  if (names.length === 1) return book.author;
  return names.slice(0, -1).join(', ') + (locale === 'nl' ? ' en ' : ' and ') + names.at(-1);
}
