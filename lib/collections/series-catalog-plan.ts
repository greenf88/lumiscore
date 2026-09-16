export type SeriesSeedCategory =
  | 'fantasy-science-fiction'
  | 'thriller-crime'
  | 'romance'
  | 'young-adult-children';

export type ReviewedSeriesBookPlan = {
  title: string;
  sourceTitle?: string;
  alternateTitles?: readonly string[];
  openLibraryWorkId: string;
  author: string;
  firstPublishYear: number;
  sequenceNumber: number;
  category: SeriesSeedCategory;
  preferredEditionLanguages: readonly string[];
  editionLanguagesToImport: readonly string[];
};

export type ReviewedSeriesCatalogPlan = {
  slug: string;
  name: string;
  description: string;
  books: readonly ReviewedSeriesBookPlan[];
};

const localizedEditions = {
  preferredEditionLanguages: ['eng', 'nld'],
  editionLanguagesToImport: ['eng', 'nld'],
} as const;

function book(
  sequenceNumber: number,
  title: string,
  openLibraryWorkId: string,
  author: string,
  firstPublishYear: number,
  category: SeriesSeedCategory,
  options: Pick<ReviewedSeriesBookPlan, 'sourceTitle' | 'alternateTitles'> = {},
): ReviewedSeriesBookPlan {
  return {
    sequenceNumber,
    title,
    openLibraryWorkId,
    author,
    firstPublishYear,
    category,
    ...localizedEditions,
    ...options,
  };
}

