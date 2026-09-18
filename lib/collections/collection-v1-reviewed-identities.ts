import type { SeedCategory } from '../../scripts/open-library-seeds.ts';

export type CollectionV1ReviewedIdentity = {
  collectionSlug: string;
  sequenceNumber: number;
  title: string;
  author: string;
  firstPublishYear: number;
  openLibraryWorkId: string;
  isbn13: string;
  category: SeedCategory;
  sourceUrl: string;
  expectedOpenLibraryAuthorId?: string;
};

const identity = (
  collectionSlug: string,
  sequenceNumber: number,
  title: string,
  author: string,
  firstPublishYear: number,
  openLibraryWorkId: string,
  isbn13: string,
  category: SeedCategory,
  sourceUrl: string,
  expectedOpenLibraryAuthorId?: string,
): CollectionV1ReviewedIdentity => ({
  collectionSlug,
  sequenceNumber,
  title,
  author,
  firstPublishYear,
  openLibraryWorkId,
  isbn13,
  category,
  sourceUrl,
  ...(expectedOpenLibraryAuthorId ? { expectedOpenLibraryAuthorId } : {}),
});

// Every row below has an independently reviewed normal-edition ISBN chain:
// official publisher/author source -> exact ISBN -> Open Library edition -> parent Work.
export const COLLECTION_V1_REVIEWED_IDENTITIES: readonly CollectionV1ReviewedIdentity[] = [
  identity('a-court-of-thorns-and-roses', 2, 'A Court of Mist and Fury', 'Sarah J. Maas', 2016, 'OL17860744W', '9781635575583', 'fantasy-science-fiction', 'https://www.bloomsbury.com/us/court-of-mist-and-fury-9781635575583/'),
  identity('belladonna', 2, 'Foxglove', 'Adalyn Grace', 2023, 'OL29327499W', '9781399705158', 'fantasy-science-fiction', 'https://www.hodder.co.uk/titles/adalyn-grace/foxglove/9781399705158/'),
  identity('belladonna', 3, 'Wisteria', 'Adalyn Grace', 2024, 'OL37618054W', '9781399726085', 'fantasy-science-fiction', 'https://www.hodder.co.uk/titles/adalyn-grace/wisteria/9781399726085/'),
  identity('chestnut-springs', 2, 'Heartless', 'Elsie Silver', 2022, 'OL34058365W', '9780349437682', 'romance', 'https://www.hachette.co.uk/titles/elsie-silver/heartless/9780349437682/'),
  identity('cormoran-strike', 1, "The Cuckoo's Calling", 'Robert Galbraith', 2013, 'OL16806416W', '9780751549256', 'thriller-crime', 'https://www.littlebrown.co.uk/titles/robert-galbraith/the-cuckoos-calling/9780751549256/', 'OL10720328A'),
  identity('cormoran-strike', 2, 'The Silkworm', 'Robert Galbraith', 2014, 'OL17324632W', '9780751549263', 'thriller-crime', 'https://www.littlebrown.co.uk/titles/robert-galbraith/the-silkworm/9780751549263/', 'OL10720328A'),
  identity('cormoran-strike', 5, 'Troubled Blood', 'Robert Galbraith', 2020, 'OL20839362W', '9780751579956', 'thriller-crime', 'https://www.littlebrown.co.uk/titles/robert-galbraith/troubled-blood/9780751579956/', 'OL10720328A'),
  identity('cormoran-strike', 6, 'The Ink Black Heart', 'Robert Galbraith', 2022, 'OL27411566W', '9780751584202', 'thriller-crime', 'https://www.littlebrown.co.uk/titles/robert-galbraith/the-ink-black-heart/9780751584202/', 'OL10720328A'),
  identity('cormoran-strike', 7, 'The Running Grave', 'Robert Galbraith', 2023, 'OL35721367W', '9781408730942', 'thriller-crime', 'https://www.littlebrown.co.uk/titles/robert-galbraith/the-running-grave/9781408730942/', 'OL10720328A'),
  identity('dublin-murder-squad', 2, 'The Likeness', 'Tana French', 2008, 'OL7989981W', '9780143115625', 'thriller-crime', 'https://www.penguinrandomhouse.com/books/300449/the-likeness-by-tana-french/'),
  identity('dublin-murder-squad', 4, 'Broken Harbor', 'Tana French', 2012, 'OL16239870W', '9780143123309', 'thriller-crime', 'https://www.penguinrandomhouse.com/books/304338/broken-harbor-by-tana-french/'),
  identity('dublin-murder-squad', 5, 'The Secret Place', 'Tana French', 2014, 'OL17371637W', '9780143127512', 'thriller-crime', 'https://www.penguinrandomhouse.com/books/312053/the-secret-place-by-tana-french/'),
  identity('dublin-murder-squad', 6, 'The Trespasser', 'Tana French', 2016, 'OL17371638W', '9780143110385', 'thriller-crime', 'https://www.penguinrandomhouse.com/books/312055/the-trespasser-by-tana-french/'),
  identity('earthsea', 4, 'Tehanu', 'Ursula K. Le Guin', 1990, 'OL15056578W', '9781442459960', 'fantasy-science-fiction', 'https://www.simonandschuster.com/books/Tehanu/Ursula-K-Le-Guin/Earthsea-Cycle/9781442459960'),
  identity('heartstopper', 1, 'Heartstopper: Volume One', 'Alice Oseman', 2019, 'OL20354498W', '9781444951387', 'young-adult-children', 'https://www.hachette.co.uk/titles/alice-oseman/heartstopper-volume-1/9781444951387/'),
  identity('heartstopper', 2, 'Heartstopper: Volume Two', 'Alice Oseman', 2019, 'OL20354499W', '9781444951400', 'young-adult-children', 'https://www.hachette.co.uk/titles/alice-oseman/heartstopper-volume-2/9781444951400/'),
  identity('heartstopper', 3, 'Heartstopper: Volume Three', 'Alice Oseman', 2020, 'OL20736929W', '9781444952773', 'young-adult-children', 'https://www.hachette.co.uk/titles/alice-oseman/heartstopper-volume-3/9781444952773/'),
  identity('heartstopper', 4, 'Heartstopper: Volume Four', 'Alice Oseman', 2021, 'OL24476747W', '9781444952797', 'young-adult-children', 'https://www.hachette.co.uk/titles/alice-oseman/heartstopper-volume-4/9781444952797/'),
  identity('heartstopper', 6, 'Heartstopper: Volume Six', 'Alice Oseman', 2026, 'OL45345337W', '9781444974881', 'young-adult-children', 'https://aliceoseman.com/graphic-novel/heartstopper-volume-six/'),
  identity('kingsbridge', 5, 'The Armour of Light', 'Ken Follett', 2023, 'OL34334996W', '9781447278832', 'contemporary-general-fiction', 'https://ken-follett.com/books/the-armour-of-light/'),
  identity('percy-jackson-and-the-olympians', 7, 'Wrath of the Triple Goddess', 'Rick Riordan', 2024, 'OL45025627W', '9781368107631', 'young-adult-children', 'https://rickriordan.com/2024/01/wrath-of-the-triple-goddess/'),
  identity('red-rising', 6, 'Light Bringer', 'Pierce Brown', 2023, 'OL26353967W', '9780425285978', 'fantasy-science-fiction', 'https://www.penguinrandomhouse.com/books/545689/light-bringer-by-pierce-brown/hardcover/'),
  identity('shatter-me', 5, 'Defy Me', 'Tahereh Mafi', 2019, 'OL20145719W', '9781405291798', 'young-adult-children', 'https://www.harpercollins.com/products/defy-me-tahereh-mafi'),
  identity('silo', 3, 'Dust', 'Hugh Howey', 2013, 'OL17623070W', '9781804940846', 'fantasy-science-fiction', 'https://www.penguin.co.uk/books/455625/dust-by-howey-hugh/9781804940846'),
  identity('the-century-trilogy', 2, 'Winter of the World', 'Ken Follett', 2012, 'OL16531911W', '9780451419248', 'contemporary-general-fiction', 'https://www.penguinrandomhouse.com/books/303400/winter-of-the-world-by-ken-follett/'),
  identity('the-inheritance-games', 4, 'The Brothers Hawthorne', 'Jennifer Lynn Barnes', 2023, 'OL29046939W', '9780241638491', 'young-adult-children', 'https://www.penguin.co.uk/books/455104/the-brothers-hawthorne-by-barnes-jennifer-lynn/9780241638484'),
  identity('the-wheel-of-time', 3, 'The Dragon Reborn', 'Robert Jordan', 1991, 'OL7924143W', '9780765334350', 'fantasy-science-fiction', 'https://us.macmillan.com/books/9780765334350/thedragonreborn/'),
  identity('the-wheel-of-time', 7, 'A Crown of Swords', 'Robert Jordan', 1996, 'OL7924161W', '9780765336460', 'fantasy-science-fiction', 'https://us.macmillan.com/books/9780765336460/acrownofswords/'),
  identity('the-wheel-of-time', 12, 'The Gathering Storm', 'Robert Jordan', 2009, 'OL1946681W', '9780765302304', 'fantasy-science-fiction', 'https://us.macmillan.com/books/9780765302304/thegatheringstorm/'),
  identity('the-wheel-of-time', 13, 'Towers of Midnight', 'Robert Jordan', 2010, 'OL15414340W', '9781250252616', 'fantasy-science-fiction', 'https://us.macmillan.com/books/9781250252616/towersofmidnight/'),
  identity('the-witcher', 9, 'Crossroads of Ravens', 'Andrzej Sapkowski', 2025, 'OL44550081W', '9781399633451', 'fantasy-science-fiction', 'https://www.hachette.co.uk/titles/andrzej-sapkowski/crossroads-of-ravens/9781399633451/', 'OL368638A'),
] as const;

export const COLLECTION_V1_EXISTING_MEMBERSHIPS = [
  {
    collectionSlug: 'the-wheel-of-time',
    sequenceNumber: 2,
    workId: 281,
    title: 'The Great Hunt',
    author: 'Robert Jordan',
  },
] as const;

export const COLLECTION_V1_EXPECTED_TOTAL_CORRECTIONS = [
  {
    collectionSlug: 'heartstopper',
    from: 5,
    to: 6,
    sourceUrl: 'https://aliceoseman.com/graphic-novel/heartstopper-volume-six/',
  },
  {
    collectionSlug: 'the-empyrean',
    from: 5,
    to: 3,
    sourceUrl: 'https://rebeccayarros.com/empyrean',
  },
  {
    collectionSlug: 'the-witcher',
    from: 8,
    to: 9,
    sourceUrl: 'https://www.hachette.co.uk/titles/andrzej-sapkowski/crossroads-of-ravens/9781399633451/',
  },
] as const;
