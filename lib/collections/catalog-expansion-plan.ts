export type ExpansionCollectionDefinition = {
  slug: string;
  name: string;
  collectionType: 'series';
  description: string;
  publishedMainSeriesCount: number;
  lifecycle: 'complete' | 'ongoing';
};

export type ReviewedExpansionMembershipIdentity = {
  workId: number;
  openLibraryWorkId: string;
  collectionSlug: string;
  sequenceNumber: number;
  mainSeries: true;
};

const series = (
  slug: string,
  name: string,
  publishedMainSeriesCount: number,
  lifecycle: ExpansionCollectionDefinition['lifecycle'],
  description: string,
): ExpansionCollectionDefinition => ({
  slug,
  name,
  collectionType: 'series',
  description,
  publishedMainSeriesCount,
  lifecycle,
});

export const CATALOG_EXPANSION_COLLECTIONS = [
  series('shatter-me', 'Shatter Me', 6, 'complete', 'The six main Shatter Me novels in publication order; companion novellas are excluded.'),
  series('a-court-of-thorns-and-roses', 'A Court of Thorns and Roses', 4, 'ongoing', 'The published full-length ACOTAR novels in publication order; A Court of Frost and Starlight is excluded as a companion novella.'),
  series('the-folk-of-the-air', 'The Folk of the Air', 3, 'complete', 'The three main Folk of the Air novels in publication order; companion stories are excluded.'),
  series('twisted', 'Twisted', 4, 'complete', 'The four main Twisted novels in publication order.'),
  series('the-heroes-of-olympus', 'The Heroes of Olympus', 5, 'complete', 'The five main Heroes of Olympus novels in publication order.'),
  series('the-empyrean', 'The Empyrean', 3, 'ongoing', 'The published main Empyrean novels in publication order.'),
  series('throne-of-glass', 'Throne of Glass', 7, 'complete', 'The seven main Throne of Glass novels in publication order; The Assassin’s Blade novella collection is excluded.'),
  series('red-rising', 'Red Rising', 6, 'ongoing', 'The published main Red Rising novels in publication order.'),
  series('caraval', 'Caraval', 3, 'complete', 'The three main Caraval novels in publication order.'),
  series('shadow-and-bone', 'Shadow and Bone', 3, 'complete', 'The three main Shadow and Bone novels in publication order.'),
  series('maple-hills', 'Maple Hills', 3, 'ongoing', 'The published main Maple Hills novels in publication order.'),
  series('once-upon-a-broken-heart', 'Once Upon a Broken Heart', 3, 'complete', 'The three main Once Upon a Broken Heart novels in publication order.'),
  series('powerless', 'Powerless', 3, 'complete', 'The three full-length Powerless novels in publication order; Powerful is excluded as a companion novella.'),
  series('kingsbridge', 'Kingsbridge', 5, 'ongoing', 'The published main Kingsbridge novels in publication order.'),
  series('mistborn-era-one', 'Mistborn Era One', 3, 'complete', 'The original Mistborn trilogy in publication order.'),
  series('the-century-trilogy', 'The Century Trilogy', 3, 'complete', 'The three Century Trilogy novels in publication order.'),
  series('dreamland-billionaires', 'Dreamland Billionaires', 3, 'complete', 'The three main Dreamland Billionaires novels in publication order.'),
  series('outlander', 'Outlander', 9, 'ongoing', 'The published main Outlander novels in publication order; companion works are excluded.'),
  series('mistborn-era-two', 'Mistborn Era Two', 4, 'complete', 'The four Wax and Wayne novels in publication order, kept separate from Mistborn Era One.'),
  series('knockemout', 'Knockemout', 3, 'complete', 'The three main Knockemout novels in publication order.'),
  series('the-stormlight-archive', 'The Stormlight Archive', 5, 'ongoing', 'The published main Stormlight Archive novels in publication order; novellas are excluded.'),
  series('the-wheel-of-time', 'The Wheel of Time', 14, 'complete', 'The fourteen main Wheel of Time novels in publication order; New Spring is excluded as a prequel.'),
  series('kings-of-sin', 'Kings of Sin', 6, 'ongoing', 'The published main Kings of Sin novels in publication order.'),
  series('chestnut-springs', 'Chestnut Springs', 5, 'complete', 'The five main Chestnut Springs novels in publication order.'),
  series('crescent-city', 'Crescent City', 3, 'ongoing', 'The published main Crescent City novels in publication order.'),
  series('thursday-murder-club', 'Thursday Murder Club', 5, 'ongoing', 'The published main Thursday Murder Club novels in publication order.'),
  series('heartstopper', 'Heartstopper', 5, 'ongoing', 'The five published main Heartstopper graphic-novel volumes in publication order.'),
] as const satisfies readonly ExpansionCollectionDefinition[];

