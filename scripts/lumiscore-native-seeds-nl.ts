export type NativeWorkType =
  | 'novel'
  | 'novella'
  | 'short_story'
  | 'audiobook_original';

export type NativeSeedMetadata = {
  status: 'LUMISCORE_NATIVE_READY';
  isbn13: string;
  publicationYear: number;
  publisher: string;
  language: 'nld';
  workType: NativeWorkType;
  editionFormat?: 'paperback' | 'hardcover' | 'ebook' | 'audiobook';
};

export type NativeSeedDisposition =
  | NativeSeedMetadata
  | { status: 'NEEDS_MORE_RESEARCH'; reason: string }
  | { status: 'REJECT'; reason: string };

const key = (title: string, author: string) => `${title}\u0000${author}`;
const native = (
  isbn13: string,
  publicationYear: number,
  publisher: string,
  workType: NativeWorkType = 'novel',
  editionFormat?: NativeSeedMetadata['editionFormat'],
): NativeSeedMetadata => ({
  status: 'LUMISCORE_NATIVE_READY',
  isbn13,
  publicationYear,
  publisher,
  language: 'nld',
  workType,
  ...(editionFormat ? { editionFormat } : {}),
});

export const NETHERLANDS_NATIVE_DISPOSITIONS: Readonly<
  Record<string, NativeSeedDisposition>
