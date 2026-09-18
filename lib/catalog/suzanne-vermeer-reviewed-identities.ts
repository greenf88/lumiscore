export const SUZANNE_VERMEER_AUTHOR = {
  name: 'Suzanne Vermeer',
  productionAuthorId: 713,
  openLibraryAuthorId: 'OL7535086A',
} as const;

export type SuzanneVermeerReviewedIdentity = {
  title: string;
  originalPublicationDate: string;
  representativeIsbn13: string;
  expectedProductionWorkId: number | null;
  workType: 'novel' | 'novella' | 'short_story' | 'collection' | 'audiobook_original';
  confidence: 'HIGH';
  officialSource: string;
};

const official = (slug: string) => `https://suzannevermeer.nl/boek/${slug}/`;

const reviewed = (
  title: string,
  originalPublicationDate: string,
  representativeIsbn13: string,
  expectedProductionWorkId: number | null,
  workType: SuzanneVermeerReviewedIdentity['workType'] = 'novel',
  slug = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
): SuzanneVermeerReviewedIdentity => ({
  title,
  originalPublicationDate,
  representativeIsbn13,
  expectedProductionWorkId,
  workType,
  confidence: 'HIGH',
  officialSource: official(slug),
});

/**
 * Complete reviewed scope as of 2026-09-18. Dates are original publication
 * dates where the official bibliography exposes them; year-only values are
 * intentionally retained where no primary day/month record was available.
 */
export const SUZANNE_VERMEER_REVIEWED_IDENTITIES = [
  reviewed('All-inclusive', '2006-06-23', '9789022996072', 1220),
  reviewed('De vlucht', '2007-05-23', '9789400507517', 1221),
  reviewed('Zomertijd', '2008', '9789022994153', 1222),
  reviewed('Cruise', '2009', '9781480471184', 1223),
  reviewed('Après-ski', '2009-07-01', '9789022994801', 1224),
  reviewed('De suite', '2010-06-10', '9789022999103', 1225),
  reviewed('Zwarte piste', '2011-01-11', '9789022997093', 1226),
  reviewed('Bella Italia', '2011-06-06', '9781480471153', 1227),
  reviewed('Noorderlicht', '2012-01-09', '9789400502000', 1229),
  reviewed('Bon Bini Beach', '2012-06-18', '9781480443778', 1228),
  reviewed('Het chalet', '2013-01-14', '9789400503427', 1230),
  reviewed('De scheiding', '2013-05-06', '9789044970777', 1303, 'short_story'),
  reviewed('Een vluchtig gebaar', '2013-05-06', '9789044970784', 1304, 'short_story'),
  reviewed('In de mist', '2013-05-06', '9789044970807', 1306, 'short_story'),
  reviewed('Madonna', '2013-05-06', '9789044970791', 1305, 'short_story'),
  reviewed('Vakantiegeld', '2013-05-06', '9789044970814', 1302, 'short_story'),
  reviewed('Route du soleil', '2013-06-10', '9789400502550', 1231),
  reviewed('Winterberg', '2013-12-18', '9789400517905', null),
  reviewed('Goudkust', '2014-05-26', '9789400504691', 1232),
  reviewed('Mont Blanc', '2015-01-12', '9789400504707', 1233),
  reviewed('Costa del Sol', '2015-05-17', '9789400504899', 1234),
  reviewed('Sneeuwengelen', '2015-11-09', '9789400506374', 1235),
  reviewed('Hittegolf', '2016-04-25', '9789400507135', 1236),
  reviewed('Lawinegevaar', '2016-11-07', '9789400507692', 1237),
  reviewed('Het paradijs', '2017-04-18', '9789400512368', 1238),
  reviewed('Winternacht', '2017-11-13', '9789400508422', 1241),
  reviewed('Super de luxe', '2018-04-23', '9789400508897', 1239),
  reviewed('IJskoud', '2018-10-22', '9789400510067', 1240),
  reviewed('Het strandhuis', '2019-04-19', '9789400510074', 1242),
  reviewed('De eilanden', '2019-06-19', '9789400517813', null, 'collection'),
  reviewed('Zuidenwind', '2019-07-09', '9789044977257', 1282, 'novella'),
  reviewed('Sneeuwexpress', '2019-10-16', '9789400511019', 1259),
  reviewed('Lentevuur', '2020-02-04', '9789044978445', 1283, 'novella'),
  reviewed('Souvenir', '2020-04-21', '9789044978834', 1284),
  reviewed('Waterland', '2020-07-21', '9789400512498', 1285, 'novella'),
  reviewed('Midwinter', '2020-11-19', '9789046173695', 1286),
  reviewed('Zomeravond', '2021-04-20', '9789044932560', 1299),
  reviewed('Dwaalspoor', '2021-07-13', '9789044933192', 1300, 'novella'),
  reviewed('Nachtvorst', '2021-10-12', '9789044932577', 1288),
  reviewed('Sterrennacht', '2021-12-02', '9789046176368', 1301, 'audiobook_original'),
  reviewed('Roadtrip', '2022-05-19', '9789400514492', 1243),
  reviewed('Koraalrif', '2022-07-26', '9789400515178', 1287, 'novella'),
  reviewed('Gletsjer', '2022-10-11', '9789044934489', 1289),
  reviewed('Strandfeest', '2023-04-25', '9789044934632', 1290),
  reviewed('De vallei', '2023-07-25', '9789400516267', 1291, 'novella'),
  reviewed('Mayday', '2023-10-24', '9789044936117', 1292),
  reviewed('Sneeuwstorm', '2024-01-16', '9789044934649', 1293),
  reviewed('Bloemeneiland', '2024-04-23', '9789044936278', 1294),
  reviewed('Flamingo Beach', '2024-06-20', '9789059656581', 1245),
  reviewed('Spoorloos', '2024-09-17', '9789400517523', 1244),
  reviewed('Nachtvlucht', '2025-04-23', '9789400517738', 1295),
  reviewed('Festival', '2025-07-15', '9789400517134', 1296, 'novella'),
  reviewed('Ingesneeuwd', '2025-10-21', '9789400517721', 1297),
  reviewed('Onderstroom', '2026-04-14', '9789400519664', 1298),
] as const satisfies readonly SuzanneVermeerReviewedIdentity[];

