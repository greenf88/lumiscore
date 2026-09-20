export type ReviewedBestsellerEntry = {
  rank: number;
  isbn13: string;
  workId: string;
  sourceTitle: string;
};

export type ReviewedBestsellerSnapshot = {
  sourceName: 'De Bestseller 60';
  sourceUrl: string;
  termsUrl: string;
  year: number;
  week: number;
  verifiedAt: string;
  maxAgeDays: 14;
  entries: readonly ReviewedBestsellerEntry[];
  unmatchedCount: number;
};

// CPNB permits citation from De Bestseller 60, but asks publishers to contact
// it before reproducing all or part of the list. V1 therefore stores only the
// three exact ISBN identities reviewed for LumiScore, never a scraped list.
export const DUTCH_BESTSELLER_SNAPSHOT = {
  sourceName: 'De Bestseller 60',
  sourceUrl: 'https://www.debestseller60.nl/',
  termsUrl: 'https://www.debestseller60.nl/over-de-bestseller-60',
  year: 2026,
  week: 38,
  verifiedAt: '2026-09-20T00:00:00.000Z',
  maxAgeDays: 14,
  unmatchedCount: 57,
  entries: [
    { rank: 25, isbn13: '9789400519664', workId: '1298', sourceTitle: 'Onderstroom' },
    { rank: 40, isbn13: '9789021056531', workId: '1907', sourceTitle: 'Het ultieme geheim' },
    { rank: 46, isbn13: '9789025914189', workId: '1343', sourceTitle: 'Onthoud dit altijd' },
  ],
} as const satisfies ReviewedBestsellerSnapshot;

export type ReviewedClassicEntry = {
  workId: string;
  title: string;
  author: string;
  firstPublishYear: number;
  kind: 'dutch_original' | 'international_dutch_edition';
  dutchEdition: {
    source: 'open_library';
    sourceWorkId: string;
    sourceEditionId: string;
    isbn13: string | null;
  };
  evidenceUrl: string;
  reviewNote: string;
  reviewStatus: 'approved';
  reviewedAt: string;
  editorialPriority: number;
  seriesKey?: string;
};

const DBNL_CANON = 'https://www.dbnl.org/nieuws/nieuws.php?l=2022_10_05';
const DBNL_BASISBIBLIOTHEEK = 'https://www.dbnl.org/basisbibliotheek/';
const GUARDIAN_CLASSICS = 'https://www.theguardian.com/books/2015/aug/17/the-100-best-novels-written-in-english-the-full-list';
const MODERN_LIBRARY = 'https://sites.prh.com/modern-library-top-100';
const MISERY_PUBLISHER = 'https://www.simonandschuster.com/books/Misery/Stephen-King/9781501143106';
const FRANKENSTEIN_PUBLISHER = 'https://www.simonandschuster.com/books/Frankenstein/Mary-Wollstonecraft-Shelley/9781982146160';
const TRIAL_PUBLISHER = 'https://www.penguinrandomhouse.com/books/89257/the-trial-by-franz-kafka/';
const DUBLINERS_PUBLISHER = 'https://www.penguinrandomhouse.com/books/546646/dubliners-by-james-joyce/';
const OF_MICE_AND_MEN_PUBLISHER = 'https://www.foliosociety.com/usa/of-mice-men';
const PLAGUE_PUBLISHER = 'https://www.penguinrandomhouse.com/books/23472/the-plague-by-albert-camus/';
const FAHRENHEIT_PUBLISHER = 'https://www.penguinrandomhouse.com/books/851599/fahrenheit-451-edicion-iconica--fahrenheit-451-by-ray-bradbury/';
const DUNE_PUBLISHER = 'https://www.penguinrandomhouse.com/series/AU8/dune/';
const BRADBURY_PUBLISHER = 'https://www.penguinrandomhouse.com/books/247252/ray-bradbury-the-last-interview-by-ray-bradbury/';
const HOBBIT_PUBLISHER = 'https://www.foliosociety.com/the-hobbit.html';
const FELLOWSHIP_PUBLISHER = 'https://www.penguinrandomhouse.com/books/179203/the-fellowship-of-the-ring-by-jrr-tolkien/';
const ALCHEMIST_PUBLISHER = 'https://www.harperacademic.com/book/9780060887964/the-alchemist-gift-edition/';
const CHRISTIE_OFFICIAL = 'https://www.agathachristie.com/stories/and-then-there-were-none';
const DISPOSSESSED_PUBLISHER = 'https://officialharpercollins.shop/products/the-dispossessed-50th-anniversary-edition-ursula-k-le-guin';
const HITCHHIKER_PUBLISHER = 'https://www.penguinrandomhouse.com/series/HGG/hitchhikers-guide-to-the-galaxy/';
const SECRET_HISTORY_PUBLISHER = 'https://www.penguinrandomhouse.com/books/176619/the-secret-history-by-donna-tartt/';
const CHARLOTTES_WEB_PUBLISHER = 'https://thornwillow.com/charlotte-s-web/';
const OZ_PUBLISHER = 'https://www.simonandschuster.com/books/The-Wizard-of-Oz/L-Frank-Baum/Word-Cloud-Classics/9781667209777';
const WOMAN_IN_WHITE_PUBLISHER = 'https://www.penguinrandomhouse.com/books/333095/the-woman-in-white-by-wilkie-collins/';
const ANNA_KARENINA_PUBLISHER = 'https://www.penguinrandomhouse.com/books/530530/anna-karenina-by-leo-tolstoy/';
const REVIEWED_AT = '2026-09-20';