export const REVIEWED_SERIES_CATALOG_PLANS: readonly ReviewedSeriesCatalogPlan[] = [
  {
    slug: 'harry-potter',
    name: 'Harry Potter',
    description: 'The seven main Harry Potter novels in publication order.',
    books: [
      book(1, "Harry Potter and the Philosopher's Stone", 'OL82563W', 'J. K. Rowling', 1997, 'young-adult-children', { alternateTitles: ["Harry Potter and the Sorcerer's Stone"] }),
      book(2, 'Harry Potter and the Chamber of Secrets', 'OL82537W', 'J. K. Rowling', 1998, 'young-adult-children'),
      book(3, 'Harry Potter and the Prisoner of Azkaban', 'OL82536W', 'J. K. Rowling', 1999, 'young-adult-children'),
      book(4, 'Harry Potter and the Goblet of Fire', 'OL82560W', 'J. K. Rowling', 2000, 'young-adult-children'),
      book(5, 'Harry Potter and the Order of the Phoenix', 'OL82548W', 'J. K. Rowling', 2003, 'young-adult-children'),
      book(6, 'Harry Potter and the Half-Blood Prince', 'OL82565W', 'J. K. Rowling', 2005, 'young-adult-children'),
      book(7, 'Harry Potter and the Deathly Hallows', 'OL82586W', 'J. K. Rowling', 2007, 'young-adult-children'),
    ],
  },
  {
    slug: 'the-hunger-games',
    name: 'The Hunger Games',
    description: 'The published main Hunger Games novels in publication order.',
    books: [
      book(1, 'The Hunger Games', 'OL5735363W', 'Suzanne Collins', 2008, 'young-adult-children'),
      book(2, 'Catching Fire', 'OL5735360W', 'Suzanne Collins', 2009, 'young-adult-children'),
      book(3, 'Mockingjay', 'OL14908941W', 'Suzanne Collins', 2010, 'young-adult-children'),
      book(4, 'The Ballad of Songbirds and Snakes', 'OL20716197W', 'Suzanne Collins', 2020, 'young-adult-children'),
      book(5, 'Sunrise on the Reaping', 'OL43426400W', 'Suzanne Collins', 2025, 'young-adult-children'),
    ],
  },
  {
    slug: 'the-expanse',
    name: 'The Expanse',
    description: 'The nine main Expanse novels in publication order; novellas are excluded.',
    books: [
      book(1, 'Leviathan Wakes', 'OL16114008W', 'James S. A. Corey', 2011, 'fantasy-science-fiction'),
      book(2, "Caliban's War", 'OL16117275W', 'James S. A. Corey', 2012, 'fantasy-science-fiction'),
      book(3, "Abaddon's Gate", 'OL17074648W', 'James S. A. Corey', 2013, 'fantasy-science-fiction'),
      book(4, 'Cibola Burn', 'OL17454175W', 'James S. A. Corey', 2014, 'fantasy-science-fiction'),
      book(5, 'Nemesis Games', 'OL17755458W', 'James S. A. Corey', 2015, 'fantasy-science-fiction'),
      book(6, "Babylon's Ashes", 'OL17793650W', 'James S. A. Corey', 2016, 'fantasy-science-fiction'),
      book(7, 'Persepolis Rising', 'OL17857348W', 'James S. A. Corey', 2017, 'fantasy-science-fiction'),
      book(8, "Tiamat's Wrath", 'OL19800273W', 'James S. A. Corey', 2019, 'fantasy-science-fiction'),
      book(9, 'Leviathan Falls', 'OL21704818W', 'James S. A. Corey', 2021, 'fantasy-science-fiction'),
    ],
  },
  {
    slug: 'millennium-original-trilogy',
    name: 'Millennium',
    description: 'Stieg Larsson’s original Millennium trilogy; later continuation novels are separate.',
    books: [
      book(1, 'The Girl with the Dragon Tattoo', 'OL5784622W', 'Stieg Larsson', 2005, 'thriller-crime', { sourceTitle: 'Män som hatar kvinnor', alternateTitles: ['Men Who Hate Women'] }),
      book(2, 'The Girl Who Played with Fire', 'OL5784621W', 'Stieg Larsson', 2006, 'thriller-crime', { sourceTitle: 'Flickan som lekte med elden' }),
      book(3, "The Girl Who Kicked the Hornets' Nest", 'OL14909364W', 'Stieg Larsson', 2007, 'thriller-crime', { sourceTitle: 'Luftslottet som sprängdes', alternateTitles: ["The Girl Who Kicked the Hornet's Nest"] }),
    ],
  },
  {
    slug: 'percy-jackson-and-the-olympians',
    name: 'Percy Jackson and the Olympians',
    description: 'The original five Percy Jackson and the Olympians novels in publication order.',
    books: [
      book(1, 'The Lightning Thief', 'OL492658W', 'Rick Riordan', 2005, 'young-adult-children'),
      book(2, 'The Sea of Monsters', 'OL492646W', 'Rick Riordan', 2006, 'young-adult-children'),
      book(3, "The Titan's Curse", 'OL492647W', 'Rick Riordan', 2007, 'young-adult-children'),
      book(4, 'The Battle of the Labyrinth', 'OL492640W', 'Rick Riordan', 2008, 'young-adult-children'),
      book(5, 'The Last Olympian', 'OL15270622W', 'Rick Riordan', 2009, 'young-adult-children'),
    ],
  },
  {
    slug: 'the-witcher',
    name: 'The Witcher',
    description: 'The established eight-book Witcher reading sequence through Season of Storms.',
    books: [
      book(1, 'The Last Wish', 'OL2577482W', 'Andrzej Sapkowski', 1993, 'fantasy-science-fiction', { sourceTitle: 'Ostatnie życzenie' }),
      book(2, 'Sword of Destiny', 'OL2577472W', 'Andrzej Sapkowski', 1992, 'fantasy-science-fiction', { sourceTitle: 'Miecz przeznaczenia' }),
      book(3, 'Blood of Elves', 'OL2577486W', 'Andrzej Sapkowski', 1994, 'fantasy-science-fiction', { sourceTitle: 'Krew elfów' }),
      book(4, 'Time of Contempt', 'OL2577481W', 'Andrzej Sapkowski', 1995, 'fantasy-science-fiction', { sourceTitle: 'Czas pogardy' }),
      book(5, 'Baptism of Fire', 'OL2577480W', 'Andrzej Sapkowski', 1996, 'fantasy-science-fiction', { sourceTitle: 'Chrzest ognia' }),
      book(6, 'The Tower of the Swallow', 'OL2577478W', 'Andrzej Sapkowski', 1997, 'fantasy-science-fiction', { sourceTitle: 'Wieża Jaskółki' }),
      book(7, 'The Lady of the Lake', 'OL18132161W', 'Andrzej Sapkowski', 1999, 'fantasy-science-fiction', { sourceTitle: 'Pani Jeziora' }),
      book(8, 'Season of Storms', 'OL18132591W', 'Andrzej Sapkowski', 2013, 'fantasy-science-fiction', { sourceTitle: 'Sezon burz' }),
    ],
  },
  {
    slug: 'bridgerton',
    name: 'Bridgerton',
    description: 'The eight main Bridgerton sibling novels in publication order.',
    books: [
      book(1, 'The Duke and I', 'OL554620W', 'Julia Quinn', 2000, 'romance'),
      book(2, 'The Viscount Who Loved Me', 'OL8464993W', 'Julia Quinn', 2000, 'romance'),
      book(3, 'An Offer from a Gentleman', 'OL554608W', 'Julia Quinn', 2001, 'romance'),
      book(4, 'Romancing Mister Bridgerton', 'OL554615W', 'Julia Quinn', 2002, 'romance'),
      book(5, 'To Sir Phillip, with Love', 'OL554603W', 'Julia Quinn', 2003, 'romance'),
      book(6, 'When He Was Wicked', 'OL554621W', 'Julia Quinn', 2004, 'romance'),
      book(7, "It's in His Kiss", 'OL554612W', 'Julia Quinn', 2005, 'romance'),
      book(8, 'On the Way to the Wedding', 'OL554614W', 'Julia Quinn', 2006, 'romance'),
    ],
  },
] as const;

export const REVIEWED_SERIES_BOOKS = REVIEWED_SERIES_CATALOG_PLANS.flatMap(
  (series) => series.books,
);