export const SUZANNE_VERMEER_EXCLUSIONS = [
  { title: 'De bestemming', reason: 'Omnibus of five existing short stories plus a Winterberg preview.' },
  { title: 'Winterbundel: drie winterthrillers', reason: 'Omnibus of existing works.' },
  { title: 'Zomerbundel: drie thrillers', reason: 'Omnibus of existing works.' },
  { title: 'Drie zomerthrillers', reason: 'Omnibus of existing works.' },
  { title: 'Drie Franse zomerthrillers', reason: 'Omnibus of existing works.' },
  { title: 'Drie Italiaanse zomerthrillers', reason: 'Omnibus of existing works.' },
  { title: 'Route du soleil en Een vluchtig gebaar', reason: 'Bundle of existing works.' },
  { title: 'Schiereiland', reason: 'Future publication on 2026-09-29.' },
  { title: 'Het kerstdiner', reason: 'Future publication on 2026-12-08.' },
  { title: 'Siësta', reason: 'Future publication in 2027.' },
  { title: 'Hoogseizoen', reason: 'Future publication in 2027.' },
] as const;

export const SUZANNE_VERMEER_COVER_REPAIRS = [
  ['Bella Italia', '9781480471153', 'https://boekboek.s3.eu-central-003.backblazeb2.com/BRBR/p/9789400517769/vdh9789400517769.png'],
  ['De vallei', '9789400516267', 'https://boekboek.s3.eu-central-003.backblazeb2.com/BRBR/p/9789400516267/vdh9789400516267.png'],
  ['Festival', '9789400517134', 'https://boekboek.s3.eu-central-003.backblazeb2.com/BRBR/p/9789400517134/vdh9789400517134.png'],
  ['Het chalet', '9789400503427', 'https://boekboek.s3.eu-central-003.backblazeb2.com/BRBR/p/9789400517783/vdh9789400517783.png'],
  ['Ingesneeuwd', '9789400517721', 'https://boekboek.s3.eu-central-003.backblazeb2.com/BRBR/p/9789400517721/vdh9789400517721.png'],
  ['Koraalrif', '9789400515178', 'https://boekboek.s3.eu-central-003.backblazeb2.com/BRBR/p/9789400515178/vdh9789400515178.png'],
  ['Lawinegevaar', '9789400507692', 'https://boekboek.s3.eu-central-003.backblazeb2.com/BRBR/p/9789400517844/vdh9789400517844.png'],
  ['Midwinter', '9789046173695', 'https://boekboek.s3.eu-central-003.backblazeb2.com/BRBR/p/9789400519381/vdh9789400519381.png'],
  ['Nachtvlucht', '9789400517738', 'https://boekboek.s3.eu-central-003.backblazeb2.com/BRBR/p/9789400517738/vdh9789400517738.png'],
  ['Onderstroom', '9789400519664', 'https://boekboek.s3.eu-central-003.backblazeb2.com/BRBR/p/9789400519664/vdh9789400519664.png'],
  ['Sneeuwexpress', '9789400511019', 'https://boekboek.s3.eu-central-003.backblazeb2.com/BRBR/p/9789400519398/vdh9789400519398.png'],
  ['Sterrennacht', '9789046176368', 'https://boekboek.s3.eu-central-003.backblazeb2.com/BRBR/p/9789046176368/vdh9789046176368.png'],
  ['Waterland', '9789400512498', 'https://boekboek.s3.eu-central-003.backblazeb2.com/BRBR/p/9789400512498/vdh9789400512498.png'],
  ['Winternacht', '9789400508422', 'https://boekboek.s3.eu-central-003.backblazeb2.com/BRBR/p/9789400517912/vdh9789400517912.png'],
] as const;

export function sortSuzanneVermeerIdentities(
  identities: readonly SuzanneVermeerReviewedIdentity[],
): SuzanneVermeerReviewedIdentity[] {
  return [...identities].sort((left, right) =>
    left.originalPublicationDate.localeCompare(right.originalPublicationDate)
    || left.title.localeCompare(right.title, 'nl-NL'));
}
