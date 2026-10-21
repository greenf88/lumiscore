import { normalizeIsbn13 } from './covers.ts';
import { normalizeEditionLanguage } from './edition-ranking.ts';

export type ReviewedCoverOverride = {
  workId: string;
  openLibraryWorkId?: string;
  title: string;
  author: string;
  isbn13: string;
  coverUrl: string;
  source: 'official_publisher' | 'publisher_registry' | 'reviewed_bookseller' | 'reviewed_open_library';
  editionLanguage?: 'eng' | 'nld';
  openLibraryEditionId?: string;
  evidenceUrl: string;
  reviewedAt: string;
};

export const REVIEWED_COVER_OVERRIDES: readonly ReviewedCoverOverride[] = [
  {workId:'100',openLibraryWorkId:'OL1846076W',title:'The Giver',author:'Lois Lowry',isbn13:'9780385732550',editionLanguage:'eng',openLibraryEditionId:'OL7441983M',coverUrl:'https://covers.openlibrary.org/b/id/244186-L.jpg?default=false',source:'reviewed_open_library',evidenceUrl:'https://openlibrary.org/books/OL7441983M',reviewedAt:'2026-10-21'},
  {workId:'2600',openLibraryWorkId:'OL675722W',title:'Oryx and Crake',author:'Margaret Atwood',isbn13:'9780385721677',editionLanguage:'eng',openLibraryEditionId:'OL39470791M',coverUrl:'https://covers.openlibrary.org/b/id/12869726-L.jpg?default=false',source:'reviewed_open_library',evidenceUrl:'https://openlibrary.org/books/OL39470791M',reviewedAt:'2026-10-21'},
  {workId:'179',openLibraryWorkId:'OL15719630W',title:'Divergent',author:'Veronica Roth',isbn13:'9780062024022',editionLanguage:'eng',openLibraryEditionId:'OL24914469M',coverUrl:'https://covers.openlibrary.org/b/id/7129729-L.jpg?default=false',source:'reviewed_open_library',evidenceUrl:'https://openlibrary.org/books/OL24914469M',reviewedAt:'2026-10-21'},
  {workId:'199',openLibraryWorkId:'OL20129837W',title:'The Testaments',author:'Margaret Atwood',isbn13:'9780385543781',editionLanguage:'eng',openLibraryEditionId:'OL27306829M',coverUrl:'https://covers.openlibrary.org/b/id/12366818-L.jpg?default=false',source:'reviewed_open_library',evidenceUrl:'https://openlibrary.org/books/OL27306829M',reviewedAt:'2026-10-21'},
  // Exact publisher ISBN pages; safe across databases with different numeric IDs.
  {workId:'25',openLibraryWorkId:'OL257943W',title:'A Game of Thrones',author:'George R. R. Martin',isbn13:'9780553897845',editionLanguage:'eng',openLibraryEditionId:'OL24283280M',coverUrl:'https://images.penguinrandomhouse.com/cover/9780553897845',source:'official_publisher',evidenceUrl:'https://penguinrandomhouselibrary.com/book/?isbn=9780553897845',reviewedAt:'2026-10-21'},
  {workId:'304',openLibraryWorkId:'OL2707183W',title:"Assassin's Apprentice",author:'Robin Hobb',isbn13:'9780553897487',editionLanguage:'eng',openLibraryEditionId:'OL24298474M',coverUrl:'https://images.penguinrandomhouse.com/cover/9780553897487',source:'official_publisher',evidenceUrl:'https://penguinrandomhouselibrary.com/book/?isbn=9780553897487',reviewedAt:'2026-10-21'},
  // Positive edition/image evidence, checked 2026-10-21. No unknown-language
  // edition is made eligible by this list. Full trace: catalog/editorial-parity-20261021.
  {workId:'102',openLibraryWorkId:'OL5735363W',title:'The Hunger Games',author:'Suzanne Collins',isbn13:'9780439023481',editionLanguage:'eng',openLibraryEditionId:'OL22549594M',coverUrl:'https://covers.openlibrary.org/b/id/7890713-L.jpg?default=false',source:'reviewed_open_library',evidenceUrl:'https://openlibrary.org/books/OL22549594M',reviewedAt:'2026-10-21'},
  {workId:'102',openLibraryWorkId:'OL5735363W',title:'De Hongerspelen',author:'Suzanne Collins',isbn13:'9789000399284',editionLanguage:'nld',openLibraryEditionId:'OL60075974M',coverUrl:'https://covers.openlibrary.org/b/id/15120650-L.jpg?default=false',source:'reviewed_open_library',evidenceUrl:'https://openlibrary.org/books/OL60075974M',reviewedAt:'2026-10-21'},
  {workId:'2718',openLibraryWorkId:'OL59038W',title:'Never Let Me Go',author:'Kazuo Ishiguro',isbn13:'9781400078776',editionLanguage:'eng',openLibraryEditionId:'OL16198255M',coverUrl:'https://covers.openlibrary.org/b/id/13160732-L.jpg?default=false',source:'reviewed_open_library',evidenceUrl:'https://openlibrary.org/books/OL16198255M',reviewedAt:'2026-10-21'},
  {workId:'208',openLibraryWorkId:'OL35623W',title:'Parable of the Sower: A Novel',author:'Octavia E. Butler',isbn13:'9781609807191',editionLanguage:'eng',openLibraryEditionId:'OL27288938M',coverUrl:'https://covers.openlibrary.org/b/id/8768819-L.jpg?default=false',source:'reviewed_open_library',evidenceUrl:'https://openlibrary.org/books/OL27288938M',reviewedAt:'2026-10-21'},
  {workId:'2717',openLibraryWorkId:'OL17876096W',title:'Scythe',author:'Neal Shusterman',isbn13:'9781481485265',editionLanguage:'eng',openLibraryEditionId:'OL46932981M',coverUrl:'https://covers.openlibrary.org/b/id/15152462-L.jpg?default=false',source:'reviewed_open_library',evidenceUrl:'https://openlibrary.org/books/OL46932981M',reviewedAt:'2026-10-21'},
  {workId:'2724',openLibraryWorkId:'OL1954412W',title:'Unwind',author:'Neal Shusterman',isbn13:'9781416912040',editionLanguage:'eng',openLibraryEditionId:'OL11758843M',coverUrl:'https://covers.openlibrary.org/b/id/2787713-L.jpg?default=false',source:'reviewed_open_library',evidenceUrl:'https://openlibrary.org/books/OL11758843M',reviewedAt:'2026-10-21'},
  {workId:'2846',openLibraryWorkId:'OL675774W',title:'The Year of the Flood',author:'Margaret Atwood',isbn13:'9781408461426',editionLanguage:'eng',openLibraryEditionId:'OL36612602M',coverUrl:'https://covers.openlibrary.org/b/id/12508446-L.jpg?default=false',source:'reviewed_open_library',evidenceUrl:'https://openlibrary.org/books/OL36612602M',reviewedAt:'2026-10-21'},
  {workId:'1',openLibraryWorkId:'OL21745884W',title:'Project Hail Mary',author:'Andy Weir',isbn13:'9780593135204',editionLanguage:'eng',openLibraryEditionId:'OL30036715M',coverUrl:'https://covers.openlibrary.org/b/id/12455001-L.jpg?default=false',source:'reviewed_open_library',evidenceUrl:'https://openlibrary.org/books/OL30036715M',reviewedAt:'2026-10-21'},
  {workId:'4316',openLibraryWorkId:'OL17914663W',title:'All Systems Red: The Murderbot Diaries',author:'Martha Wells',isbn13:'9780765397539',editionLanguage:'eng',openLibraryEditionId:'OL26500848M',coverUrl:'https://covers.openlibrary.org/b/id/9157148-L.jpg?default=false',source:'reviewed_open_library',evidenceUrl:'https://openlibrary.org/books/OL26500848M',reviewedAt:'2026-10-21'},
  {
    workId: '1305',
    title: 'Madonna',
    author: 'Suzanne Vermeer',
    isbn13: '9789044970791',
    coverUrl: 'https://www.awbruna.nl/wp-content/uploads/sites/51/external/b6bd674d8e0e6381e637a31d0b0022af-364x0-c-default.jpg?t=1685223028',
    source: 'official_publisher',
    evidenceUrl: 'https://www.awbruna.nl/boek/thrillers/suzanne-vermeer/madonna/',
    reviewedAt: '2026-10-18',
  },
  {
    workId: '1296',
    title: 'Festival',
    author: 'Suzanne Vermeer',
    isbn13: '9789400517134',
    coverUrl:
      'https://www.awbruna.nl/wp-content/uploads/sites/51/external/62510b609380bc360781803c36fd546a-364x0-c-default.png?t=1741336886',
    source: 'official_publisher',
    evidenceUrl:
      'https://www.awbruna.nl/boek/thrillers/suzanne-vermeer/festival/',
    reviewedAt: '2026-09-18',
  },
  // Exact edition images; see docs/operations/reviewed-covers-20261017.json.
  {
    workId: '1260',
    title: 'Vele hemels boven de zevende',
    author: 'Griet Op de Beeck',
    isbn13: '9789044622805',
    coverUrl: 'https://metadata.isbn.nl/ie_fcache/0000007041_Vele_hemels_boven_de_zevende_0_0.jpg',
    source: 'publisher_registry',
    evidenceUrl: 'https://metadata.isbn.nl/38626/vele-hemels-boven-de-zevende.html',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1261',
    title: 'Alter ego',
    author: 'Esther Verhoef',
    isbn13: '9789044652901',
    coverUrl: 'https://metadata.isbn.nl/ie_fcache/0000489095_Alter_ego_0_0.jpg',
    source: 'publisher_registry',
    evidenceUrl: 'https://metadata.isbn.nl/1631167/alter-ego.html',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1262',
    title: 'In mijn dromen',
    author: 'Simone van der Vlugt',
    isbn13: '9789041416841',
    coverUrl: 'https://metadata.isbn.nl/ie_fcache/0000021184_In_mijn_dromen_0_0.jpg',
    source: 'publisher_registry',
    evidenceUrl: 'https://metadata.isbn.nl/85777/in-mijn-dromen.html',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1263',
    title: 'Nooit alleen',
    author: 'Loes den Hollander',
    isbn13: '9789059652040',
    coverUrl: 'https://metadata.isbn.nl/ie_fcache/0000126152_Nooit_alleen_0_0.jpg',
    source: 'publisher_registry',
    evidenceUrl: 'https://metadata.isbn.nl/741719/nooit-alleen.html',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1264',
    title: 'Het dossier',
    author: 'Anya Niewierra',
    isbn13: '9789021049236',
    coverUrl: 'https://www.deslegte.com/images/cached/resample/webp/data/uploads/385/600/cms_visual_2959792.jpg_1745062515000_385x600_0.8_p-33cd59278e.webp',
    source: 'reviewed_bookseller',
    evidenceUrl: 'https://www.deslegte.com/het-dossier-3981785/',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1265',
    title: 'Vogeleiland',
    author: 'Marion Pauw',
    isbn13: '9789048854943',
    coverUrl: 'https://metadata.isbn.nl/ie_fcache/0000545413_Vogeleiland_0_0.jpg',
    source: 'publisher_registry',
    evidenceUrl: 'https://metadata.isbn.nl/1404800/vogeleiland.html',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1266',
    title: 'Ibbeltje',
    author: 'Annie M.G. Schmidt',
    isbn13: '9789021480954',
    coverUrl: 'https://www.deslegte.com/images/cached/resample/webp/data/uploads/393/600/cms_visual_1630639.jpg_1625672116000_393x600_0.8_p-8eb21d985b.webp',
    source: 'reviewed_bookseller',
    evidenceUrl: 'https://www.deslegte.com/ibbeltje-1227702/',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1267',
    title: 'Stad in de storm',
    author: 'Thea Beckman',
    isbn13: '9789047750567',
    coverUrl: 'https://metadata.isbn.nl/ie_fcache/0000465117_Stad_in_de_storm_0_0.jpg',
    source: 'publisher_registry',
    evidenceUrl: 'https://metadata.isbn.nl/1184276/stad-in-de-storm-dyslexie-uitgave.html',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1268',
    title: 'Joël',
    author: 'Carry Slee',
    isbn13: '9789048857685',
    coverUrl: 'https://metadata.isbn.nl/ie_fcache/0000544331_Joel_0_0.jpg',
    source: 'publisher_registry',
    evidenceUrl: 'https://metadata.isbn.nl/132982/joel.html',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1269',
    title: 'Groep acht aan de macht',
    author: 'Jacques Vriens',
    isbn13: '9789047509899',
    coverUrl: 'https://www.deslegte.com/images/cached/resample/webp/data/uploads/372/600/cms_visual_145671.jpg_1414210247000_372x600_0.8_p-0e736ba383.webp',
    source: 'reviewed_bookseller',
    evidenceUrl: 'https://www.deslegte.com/groep-acht-aan-de-macht-356800/',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1270',
    title: 'Etty Hillesum',
    author: 'Judith Koelemeijer',
    isbn13: '9789463821742',
    coverUrl: 'https://metadata.isbn.nl/ie_fcache/0000571535_Etty_Hillesum_0_0.jpg',
    source: 'publisher_registry',
    evidenceUrl: 'https://metadata.isbn.nl/1443094/etty-hillesum.html',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1271',
    title: 'Moederland',
    author: 'Marcia Luyten',
    isbn13: '9789403194806',
    coverUrl: 'https://metadata.isbn.nl/ie_fcache/0000588957_Maxima_Zorreguieta_0_0.jpg',
    source: 'publisher_registry',
    evidenceUrl: 'https://metadata.isbn.nl/1401800/maxima-zorreguieta.html',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1272',
    title: 'Zoek het maar uit',
    author: 'Chantal Van Gastel',
    isbn13: '9789044336481',
    coverUrl: 'https://static.boekenbalie.nl/media/fa/a2/0c/1620654670/boekenbalie_9789044336481_cover.jpg?ts=1788823536',
    source: 'reviewed_bookseller',
    evidenceUrl: 'https://boekenbalie.nl/zoek-het-maar-uit/9789044336481',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1273',
    title: 'Ik wist het',
    author: 'Chantal Van Gastel',
    isbn13: '9789044344868',
    coverUrl: 'https://metadata.isbn.nl/ie_fcache/0000280292_Ik_wist_het_0_0.jpg',
    source: 'publisher_registry',
    evidenceUrl: 'https://metadata.isbn.nl/356721/ik-wist-het.html',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1274',
    title: 'Helemaal het einde',
    author: 'Lisette Jonkman',
    isbn13: '9789024578252',
    coverUrl: 'https://metadata.isbn.nl/ie_fcache/0000229294_Helemaal_het_einde_0_0.jpg',
    source: 'publisher_registry',
    evidenceUrl: 'https://metadata.isbn.nl/941012/helemaal-het-einde.html',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1275',
    title: 'Alles op alles',
    author: 'Marijke Vos',
    isbn13: '9789047211310',
    coverUrl: 'https://metadata.isbn.nl/ie_fcache/0000723605_Alles_op_alles_0_0.jpg',
    source: 'publisher_registry',
    evidenceUrl: 'https://metadata.isbn.nl/1550967/alles-op-alles-pod.html',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1276',
    title: 'Van Chanel naar flanel',
    author: 'Marijke Vos',
    isbn13: '9789047211327',
    coverUrl: 'https://metadata.isbn.nl/ie_fcache/0000738124_Van_Chanel_naar_flanel_0_0.jpg',
    source: 'publisher_registry',
    evidenceUrl: 'https://metadata.isbn.nl/1132010/van-chanel-naar-flanel.html',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1277',
    title: 'Wedden dat ik blijf',
    author: 'Marijke Vos',
    isbn13: '9789402762112',
    coverUrl: 'https://metadata.isbn.nl/ie_fcache/0000396954_Wedden_dat_ik_blijf_0_0.jpg',
    source: 'publisher_registry',
    evidenceUrl: 'https://metadata.isbn.nl/1434876/wedden-dat-ik-blijf.html',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1278',
    title: 'Ik pleit voor jou',
    author: 'Marijke Vos',
    isbn13: '9789402705454',
    coverUrl: 'https://metadata.isbn.nl/ie_fcache/0000367891_Ik_pleit_voor_jou_0_0.jpg',
    source: 'publisher_registry',
    evidenceUrl: 'https://metadata.isbn.nl/1424906/ik-pleit-voor-jou.html',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1279',
    title: 'Zes maanden zonder',
    author: 'Charlotte de Monchy',
    isbn13: '9789059901643',
    coverUrl: 'https://metadata.isbn.nl/ie_fcache/0000621195_Zes_maanden_zonder_0_0.jpg',
    source: 'publisher_registry',
    evidenceUrl: 'https://metadata.isbn.nl/1768868/zes-maanden-zonder.html',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1280',
    title: 'Eens gegeven',
    author: 'Charlotte de Monchy',
    isbn13: '9789022590393',
    coverUrl: 'https://metadata.isbn.nl/ie_fcache/0000529295_Eens_gegeven_0_0.jpg',
    source: 'publisher_registry',
    evidenceUrl: 'https://metadata.isbn.nl/964619/eens-gegeven.html',
    reviewedAt: '2026-10-17',
  },
  {
    workId: '1281',
    title: 'De Mitsukoshi Troostbaby Company',
    author: 'Auke Hulst',
    isbn13: '9789026346934',
    coverUrl: 'https://metadata.isbn.nl/ie_fcache/0000531859_De_Mitsukoshi_Troostbaby_Company_0_0.jpg',
    source: 'publisher_registry',
    evidenceUrl: 'https://metadata.isbn.nl/1426132/de-mitsukoshi-troostbaby-company.html',
    reviewedAt: '2026-10-17',
  },
] as const;

function normalizeIdentityText(value: string | null | undefined): string {
  return value?.trim().normalize('NFC').toLocaleLowerCase('nl') ?? '';
}

export function getReviewedCoverOverride(input: {
  workId?: string | null;
  openLibraryWorkId?: string | null;
  title?: string | null;
  author?: string | null;
  isbn13?: string | null;
  editionLanguage?: string | null;
  openLibraryEditionId?: string | null;
}): ReviewedCoverOverride | null {
  const isbn13 = normalizeIsbn13(input.isbn13);
  return REVIEWED_COVER_OVERRIDES.find((entry) =>
    (entry.openLibraryWorkId ? entry.openLibraryWorkId === input.openLibraryWorkId : entry.workId === input.workId?.trim()) &&
    entry.isbn13 === isbn13 &&
    (!entry.editionLanguage || entry.editionLanguage === normalizeEditionLanguage(input.editionLanguage ?? '')) &&
    (!entry.openLibraryEditionId || entry.openLibraryEditionId === input.openLibraryEditionId) &&
    normalizeIdentityText(entry.title) === normalizeIdentityText(input.title) &&
    normalizeIdentityText(entry.author) === normalizeIdentityText(input.author)
  ) ?? null;
}
