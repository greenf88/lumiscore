import type { Locale } from '../i18n/config.ts';
import { absoluteLumiScoreUrl } from '../seo/site-origin.ts';
import { LUMISCORE_WEBSITE_ID } from '../seo/site-identity.ts';

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
    lead: 'Beoordeel boeken van 1 tot 10, ontdek wat bij je leessmaak past en houd je boeken en reeksen bij. Dit betekenen de scores en persoonlijke leestips op LumiScore.',
    seoTitle: 'Zo werkt LumiScore | Boeken beoordelen & persoonlijke leestips',
    seoDescription: 'Lees hoe je boeken beoordeelt van 1 tot 10, wanneer de publieke LumiScore verschijnt en hoe je leesprofiel, persoonlijke matches en reeksvoortgang werken.',
    schemaType: 'WebPage',
    breadcrumbHome: 'Home',
    sections: [
      {
        heading: 'Hoe beoordeel je een boek van 1 tot 10?',
        paragraphs: [
          ['Log in en zoek een boek dat je hebt gelezen. Tik op een heel cijfer van 1 tot 10 om je beoordeling op te slaan. In de smaaktest verschijnt pas na succesvolle opslag het volgende boek.'],
          ['Je hebt één beoordeling per boek, ook als je een andere editie bekijkt. Je kunt je eigen cijfer op de boekpagina aanpassen. Niet gelezen? Sla het boek in de smaaktest over; overslaan telt niet als beoordeling.'],
          [link('Zoek een boek om te beoordelen', '/browse'), ' of ', link('begin met de smaaktest', '/taste-test'), '.'],
        ],
      },
      {
        heading: 'Hoe ontstaat de publieke LumiScore?',
        paragraphs: [
          ['De publieke LumiScore is het gemiddelde van de opgeslagen lezersbeoordelingen, afgerond op één decimaal. De score verschijnt pas vanaf drie verschillende beoordelaars. Daaronder staat een streepje met ‘Onvoldoende beoordelingen’.'],
          ['We tonen een bandbreedte voor het aantal beoordelaars, bijvoorbeeld 3–4, in plaats van het exacte aantal. Een score op basis van weinig lezers is nog gevoelig voor een nieuw oordeel: het is een eerste indruk, geen vaststaand kwaliteitsoordeel.'],
        ],
      },
      {
        heading: 'Wat is het verschil tussen een lezersscore en jouw match?',
        paragraphs: [
          ['De LumiScore vat de beoordelingen van lezers samen. Jouw persoonlijke match vergelijkt daarentegen je leessmaak met de onderbouwde kenmerken van dat boek. Een hoog gewaardeerd boek hoeft dus niet jouw beste match te zijn.'],
          ['Bij beperkte onderbouwing blijft een match voorlopig of verschijnt er geen matchcijfer. Een match is geen voorspelde kans dat je het boek leuk vindt en geen garantie.'],
        ],
      },
      {
        heading: 'Hoe helpen je beoordelingen bij je leesprofiel?',
        paragraphs: [
          ['Je hogere én lagere beoordelingen helpen LumiScore je voorkeuren te herkennen. Alleen voldoende onderbouwde boekkenmerken dragen bij aan een inhoudelijke voorkeur. Je leesprofiel en aanbevelingen gebruiken dezelfde smaakberekening.'],
          ['Met weinig bewijs zijn leestips verkennend. Meer beoordelingen kunnen het profiel verfijnen, maar niet ieder boek levert meteen een duidelijke voorkeur op.'],
          [link('Ontdek je leessmaak met de smaaktest', '/taste-test'), '. Je opgeslagen beoordelingen blijven gekoppeld aan je account.'],
        ],
      },
      {
        heading: 'Hoe houd je gelezen boeken en reeksvoortgang bij?',
        paragraphs: [
          ['Met een account geef je boeken de status Wil ik lezen, Aan het lezen, Gelezen of Niet uitgelezen. Een beoordeeld boek telt ook als gelezen. In Mijn boeken vind je je eigen overzicht.'],
          ['Bij een reeks zie je welke opgenomen delen je hebt gelezen. Een volgende-leessuggestie verschijnt wanneer de bekende reeksvolgorde dit ondersteunt. Een voltooiingspercentage betekent niet automatisch dat alle ooit verschenen delen in de catalogus staan.'],
          [link('Bekijk boekenreeksen en collecties', '/collections'), '. Je kunt zonder account rondkijken; ', link('log in of maak een account aan', '/login?next=%2Fzo-werkt-het'), ' om je eigen voortgang te bewaren.'],
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
    lead: 'Rate books from 1 to 10, discover what suits your reading taste and track your books and series. Here is what reader ratings and personal recommendations mean on LumiScore.',
    seoTitle: 'How LumiScore works | Rate books & find personal recommendations',
    seoDescription: 'Learn how to rate books from 1 to 10, when public reader scores appear, and how your reading profile, personal matches and series progress work.',
    schemaType: 'WebPage',
    breadcrumbHome: 'Home',
    sections: [
      {
        heading: 'How do you rate a book from 1 to 10?',
        paragraphs: [
          ['Sign in and find a book you have read. Tap a whole number from 1 to 10 to save your rating. In the taste test, the next book appears only after a successful save.'],
          ['You have one rating per book, even when you view a different edition. You can change your own score on the book page. Not read it? Skip it in the taste test; skipping does not count as a rating.'],
          [link('Find a book to rate', '/browse'), ' or ', link('start the taste test', '/taste-test'), '.'],
        ],
      },
      {
        heading: 'How is the public LumiScore calculated?',
        paragraphs: [
          ['The public LumiScore is the average of saved reader ratings, rounded to one decimal place. It appears only after at least three different readers have rated the book. Below that threshold, you see a dash and “Insufficient ratings”.'],
          ['We show a range for the number of readers, such as 3–4, rather than the exact count. A score based on a few readers is still sensitive to each new rating: it is an early impression, not a settled verdict on quality.'],
        ],
      },
      {
        heading: 'What is the difference between a reader score and your match?',
        paragraphs: [
          ['The LumiScore summarises reader ratings. Your personal match instead compares your reading taste with the supported traits of that book. A highly rated book is not necessarily your best match.'],
          ['With limited evidence, a match stays provisional or no match number is shown. A match is not a predicted probability that you will enjoy a book, or a guarantee.'],
        ],
      },
      {
        heading: 'How do ratings help your reading profile?',
        paragraphs: [
          ['Both higher and lower ratings help LumiScore recognise your preferences. Only sufficiently supported book traits contribute to a content preference. Your reading profile and recommendations use the same taste calculation.'],
          ['With little evidence, recommendations are exploratory. More ratings can refine your profile, but not every book immediately establishes a clear preference.'],
          [link('Discover your reading taste with the taste test', '/taste-test'), '. Your saved ratings stay linked to your account.'],
        ],
      },
      {
        heading: 'How do you track books read and series progress?',
        paragraphs: [
          ['With an account, mark books as Want to read, Reading, Read or Did not finish. Rated books also count as read. My books brings your own reading list together.'],
          ['A series shows which listed volumes you have read. A next-read suggestion appears when the known series order supports it. A completion percentage does not automatically mean the catalog contains every volume ever published.'],
          [link('Explore book series and collections', '/collections'), '. You can browse without an account; ', link('sign in or create an account', '/login?next=%2Fzo-werkt-het'), ' to keep your own progress.'],
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
  const url = absoluteLumiScoreUrl(`/${page.locale}${page.path}`);
  const homeUrl = absoluteLumiScoreUrl(`/${page.locale}`);

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
        '@id': LUMISCORE_WEBSITE_ID,
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