// `classic` is editorial status here, never a genre inference. Every row was
// reviewed against a canon/editorial source and an exact Open Library Work ->
// Dutch Edition relationship. The external responses themselves are not kept.
export const DUTCH_CLASSICS_POOL = [
  {
    workId: '1192', title: 'Max Havelaar', author: 'Multatuli', firstPublishYear: 1860,
    kind: 'dutch_original', dutchEdition: { source: 'open_library', sourceWorkId: 'OL38786499W', sourceEditionId: 'OL57950835M', isbn13: null },
    evidenceUrl: DBNL_CANON, reviewNote: 'Nummer één in de in 2022 vernieuwde DBNL-canon.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 1,
  },
  {
    workId: '1016', title: 'De avonden', author: 'Gerard Kornelis van het Reve', firstPublishYear: 1947,
    kind: 'dutch_original', dutchEdition: { source: 'open_library', sourceWorkId: 'OL699606W', sourceEditionId: 'OL23011846M', isbn13: null },
    evidenceUrl: DBNL_CANON, reviewNote: 'Top drie in de in 2022 vernieuwde DBNL-canon.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 2,
  },
  {
    workId: '1011', title: 'De donkere kamer van Damokles', author: 'Willem Frederik Hermans', firstPublishYear: 1959,
    kind: 'dutch_original', dutchEdition: { source: 'open_library', sourceWorkId: 'OL109957W', sourceEditionId: 'OL59710352M', isbn13: '9789023475606' },
    evidenceUrl: DBNL_BASISBIBLIOTHEEK, reviewNote: 'Gereviewd kernwerk uit de Nederlandse literaire canon.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 3,
  },
  {
    workId: '1012', title: 'Nooit meer slapen', author: 'Willem Frederik Hermans', firstPublishYear: 1966,
    kind: 'dutch_original', dutchEdition: { source: 'open_library', sourceWorkId: 'OL109959W', sourceEditionId: 'OL59710158M', isbn13: '9789023449546' },
    evidenceUrl: DBNL_BASISBIBLIOTHEEK, reviewNote: 'Gereviewd kernwerk uit de Nederlandse literaire canon.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 4,
  },
  {
    workId: '1105', title: 'De brief voor de koning', author: 'Tonke Dragt', firstPublishYear: 1962,
    kind: 'dutch_original', dutchEdition: { source: 'open_library', sourceWorkId: 'OL3793472W', sourceEditionId: 'OL60653910M', isbn13: '9789025873530' },
    evidenceUrl: DBNL_BASISBIBLIOTHEEK, reviewNote: 'Blijvende Nederlandse jeugdliteraire klassieker met gereviewde editie.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 5,
  },
  {
    workId: '1017', title: 'Op weg naar het einde', author: 'Gerard Kornelis van het Reve', firstPublishYear: 1963,
    kind: 'dutch_original', dutchEdition: { source: 'open_library', sourceWorkId: 'OL699602W', sourceEditionId: 'OL4329876M', isbn13: null },
    evidenceUrl: DBNL_BASISBIBLIOTHEEK, reviewNote: 'Gereviewd werk van een kernschrijver uit de Nederlandse canon.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 6,
  },
  {
    workId: '59', title: 'Misery', author: 'Stephen King', firstPublishYear: 1987,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL81634W', sourceEditionId: 'OL22634202M', isbn13: '9789024512799' },
    evidenceUrl: MISERY_PUBLISHER, reviewNote: 'Door de uitgever als klassieke, prijswinnende King-roman beschreven; exacte Nederlandse editie gereviewd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 7,
  },
  {
    workId: '14', title: 'Frankenstein; or, The Modern Prometheus', author: 'Mary Shelley', firstPublishYear: 1818,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL450063W', sourceEditionId: 'OL61200468M', isbn13: '9789463492515' },
    evidenceUrl: FRANKENSTEIN_PUBLISHER, reviewNote: 'Door de uitgever als tijdloze gothic klassieker beschreven; Nederlandse editie geverifieerd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 8,
  },
  {
    workId: '177', title: 'The Trial', author: 'Franz Kafka', firstPublishYear: 1925,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL498463W', sourceEditionId: 'OL58608097M', isbn13: null },
    evidenceUrl: TRIAL_PUBLISHER, reviewNote: 'Door de uitgever als een van de belangrijkste twintigste-eeuwse romans beschreven; Nederlandse editie gereviewd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 9,
  },
  {
    workId: '333', title: 'Dubliners', author: 'James Joyce', firstPublishYear: 1914,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL86320W', sourceEditionId: 'OL39175740M', isbn13: '9798835461684' },
    evidenceUrl: DUBLINERS_PUBLISHER, reviewNote: 'Uitgeverseditie classificeert deze invloedrijke bundel als Classic Fiction; Nederlandse vertaling gereviewd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 10,
  },
  {
    workId: '38', title: 'Of Mice and Men', author: 'John Steinbeck', firstPublishYear: 1937,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL23204W', sourceEditionId: 'OL25643924M', isbn13: '9789028412583' },
    evidenceUrl: OF_MICE_AND_MEN_PUBLISHER, reviewNote: 'Gereviewde literaire klassieker met Nederlandse Wereldbibliotheek-editie.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 11,
  },
  {
    workId: '423', title: 'La Peste', author: 'Albert Camus', firstPublishYear: 1947,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL1230715W', sourceEditionId: 'OL59692847M', isbn13: '9789023428756' },
    evidenceUrl: PLAGUE_PUBLISHER, reviewNote: 'Uitgeversbron noemt dit een klassieker van de twintigste-eeuwse literatuur; Nederlandse editie gereviewd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 12,
  },
  {
    workId: '12', title: '1984', author: 'George Orwell', firstPublishYear: 1949,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL1168083W', sourceEditionId: 'OL48476596M', isbn13: '9798528164908' },
    evidenceUrl: GUARDIAN_CLASSICS, reviewNote: 'Invloedrijke dystopische klassieker met gereviewde Nederlandse editie.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 13,
  },
  {
    workId: '16', title: 'Fahrenheit 451', author: 'Ray Bradbury', firstPublishYear: 1953,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL103123W', sourceEditionId: 'OL26437277M', isbn13: '9789048839964' },
    evidenceUrl: FAHRENHEIT_PUBLISHER, reviewNote: 'Uitgeversbron classificeert het werk als blijvende dystopische klassieker; Nederlandse Lebowski-editie gereviewd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 14,
  },
  {
    workId: '15', title: 'Brave New World', author: 'Aldous Huxley', firstPublishYear: 1932,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL64365W', sourceEditionId: 'OL9107664M', isbn13: null },
    evidenceUrl: MODERN_LIBRARY, reviewNote: 'Canonieke dystopische roman met gereviewde Nederlandse editie.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 15,
  },
  {
    workId: '8', title: 'Dune', author: 'Frank Herbert', firstPublishYear: 1965,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL893414W', sourceEditionId: 'OL27281911M', isbn13: '9789029002578' },
    evidenceUrl: DUNE_PUBLISHER, reviewNote: 'Door de uitgever als klassieke, prijswinnende SF-roman beschreven; exacte Nederlandse editie Duin gereviewd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 16, seriesKey: 'dune',
  },
  {
    workId: '268', title: 'The Illustrated Man', author: 'Ray Bradbury', firstPublishYear: 1951,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL103128W', sourceEditionId: 'OL47830245M', isbn13: '9789028304802' },
    evidenceUrl: BRADBURY_PUBLISHER, reviewNote: 'Officiële uitgeversbron noemt The Illustrated Man onder Bradbury\'s klassieke werken; Nederlandse editie gereviewd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 17,
  },
  {
    workId: '6', title: 'The Hobbit', author: 'J.R.R. Tolkien', firstPublishYear: 1937,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL27482W', sourceEditionId: 'OL59691274M', isbn13: '9789460923821' },
    evidenceUrl: HOBBIT_PUBLISHER, reviewNote: 'Uitgeversbron noemt het een klassieke jeugdfantasy; Nederlandse Meulenhoff-editie gereviewd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 18, seriesKey: 'middle-earth',
  },
  {
    workId: '171', title: 'The Fellowship of the Ring', author: 'J.R.R. Tolkien', firstPublishYear: 1954,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL27513W', sourceEditionId: 'OL35331220M', isbn13: '9789022533758' },
    evidenceUrl: FELLOWSHIP_PUBLISHER, reviewNote: 'Officiële uitgeversbron classificeert The Lord of the Rings als klassiek werk; Nederlandse editie geverifieerd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 19, seriesKey: 'middle-earth',
  },
  {
    workId: '13', title: 'The Alchemist', author: 'Paulo Coelho', firstPublishYear: 1988,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL796465W', sourceEditionId: 'OL9097540M', isbn13: '9789029508988' },
    evidenceUrl: ALCHEMIST_PUBLISHER, reviewNote: 'Officiële uitgeversmetadata classificeert het werk als Classics; Nederlandse editie gereviewd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 20,
  },
  {
    workId: '53', title: 'And Then There Were None', author: 'Agatha Christie', firstPublishYear: 1939,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL471565W', sourceEditionId: 'OL25651813M', isbn13: '9789075388411' },
    evidenceUrl: CHRISTIE_OFFICIAL, reviewNote: 'Officiële Christie-bron noemt het de bestverkochte misdaadroman en wereldwijd favoriet; Nederlandse editie gereviewd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 21,
  },
  {
    workId: '39', title: 'The Picture of Dorian Gray', author: 'Oscar Wilde', firstPublishYear: 1890,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL8193416W', sourceEditionId: 'OL54326369M', isbn13: '9781490492575' },
    evidenceUrl: GUARDIAN_CLASSICS, reviewNote: 'Canonieke roman met exact gereviewde Nederlandse editie.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 22,
  },
  {
    workId: '36', title: 'The Catcher in the Rye', author: 'J. D. Salinger', firstPublishYear: 1951,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL3335245W', sourceEditionId: 'OL24376869M', isbn13: null },
    evidenceUrl: MODERN_LIBRARY, reviewNote: 'Twintigste-eeuwse klassieker met gereviewde Nederlandse editie.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 23,
  },
  {
    workId: '140', title: 'The Dispossessed', author: 'Ursula K. Le Guin', firstPublishYear: 1974,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL59863W', sourceEditionId: 'OL49196482M', isbn13: null },
    evidenceUrl: DISPOSSESSED_PUBLISHER, reviewNote: 'Officiële 50-jaarsuitgave noemt het een Hugo-, Locus- en Nebula-winnende klassieker; Nederlandse editie gereviewd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 24,
  },
  {
    workId: '32', title: "The Hitchhiker's Guide to the Galaxy", author: 'Douglas Adams', firstPublishYear: 1979,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL2163649W', sourceEditionId: 'OL60653711M', isbn13: '9789022556115' },
    evidenceUrl: HITCHHIKER_PUBLISHER, reviewNote: 'Officiële uitgeversbron noemt het een popcultuurklassieker; Nederlandse editie gereviewd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 25,
  },
  {
    workId: '363', title: 'The Secret History', author: 'Donna Tartt', firstPublishYear: 1992,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL4321141W', sourceEditionId: 'OL32987085M', isbn13: '9789023409069' },
    evidenceUrl: SECRET_HISTORY_PUBLISHER, reviewNote: 'Officiële uitgeversbron noemt het een hedendaagse literaire klassieker; Nederlandse Bezige Bij-editie gereviewd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 26,
  },
  {
    workId: '99', title: "Charlotte's Web", author: 'E. B. White', firstPublishYear: 1952,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL483391W', sourceEditionId: 'OL26429850M', isbn13: '9789056372125' },
    evidenceUrl: CHARLOTTES_WEB_PUBLISHER, reviewNote: 'Gereviewde uitgeverseditie viert het erfgoed van deze jeugdliteraire klassieker; Nederlandse editie gereviewd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 27,
  },
  {
    workId: '172', title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum', firstPublishYear: 1900,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL18417W', sourceEditionId: 'OL39481818M', isbn13: '9789055791811' },
    evidenceUrl: OZ_PUBLISHER, reviewNote: 'Officiële uitgeversbron noemt dit een klassieke en blijvend populaire jeugdfantasy; Nederlandse editie gereviewd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 28, seriesKey: 'oz',
  },
  {
    workId: '346', title: 'The Woman in White', author: 'Wilkie Collins', firstPublishYear: 1859,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL176045W', sourceEditionId: 'OL36693576M', isbn13: '9789020408997' },
    evidenceUrl: WOMAN_IN_WHITE_PUBLISHER, reviewNote: 'Penguin Classics classificeert het als invloedrijke klassieke gothic-mystery; Nederlandse Veen-editie gereviewd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 29,
  },
  {
    workId: '42', title: 'Anna Karenina', author: 'Лев Толстой', firstPublishYear: 1878,
    kind: 'international_dutch_edition', dutchEdition: { source: 'open_library', sourceWorkId: 'OL267096W', sourceEditionId: 'OL54529138M', isbn13: '9781490360799' },
    evidenceUrl: ANNA_KARENINA_PUBLISHER, reviewNote: 'Penguin Classics classificeert het als wereldliteratuurklassieker; Nederlandstalige editie exact gereviewd.', reviewStatus: 'approved', reviewedAt: REVIEWED_AT, editorialPriority: 30,
  },
] as const satisfies readonly ReviewedClassicEntry[];