> = {
  [key('Vele hemels boven de zevende', 'Griet Op de Beeck')]: native('9789044622805', 2013, 'Prometheus'),
  [key('Alter ego', 'Esther Verhoef')]: native('9789044652901', 2023, 'Prometheus'),
  [key('In mijn dromen', 'Simone van der Vlugt')]: native('9789041416841', 2011, 'Anthos'),
  [key('Nooit alleen', 'Loes den Hollander')]: native('9789059652040', 2013, 'CPNB', 'novella'),
  [key('Het dossier', 'Anya Niewierra')]: native('9789021049236', 2017, 'Luitingh-Sijthoff'),
  [key('Vogeleiland', 'Marion Pauw')]: native('9789048854943', 2021, 'The House of Books'),
  [key('Ibbeltje', 'Annie M.G. Schmidt')]: native('9789021480954', 1961, 'Querido'),
  [key('Stad in de storm', 'Thea Beckman')]: native('9789047750567', 1979, 'Lemniscaat', 'novel', 'ebook'),
  [key('Joël', 'Carry Slee')]: native('9789048857685', 2011, 'Overamstel Uitgevers'),
  [key('Groep acht aan de macht', 'Jacques Vriens')]: native('9789047509899', 2009, 'Van Holkema & Warendorf'),
  [key('Etty Hillesum', 'Judith Koelemeijer')]: native('9789463821742', 2022, 'Uitgeverij Balans'),
  [key('Moederland', 'Marcia Luyten')]: native('9789403194806', 2021, 'De Bezige Bij'),
  [key('Zoek het maar uit', 'Chantal van Gastel')]: native('9789044336481', 2011, 'The House of Books'),
  [key('Ik wist het', 'Chantal van Gastel')]: native('9789044344868', 2014, 'The House of Books'),
  [key('Helemaal het einde', 'Lisette Jonkman')]: native('9789024578252', 2017, 'Luitingh-Sijthoff'),
  [key('Onbreekbaar', 'Lisette Jonkman')]: {
    status: 'NEEDS_MORE_RESEARCH',
    reason: 'Series, volume-title and ISBN metadata remain conflated; do not import until the original ONIX record is verified.',
  },
  [key('Alles op alles', 'Marijke Vos')]: native('9789047211310', 2019, 'Ambo|Anthos'),
  [key('Van Chanel naar flanel', 'Marijke Vos')]: native('9789047211327', 2018, 'Ambo|Anthos'),
  [key('Wedden dat ik blijf', 'Marijke Vos')]: native('9789402762112', 2021, 'HarperCollins Holland'),
  [key('Ik pleit voor jou', 'Marijke Vos')]: native('9789402705454', 2020, 'HarperCollins Holland'),
  [key('Zes maanden zonder', 'Charlotte de Monchy')]: native('9789059901643', 2014, 'Boekerij'),
  [key('Eens gegeven', 'Charlotte de Monchy')]: native('9789022590393', 2016, 'Boekerij'),
  [key('De Mitsukoshi Troostbaby Company', 'Auke Hulst')]: native('9789026346934', 2021, 'Ambo|Anthos'),

  [key('De eilanden', 'Suzanne Vermeer')]: {
    status: 'REJECT',
    reason: 'Story collection containing seven works; it must not be imported as a standalone novel.',
  },
  [key('Zuidenwind', 'Suzanne Vermeer')]: native('9789044977257', 2019, 'A.W. Bruna Uitgevers', 'novella', 'ebook'),
  [key('Lentevuur', 'Suzanne Vermeer')]: native('9789044978445', 2020, 'A.W. Bruna Uitgevers', 'novella', 'ebook'),
  [key('Souvenir', 'Suzanne Vermeer')]: native('9789044978834', 2020, 'A.W. Bruna Uitgevers', 'novel', 'ebook'),
  [key('Waterland', 'Suzanne Vermeer')]: native('9789400512498', 2020, 'A.W. Bruna Uitgevers', 'novella', 'paperback'),
  [key('Midwinter', 'Suzanne Vermeer')]: native('9789046173695', 2020, 'A.W. Bruna Uitgevers', 'novel', 'audiobook'),
  [key('Koraalrif', 'Suzanne Vermeer')]: native('9789400515178', 2022, 'A.W. Bruna Uitgevers', 'novella', 'paperback'),
  [key('Nachtvorst', 'Suzanne Vermeer')]: native('9789044932577', 2021, 'A.W. Bruna Uitgevers', 'novel', 'ebook'),
  [key('Gletsjer', 'Suzanne Vermeer')]: native('9789044934489', 2022, 'A.W. Bruna Uitgevers', 'novel', 'ebook'),
  [key('Strandfeest', 'Suzanne Vermeer')]: native('9789044934632', 2023, 'A.W. Bruna Uitgevers', 'novel', 'ebook'),
  [key('De vallei', 'Suzanne Vermeer')]: native('9789400516267', 2023, 'A.W. Bruna Uitgevers', 'novella', 'paperback'),
  [key('Mayday', 'Suzanne Vermeer')]: native('9789044936117', 2023, 'A.W. Bruna Uitgevers', 'novel', 'ebook'),
  [key('Sneeuwstorm', 'Suzanne Vermeer')]: native('9789044934649', 2024, 'A.W. Bruna Uitgevers', 'novel', 'ebook'),
  [key('Bloemeneiland', 'Suzanne Vermeer')]: native('9789044936278', 2024, 'A.W. Bruna Uitgevers', 'novel', 'ebook'),
  [key('Nachtvlucht', 'Suzanne Vermeer')]: native('9789400517738', 2025, 'A.W. Bruna Uitgevers'),
  [key('Festival', 'Suzanne Vermeer')]: native('9789400517134', 2025, 'A.W. Bruna Uitgevers', 'novella', 'paperback'),
  [key('Ingesneeuwd', 'Suzanne Vermeer')]: native('9789400517721', 2025, 'A.W. Bruna Uitgevers'),
  [key('Onderstroom', 'Suzanne Vermeer')]: native('9789400519664', 2026, 'A.W. Bruna Uitgevers'),
  [key('Zomeravond', 'Suzanne Vermeer')]: native('9789044932560', 2021, 'A.W. Bruna Uitgevers', 'novel', 'ebook'),
  [key('Dwaalspoor', 'Suzanne Vermeer')]: native('9789044933192', 2021, 'A.W. Bruna Uitgevers', 'novella', 'ebook'),
  [key('Sterrennacht', 'Suzanne Vermeer')]: native('9789046176368', 2021, 'A.W. Bruna Uitgevers', 'audiobook_original', 'audiobook'),
  [key('Vakantiegeld', 'Suzanne Vermeer')]: native('9789044970814', 2013, 'A.W. Bruna Uitgevers', 'short_story', 'ebook'),
  [key('De scheiding', 'Suzanne Vermeer')]: native('9789044970777', 2013, 'A.W. Bruna Uitgevers', 'short_story', 'ebook'),
  [key('Een vluchtig gebaar', 'Suzanne Vermeer')]: native('9789044970784', 2013, 'A.W. Bruna Uitgevers', 'short_story', 'ebook'),
  [key('Madonna', 'Suzanne Vermeer')]: native('9789044970791', 2013, 'A.W. Bruna Uitgevers', 'short_story', 'ebook'),
  [key('In de mist', 'Suzanne Vermeer')]: native('9789044970807', 2013, 'A.W. Bruna Uitgevers', 'short_story', 'ebook'),
};