const membership = (
  workId: number,
  openLibraryWorkId: string,
  collectionSlug: string,
  sequenceNumber: number,
): ReviewedExpansionMembershipIdentity => ({
  workId,
  openLibraryWorkId,
  collectionSlug,
  sequenceNumber,
  mainSeries: true,
});

export const REVIEWED_CATALOG_EXPANSION_MEMBERSHIPS = [
  membership(1358, 'OL16014245W', 'shatter-me', 1),
  membership(1360, 'OL17352669W', 'a-court-of-thorns-and-roses', 1),
  membership(1361, 'OL17850410W', 'the-folk-of-the-air', 1),
  membership(1364, 'OL27818823W', 'twisted', 4),
  membership(1365, 'OL25515697W', 'twisted', 2),
  membership(1366, 'OL15401200W', 'the-heroes-of-olympus', 1),
  membership(1369, 'OL29226517W', 'the-empyrean', 1),
  membership(1370, 'OL16607146W', 'throne-of-glass', 1),
  membership(1372, 'OL19726995W', 'red-rising', 4),
  membership(1378, 'OL19963111W', 'shatter-me', 2),
  membership(1379, 'OL17715454W', 'caraval', 1),
  membership(1380, 'OL16239519W', 'shadow-and-bone', 1),
  membership(1382, 'OL28952677W', 'maple-hills', 1),
  membership(1383, 'OL24706481W', 'once-upon-a-broken-heart', 1),
  membership(1385, 'OL34774028W', 'powerless', 1),
  membership(1386, 'OL15980243W', 'the-heroes-of-olympus', 2),
  membership(1387, 'OL1914022W', 'kingsbridge', 1),
  membership(1389, 'OL16664287W', 'the-heroes-of-olympus', 3),
  membership(1391, 'OL17059943W', 'the-heroes-of-olympus', 5),
  membership(1393, 'OL17823218W', 'a-court-of-thorns-and-roses', 3),
  membership(1406, 'OL16807730W', 'the-heroes-of-olympus', 4),
  membership(1409, 'OL5738154W', 'mistborn-era-one', 3),
  membership(1412, 'OL27090610W', 'once-upon-a-broken-heart', 2),
  membership(1418, 'OL18543708W', 'the-folk-of-the-air', 2),
  membership(1420, 'OL19352982W', 'throne-of-glass', 7),
  membership(1425, 'OL15382656W', 'the-century-trilogy', 1),
  membership(1429, 'OL26201864W', 'dreamland-billionaires', 1),
  membership(1466, 'OL3261153W', 'outlander', 2),
  membership(1470, 'OL19737574W', 'shatter-me', 4),
  membership(1481, 'OL16597059W', 'mistborn-era-two', 1),
  membership(1490, 'OL28880495W', 'knockemout', 2),
  membership(1511, 'OL17834026W', 'the-stormlight-archive', 3),
  membership(1519, 'OL33364737W', 'once-upon-a-broken-heart', 3),
  membership(1532, 'OL20842226W', 'the-stormlight-archive', 4),
  membership(1620, 'OL7924099W', 'the-wheel-of-time', 10),
  membership(1624, 'OL1946687W', 'the-wheel-of-time', 8),
  membership(1876, 'OL7924199W', 'the-wheel-of-time', 4),
  membership(1892, 'OL7924208W', 'the-wheel-of-time', 6),
  membership(1900, 'OL7924172W', 'the-wheel-of-time', 5),
  membership(1909, 'OL45106188W', 'kings-of-sin', 6),
  membership(1910, 'OL34808056W', 'chestnut-springs', 4),
  membership(1911, 'OL17625829W', 'throne-of-glass', 5),
  membership(1912, 'OL17791167W', 'throne-of-glass', 6),
  membership(1913, 'OL34780775W', 'crescent-city', 3),
  membership(1914, 'OL37855093W', 'powerless', 2),
  membership(1915, 'OL42487406W', 'powerless', 3),
  membership(1916, 'OL42393184W', 'kings-of-sin', 5),
  membership(1917, 'OL36460031W', 'chestnut-springs', 5),
  membership(1918, 'OL28804417W', 'thursday-murder-club', 4),
  membership(1919, 'OL42433711W', 'thursday-murder-club', 5),
  membership(1920, 'OL28959223W', 'heartstopper', 5),
] as const satisfies readonly ReviewedExpansionMembershipIdentity[];

export type CompletenessTarget = {
  slug: string;
  name: string;
  expectedTitles: readonly string[];
  lifecycle: 'complete' | 'ongoing';
};

