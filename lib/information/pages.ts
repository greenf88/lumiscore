import type { Locale } from '../i18n/config.ts';
import { absoluteLumiScoreUrl } from '../seo/site-origin.ts';

export const INFORMATION_PAGE_KEYS = [
  'about',
  'howItWorks',
  'publishers',
  'contact',
] as const;

export type InformationPageKey = (typeof INFORMATION_PAGE_KEYS)[number];

export type InformationTextLink = {
  type: 'link';
  href: string;
  text: string;
};

export type InformationTextPart = string | InformationTextLink;

export type InformationSection = {
  heading: string;
  paragraphs?: InformationTextPart[][];
  bullets?: string[];
  afterBullets?: InformationTextPart[][];
  email?: {
    address: 'hello@lumisco.re';
    href: string;
  };
};

export type InformationPageContent = {
  key: InformationPageKey;
  locale: Locale;
  path: `/${string}`;
  eyebrow: string;
  title: string;
  lead: string;
  seoTitle: string;
  seoDescription: string;
  schemaType: 'AboutPage' | 'WebPage' | 'ContactPage';
  breadcrumbHome: string;
  sections: InformationSection[];
};

const link = (text: string, href: string): InformationTextLink => ({
  type: 'link',
  href,
  text,
});

const nl: Record<InformationPageKey, InformationPageContent> = {
  about: {
    key: 'about',
    locale: 'nl',
    path: '/over-ons',
    eyebrow: 'OVER LUMISCORE',
    title: 'Over LumiScore',
    lead: 'Een boek kiezen is verrassend lastig. Je ziet lovende flapteksten, lange aanbevelingslijsten en overal losse sterren, maar vaak wil je vooral één ding weten: vonden lezers dit boek écht goed?',
    seoTitle: 'Over LumiScore | Eerlijke boekscores voor lezers',
    seoDescription: 'Ontdek waarom drie boekenliefhebbers LumiScore ontwikkelden: eerlijke boekscores, complete boekenreeksen en eenvoudiger je volgende boek kiezen.',
    schemaType: 'AboutPage',
    breadcrumbHome: 'Home',
    sections: [
      {
        heading: 'Waarom we LumiScore maakten',
        paragraphs: [
          ['Wij zijn drie enthousiaste boekenlezers die merkten dat het antwoord op die simpele vraag vaak moeilijk te vinden was. Tegelijk liepen we tegen iets anders aan: bij langere boekenreeksen raak je gemakkelijk kwijt wat je al hebt gelezen, welk deel daarna komt en welke boeken je nog mist.'],
          ['Daarom ontwikkelden we LumiScore.'],
          ['LumiScore brengt de helderheid van een filmscore naar de wereld van boeken. Eén duidelijke score laat zien hoe lezers een boek waarderen. Zonder betaalde beoordelingen, zonder opgepoetste promoties en zonder invloed van uitgevers op de score.'],
        ],
      },
      {
        heading: 'Meer dan een boekscore',
        paragraphs: [
          ['Maar LumiScore gaat verder dan beoordelen. Je kunt bijhouden welke boeken je wilt lezen, waar je mee bezig bent en wat je al hebt gelezen. Bij boekenreeksen zie je de juiste volgorde, je voortgang en welk boek voor jou het volgende deel is.'],
          ['Ons doel is niet om te bepalen wat jij moet lezen. We willen het vooral gemakkelijker maken om een goed boek te vinden, je favoriete reeksen bij te houden en nooit meer per ongeluk halverwege een serie te beginnen.'],
          ['LumiScore is gemaakt door lezers, voor lezers — vanuit een eenvoudige overtuiging: een eerlijk oordeel en een duidelijk overzicht maken ieder volgend boek gemakkelijker te kiezen.'],
        ],
      },
      {
        heading: 'Ontdek LumiScore',
        paragraphs: [
          [
            'Lees ',
            link('zo werkt LumiScore', '/zo-werkt-het'),
            ', ontdek complete ',
            link('collecties', '/collections'),
            ' of begin direct met ',
            link('boeken ontdekken', '/browse'),
            '.',
          ],
        ],
      },
    ],
  },
  howItWorks: {
    key: 'howItWorks',
    locale: 'nl',
    path: '/zo-werkt-het',
    eyebrow: 'ZO WERKT HET',
    title: 'Zo werkt LumiScore',
    lead: 'Van één duidelijke boekscore tot het bijhouden van complete boekenreeksen: zo helpt LumiScore je bij het kiezen en lezen van je volgende boek.',
    seoTitle: 'Zo werkt LumiScore | Boekscores, leesstatus en reeksen',
    seoDescription: 'Ontdek hoe LumiScore werkt: beoordeel boeken, houd je leesstatus bij, volg je voortgang en vind het volgende deel van een boekenreeks.',
    schemaType: 'WebPage',
    breadcrumbHome: 'Home',
    sections: [
      {
        heading: '1. Eén duidelijke, eerlijke LumiScore',
        paragraphs: [
          ['Bij ieder boek staat één herkenbare LumiScore, opgebouwd uit beoordelingen van lezers.'],
          ['De score kan niet worden gekocht of door een uitgever worden aangepast. Commerciële informatie en eventuele recensies van professionele critici blijven gescheiden van het oordeel van lezers. Zo zie je direct wat de lezersgemeenschap werkelijk van een boek vindt.'],
          ['Hoe meer lezers hun beoordeling geven, hoe representatiever de LumiScore wordt.'],
        ],
      },
      {
        heading: '2. Houd je boeken bij',
        paragraphs: [
          ['Met een gratis account kun je ieder boek een persoonlijke status geven:'],
        ],
        bullets: ['Wil ik lezen', 'Aan het lezen', 'Gelezen', 'Niet uitgelezen'],
        afterBullets: [
          ['Geef je een boek een beoordeling, dan wordt het automatisch als gelezen geregistreerd. Zo bouw je zonder extra administratie je eigen leesgeschiedenis op.'],
        ],
      },
      {
        heading: '3. Maak je boekenreeks af',
        paragraphs: [
          ['LumiScore verzamelt de boeken uit een reeks in de juiste volgorde. Je ziet in één overzicht:'],
        ],
        bullets: [
          'welke delen je al hebt gelezen;',
          'welk boek je momenteel leest;',
          'welke delen je nog mist;',
          'welk boek het logische volgende deel is;',
          'hoeveel van de reeks je hebt voltooid.',
        ],
        afterBullets: [
          ['Ben je al in een boek begonnen? Dan helpt LumiScore je verder met ‘Ga verder met lezen’. Heb je een deel afgerond? Dan verschijnt het volgende ongelezen boek in de reeks.'],
          ['Zo hoef je nooit meer zelf uit te zoeken waar je bent gebleven.'],
        ],
      },
      {
        heading: '4. Ontdek je volgende boek',
        paragraphs: [
          [
            'Blader door ',
            link('boeken', '/browse'),
            ' en ',
            link('collecties', '/collections'),
            ', zoek op titel of auteur en bekijk welke boeken door andere lezers hoog worden gewaardeerd.',
          ],
          [
            'Je kunt LumiScore zonder account gebruiken om boeken en reeksen te bekijken. Met een account krijg je daarnaast je persoonlijke leesstatus, voortgang en vervolgsuggesties. ',
            link('Log in of maak een account aan', '/login?next=%2Fzo-werkt-het'),
            ' wanneer je die persoonlijke functies wilt gebruiken.',
          ],
        ],
      },
    ],
  },
  publishers: {
    key: 'publishers',
    locale: 'nl',
    path: '/voor-uitgevers',
    eyebrow: 'VOOR UITGEVERS',
    title: 'Voor uitgevers',
    lead: 'LumiScore wil lezers betrouwbare boekinformatie en een eerlijk, onafhankelijk lezersoordeel bieden.',
    seoTitle: 'Voor uitgevers | Betrouwbare boekinformatie op LumiScore',
    seoDescription: 'Lever als uitgever correcte informatie aan over boeken, auteurs, edities en boekenreeksen, met behoud van LumiScores onafhankelijke lezersoordeel.',
    schemaType: 'WebPage',
    breadcrumbHome: 'Home',
    sections: [
      {
        heading: 'Betrouwbare boekinformatie',
        paragraphs: [
          ['Bent u uitgever en ontbreekt er een titel, klopt bepaalde boekinformatie niet of wilt u correcte gegevens over een auteur, editie of boekenreeks aanleveren? Dan horen we dat graag.'],
          ['U kunt onder meer contact met ons opnemen over:'],
        ],
        bullets: [
          'ontbrekende of nieuwe titels;',
          'correcte auteurs- en editiegegevens;',
          'omslagen en publicatiegegevens;',
          'de juiste volgorde van een boekenreeks;',
          'inhoudelijke samenwerkingen die waarde toevoegen voor lezers.',
        ],
      },
      {
        heading: 'Een onafhankelijk lezersoordeel',
        paragraphs: [
          ['De betrouwbaarheid van LumiScore staat altijd voorop. Een samenwerking, commerciële relatie of aangeleverde informatie heeft daarom nooit invloed op lezersbeoordelingen, de LumiScore of persoonlijke leesadviezen.'],
          [
            'Lees meer ',
            link('over LumiScore', '/over-ons'),
            ' en over ',
            link('hoe LumiScore werkt', '/zo-werkt-het'),
            '.',
          ],
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [['Stuur ons een e-mail met uw vraag of correctie.']],
        email: {
          address: 'hello@lumisco.re',
          href: 'mailto:hello@lumisco.re?subject=Vraag%20van%20uitgever%20over%20LumiScore',
        },
      },
    ],
  },
  contact: {
    key: 'contact',
    locale: 'nl',
    path: '/contact',
    eyebrow: 'CONTACT',
    title: 'Contact met LumiScore',
    lead: 'Heb je een vraag, een goed idee of informatie gezien die niet klopt? Laat het ons weten.',
    seoTitle: 'Contact met LumiScore | Vragen en boekcorrecties',
    seoDescription: 'Neem contact op met LumiScore over vragen, ontbrekende boeken, correcties, technische problemen, samenwerkingen en informatie voor uitgevers.',
    schemaType: 'ContactPage',
    breadcrumbHome: 'Home',
    sections: [
      {
        heading: 'Waarover kun je contact opnemen?',
        paragraphs: [['Je kunt contact opnemen over:']],
        bullets: [
          'vragen over LumiScore;',
          'correcties bij een boek of boekenreeks;',
          'ontbrekende titels;',
          'technische problemen;',
          'privacy en accountvragen;',
          'samenwerkingen en pers;',
          'vragen van auteurs en uitgevers.',
        ],
      },
      {
        heading: 'Stuur ons een bericht',
        email: {
          address: 'hello@lumisco.re',
          href: 'mailto:hello@lumisco.re?subject=Contact%20via%20LumiScore',
        },
        paragraphs: [
          ['We lezen ieder bericht en proberen je zo snel mogelijk te helpen.'],
          [
            'Ben je uitgever? Bekijk dan ook onze ',
            link('informatie voor uitgevers', '/voor-uitgevers'),
            '.',
          ],
        ],
      },
    ],
  },
};

const en: Record<InformationPageKey, InformationPageContent> = {
  about: {
    key: 'about',
    locale: 'en',
    path: '/over-ons',
    eyebrow: 'ABOUT LUMISCORE',
    title: 'About LumiScore',
    lead: 'Choosing a book can be surprisingly difficult. There are glowing blurbs, endless recommendation lists and star ratings everywhere, but often you simply want to know one thing: did readers genuinely enjoy this book?',
    seoTitle: 'About LumiScore | Honest book scores for readers',
    seoDescription: 'Discover why three book lovers created LumiScore: honest reader scores, complete book series and an easier way to choose your next book.',
    schemaType: 'AboutPage',
    breadcrumbHome: 'Home',
    sections: [
      {
        heading: 'Why we built LumiScore',
        paragraphs: [
          ['We are a team of three enthusiastic readers who found that the answer to this simple question was often hard to find. We also kept running into another problem: with longer book series, it is easy to lose track of what you have read, which book comes next and which volumes you are still missing.'],
          ['That is why we created LumiScore.'],
          ['LumiScore brings the clarity of a film score to the world of books. One clear score shows how readers rate a book. No paid ratings, no polished promotions and no publisher influence over the score.'],
        ],
      },
      {
        heading: 'More than a book score',
        paragraphs: [
          ['LumiScore goes beyond ratings. You can keep track of the books you want to read, what you are currently reading and what you have finished. For book series, you can see the correct order, your progress and the next book for you.'],
          ['Our goal is not to tell you what to read. We want to make it easier to find a good book, follow your favourite series and never accidentally start halfway through one.'],
          ['LumiScore is made by readers, for readers — built on a simple belief: an honest opinion and a clear overview make every next book easier to choose.'],
        ],
      },
      {
        heading: 'Discover LumiScore',
        paragraphs: [
          [
            'Learn ',
            link('how LumiScore works', '/zo-werkt-het'),
            ', explore complete ',
            link('collections', '/collections'),
            ' or start ',
            link('browsing books', '/browse'),
            '.',
          ],
        ],
      },
    ],
  },
  howItWorks: {
    key: 'howItWorks',
    locale: 'en',
    path: '/zo-werkt-het',
    eyebrow: 'HOW IT WORKS',
    title: 'How LumiScore works',
    lead: 'From one clear book score to tracking complete series, LumiScore helps you choose and read your next book.',
    seoTitle: 'How LumiScore works | Book scores, reading status and series',
    seoDescription: 'Discover how LumiScore works: rate books, track your reading status and progress, and find the next volume in a book series.',
    schemaType: 'WebPage',
    breadcrumbHome: 'Home',
    sections: [
      {
        heading: '1. One clear, honest LumiScore',
        paragraphs: [
          ['Every book has one recognisable LumiScore, built from reader ratings.'],
          ['The score cannot be bought or adjusted by a publisher. Commercial information and any reviews from professional critics remain separate from the reader verdict, so you can immediately see what the reading community genuinely thinks of a book.'],
          ['The more readers submit a rating, the more representative the LumiScore becomes.'],
        ],
      },
      {
        heading: '2. Keep track of your books',
        paragraphs: [['With a free account, you can give every book a personal status:']],
        bullets: ['Want to read', 'Reading', 'Read', 'Did not finish'],
        afterBullets: [
          ['When you rate a book, it is automatically marked as read. This builds your reading history without extra admin.'],
        ],
      },
      {
        heading: '3. Complete your book series',
        paragraphs: [['LumiScore brings the books in a series together in the correct order. In one overview, you can see:']],
        bullets: [
          'which volumes you have read;',
          'which book you are currently reading;',
          'which volumes you are missing;',
          'which book is the logical next volume;',
          'how much of the series you have completed.',
        ],
        afterBullets: [
          ['Already started a book? LumiScore helps you pick it up again with “Continue reading”. Once you finish a volume, the next unread book in the series appears.'],
          ['You never have to work out where you left off again.'],
        ],
      },
      {
        heading: '4. Discover your next book',
        paragraphs: [
          [
            'Browse ',
            link('books', '/browse'),
            ' and ',
            link('collections', '/collections'),
            ', search by title or author, and see which books other readers rate highly.',
          ],
          [
            'You can use LumiScore without an account to browse books and series. An account also gives you personal reading statuses, progress and suggestions for what to read next. ',
            link('Sign in or create an account', '/login?next=%2Fzo-werkt-het'),
            ' when you want to use those personal features.',
          ],
        ],
      },
    ],
  },
  publishers: {
    key: 'publishers',
    locale: 'en',
    path: '/voor-uitgevers',
    eyebrow: 'FOR PUBLISHERS',
    title: 'For publishers',
    lead: 'LumiScore aims to give readers reliable book information and an honest, independent reader verdict.',
    seoTitle: 'For publishers | Reliable book information on LumiScore',
    seoDescription: 'Send LumiScore accurate information about books, authors, editions and series while preserving an independent reader verdict.',
    schemaType: 'WebPage',
    breadcrumbHome: 'Home',
    sections: [
      {
        heading: 'Reliable book information',
        paragraphs: [
          ['Are you a publisher and is a title missing, is some book information incorrect, or would you like to provide accurate details about an author, edition or book series? We would be glad to hear from you.'],
          ['You can contact us about:'],
        ],
        bullets: [
          'missing or newly published titles;',
          'accurate author and edition details;',
          'covers and publication information;',
          'the correct order of a book series;',
          'editorial collaborations that add value for readers.',
        ],
      },
      {
        heading: 'An independent reader verdict',
        paragraphs: [
          ['LumiScore’s reliability always comes first. A collaboration, commercial relationship or supplied information can therefore never influence reader ratings, the LumiScore or personal reading recommendations.'],
          [
            'Read more ',
            link('about LumiScore', '/over-ons'),
            ' and ',
            link('how LumiScore works', '/zo-werkt-het'),
            '.',
          ],
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [['Email us with your question or correction.']],
        email: {
          address: 'hello@lumisco.re',
          href: 'mailto:hello@lumisco.re?subject=Vraag%20van%20uitgever%20over%20LumiScore',
        },
      },
    ],
  },
  contact: {
    key: 'contact',
    locale: 'en',
    path: '/contact',
    eyebrow: 'CONTACT',
    title: 'Contact LumiScore',
    lead: 'Have a question, a good idea or information that does not look right? Let us know.',
    seoTitle: 'Contact LumiScore | Questions and book corrections',
    seoDescription: 'Contact LumiScore about questions, missing books, corrections, technical issues, collaborations and information for publishers.',
    schemaType: 'ContactPage',
    breadcrumbHome: 'Home',
    sections: [
      {
        heading: 'What can you contact us about?',
        paragraphs: [['You can contact us about:']],
        bullets: [
          'questions about LumiScore;',
          'corrections to a book or book series;',
          'missing titles;',
          'technical issues;',
          'privacy and account questions;',
          'collaborations and press enquiries;',
          'questions from authors and publishers.',
        ],
      },
      {
        heading: 'Send us a message',
        email: {
          address: 'hello@lumisco.re',
          href: 'mailto:hello@lumisco.re?subject=Contact%20via%20LumiScore',
        },
        paragraphs: [
          ['We read every message and will try to help you as soon as we can.'],
          [
            'Are you a publisher? See our ',
            link('information for publishers', '/voor-uitgevers'),
            '.',
          ],
        ],
      },
    ],
  },
};

const PAGES: Record<Locale, Record<InformationPageKey, InformationPageContent>> = {
  en,
  nl,
};

export function getInformationPageContent(
  key: InformationPageKey,
  locale: Locale,
): InformationPageContent {
  return PAGES[locale][key];
}

export function buildInformationPageJsonLd(page: InformationPageContent) {
  const url = absoluteLumiScoreUrl(page.path);
  const homeUrl = absoluteLumiScoreUrl('/');

  return [
    {
      '@context': 'https://schema.org',
      '@type': page.schemaType,
      '@id': `${url}#webpage`,
      url,
      name: page.title,
      description: page.seoDescription,
      inLanguage: page.locale === 'nl' ? 'nl-NL' : 'en',
      isPartOf: {
        '@type': 'WebSite',
        '@id': `${homeUrl}#website`,
        url: homeUrl,
        name: 'LumiScore',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: page.breadcrumbHome,
          item: homeUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: page.title,
          item: url,
        },
      ],
    },
  ];
}

export function serializeInformationPageJsonLd(page: InformationPageContent): string {
  return JSON.stringify(buildInformationPageJsonLd(page)).replaceAll('<', '\\u003c');
}
