import type { CollectionType } from './model.ts';

export type ReviewedCollectionSeed = {
  slug: string;
  name: string;
  collectionType: CollectionType;
  description: string;
  books: ReadonlyArray<{
    workId: number;
    sequenceNumber: number | null;
    publicationOrder: number | null;
    subgroup?: string;
  }>;
  knownMissing: readonly string[];
};

const ordered = (...workIds: number[]) => workIds.map((workId, index) => ({
  workId,
  sequenceNumber: index + 1,
  publicationOrder: index + 1,
}));

const unordered = (...workIds: number[]) => workIds.map((workId, index) => ({
  workId,
  sequenceNumber: null,
  publicationOrder: index + 1,
}));

export const REVIEWED_COLLECTION_SEEDS: readonly ReviewedCollectionSeed[] = [
  {
    slug: 'the-lord-of-the-rings',
    name: 'The Lord of the Rings',
    collectionType: 'series',
    description: 'The three-volume reading order for J.R.R. Tolkien’s epic.',
    books: ordered(171, 138, 193),
    knownMissing: [],
  },
  {
    slug: 'a-song-of-ice-and-fire',
    name: 'A Song of Ice and Fire',
    collectionType: 'series',
    description: 'The published main novels in George R. R. Martin’s series.',
    books: ordered(25, 121, 245, 126, 128),
    knownMissing: ['The Winds of Winter (not published)', 'A Dream of Spring (not published)'],
  },
  {
    slug: 'his-dark-materials',
    name: 'His Dark Materials',
    collectionType: 'series',
    description: 'Philip Pullman’s original His Dark Materials trilogy.',
    books: ordered(146, 178, 228),
    knownMissing: [],
  },
  {
    slug: 'the-locked-tomb',
    name: 'The Locked Tomb',
    collectionType: 'series',
    description: 'The published Locked Tomb novels by Tamsyn Muir.',
    books: ordered(151, 239, 293),
    knownMissing: ['Alecto the Ninth (not published)'],
  },
  {
    slug: 'fifty-shades',
    name: 'Fifty Shades',
    collectionType: 'series',
    description: 'The original Fifty Shades trilogy by E. L. James.',
    books: ordered(672, 673, 698),
    knownMissing: [],
  },
  {
    slug: 'three-sisters-island',
    name: 'Three Sisters Island',
    collectionType: 'series',
    description: 'Nora Roberts’ Three Sisters Island trilogy.',
    books: ordered(679, 707, 686),
    knownMissing: [],
  },
  {
    slug: 'geef-me-de-ruimte',
    name: 'Geef me de ruimte',
    collectionType: 'series',
    description: 'Thea Beckmans historische trilogie over de Honderdjarige Oorlog.',
    books: ordered(1112, 1113, 1114),
    knownMissing: [],
  },
  {
    slug: 'kinderen-van-moeder-aarde',
    name: 'Kinderen van Moeder Aarde',
    collectionType: 'series',
    description: 'Thea Beckmans toekomsttrilogie over Thule.',
    books: ordered(1251, 1115, 1116),
    knownMissing: [],
  },
  {
    slug: 'the-housemaid',
    name: 'The Housemaid',
    collectionType: 'series',
    description: 'The three main Housemaid novels by Freida McFadden.',
    books: ordered(549, 553, 560),
    knownMissing: ['The Housemaid’s Wedding (novella, work 644, intentionally excluded)'],
  },
  {
    slug: 'middle-earth',
    name: 'Middle-earth',
    collectionType: 'universe',
    description: 'A conservative selection of distinct Middle-earth works; no single reading order is implied.',
    books: unordered(6, 7, 192),
    knownMissing: [],
  },
  {
    slug: 'suzanne-vermeer',
    name: 'Suzanne Vermeer',
    collectionType: 'author_collection',
    description: 'De boeken van Suzanne Vermeer in de LumiScore-catalogus; dit is geen doorlopende leesreeks.',
    books: unordered(
      1220, 1221, 1222, 1223, 1224, 1225, 1226, 1227, 1229, 1228,
      1230, 1303, 1304, 1306, 1305, 1302, 1231, 2543, 1232, 1233,
      1234, 1235, 1236, 1237, 1238, 1241, 1239, 1240, 1242, 2544,
      1282, 1259, 1283, 1284, 1285, 1286, 1299, 1300, 1288, 1301,
      1243, 1287, 1289, 1290, 1291, 1292, 1293, 1294, 1245, 1244,
      1295, 1296, 1297, 1298,
    ),
    knownMissing: [],
  },
] as const;