export const PRIORITY_COMPLETENESS_TARGETS = [
  { slug: 'once-upon-a-broken-heart', name: 'Once Upon a Broken Heart', lifecycle: 'complete', expectedTitles: ['Once Upon a Broken Heart', 'The Ballad of Never After', 'A Curse for True Love'] },
  { slug: 'powerless', name: 'Powerless', lifecycle: 'complete', expectedTitles: ['Powerless', 'Reckless', 'Fearless'] },
  { slug: 'the-heroes-of-olympus', name: 'The Heroes of Olympus', lifecycle: 'complete', expectedTitles: ['The Lost Hero', 'The Son of Neptune', 'The Mark of Athena', 'The House of Hades', 'The Blood of Olympus'] },
  { slug: 'the-chronicles-of-narnia', name: 'Narnia', lifecycle: 'complete', expectedTitles: ['The Lion, the Witch and the Wardrobe', 'Prince Caspian', 'The Voyage of the Dawn Treader', 'The Silver Chair', 'The Horse and His Boy', "The Magician's Nephew", 'The Last Battle'] },
  { slug: 'earthsea', name: 'Earthsea', lifecycle: 'complete', expectedTitles: ['A Wizard of Earthsea', 'The Tombs of Atuan', 'The Farthest Shore', 'Tehanu', 'Tales from Earthsea', 'The Other Wind'] },
  { slug: 'mistborn-era-one', name: 'Mistborn Era One', lifecycle: 'complete', expectedTitles: ['The Final Empire', 'The Well of Ascension', 'The Hero of Ages'] },
  { slug: 'mistborn-era-two', name: 'Mistborn Era Two', lifecycle: 'complete', expectedTitles: ['The Alloy of Law', 'Shadows of Self', 'The Bands of Mourning', 'The Lost Metal'] },
  { slug: 'the-stormlight-archive', name: 'The Stormlight Archive', lifecycle: 'ongoing', expectedTitles: ['The Way of Kings', 'Words of Radiance', 'Oathbringer', 'Rhythm of War', 'Wind and Truth'] },
  { slug: 'dune', name: 'Dune', lifecycle: 'complete', expectedTitles: ['Dune', 'Dune Messiah', 'Children of Dune', 'God Emperor of Dune', 'Heretics of Dune', 'Chapterhouse: Dune'] },
  { slug: 'foundation', name: 'Foundation', lifecycle: 'complete', expectedTitles: ['Foundation', 'Foundation and Empire', 'Second Foundation', "Foundation's Edge", 'Foundation and Earth', 'Prelude to Foundation', 'Forward the Foundation'] },
  { slug: 'the-wheel-of-time', name: 'The Wheel of Time', lifecycle: 'complete', expectedTitles: ['The Eye of the World', 'The Great Hunt', 'The Dragon Reborn', 'The Shadow Rising', 'The Fires of Heaven', 'Lord of Chaos', 'A Crown of Swords', 'The Path of Daggers', "Winter's Heart", 'Crossroads of Twilight', 'Knife of Dreams', 'The Gathering Storm', 'Towers of Midnight', 'A Memory of Light'] },
  { slug: 'a-court-of-thorns-and-roses', name: 'A Court of Thorns and Roses', lifecycle: 'ongoing', expectedTitles: ['A Court of Thorns and Roses', 'A Court of Mist and Fury', 'A Court of Wings and Ruin', 'A Court of Silver Flames'] },
  { slug: 'throne-of-glass', name: 'Throne of Glass', lifecycle: 'complete', expectedTitles: ['Throne of Glass', 'Crown of Midnight', 'Heir of Fire', 'Queen of Shadows', 'Empire of Storms', 'Tower of Dawn', 'Kingdom of Ash'] },
  { slug: 'crescent-city', name: 'Crescent City', lifecycle: 'ongoing', expectedTitles: ['House of Earth and Blood', 'House of Sky and Breath', 'House of Flame and Shadow'] },
  { slug: 'the-empyrean', name: 'The Empyrean', lifecycle: 'ongoing', expectedTitles: ['Fourth Wing', 'Iron Flame', 'Onyx Storm'] },
  { slug: 'kings-of-sin', name: 'Kings of Sin', lifecycle: 'ongoing', expectedTitles: ['King of Wrath', 'King of Pride', 'King of Greed', 'King of Sloth', 'King of Envy', 'King of Gluttony'] },
  { slug: 'thursday-murder-club', name: 'Thursday Murder Club', lifecycle: 'ongoing', expectedTitles: ['The Thursday Murder Club', 'The Man Who Died Twice', 'The Bullet That Missed', 'The Last Devil to Die', 'The Impossible Fortune'] },
  { slug: 'heartstopper', name: 'Heartstopper', lifecycle: 'ongoing', expectedTitles: ['Heartstopper, Volume One', 'Heartstopper, Volume Two', 'Heartstopper, Volume Three', 'Heartstopper, Volume Four', 'Heartstopper, Volume Five'] },
] as const satisfies readonly CompletenessTarget[];
