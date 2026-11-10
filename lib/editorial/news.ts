export const NEWS_PATH = '/nieuws';

const slug = 'andy-weir-volgende-boek-geen-project-hail-mary-2';

// Only approved, public articles belong here. Drafts stay outside the product.
export const publishedNews = [{
  slug,
  path: `${NEWS_PATH}/${slug}`,
  title: 'Andy Weirs volgende boek wordt geen Project Hail Mary 2',
  description: 'Andy Weir schrijft een zelfstandige sciencefictionroman. Dit vertelde hij over het manuscript en de kans op een vervolg op Project Hail Mary.',
  date: '2026-11-10',
  image: '/assets/news/andy-weir-volgende-boek.jpg',
  imageAlt: 'LumiScore Boekennieuws: Andy Weir schrijft een nieuwe, zelfstandige roman.',
  lead: 'Wie hoopt op een nieuwe missie met Ryland Grace en Rocky, moet nog geduld hebben. Andy Weir werkt aan een zelfstandige sciencefictionroman. Dit vertelde hij over zijn manuscript en over de kans op een vervolg.',
  sections: [
    {
      heading: 'Hoe ver was het manuscript in oktober?',
      paragraphs: [
        'In een interview dat ScreenRant op 28 oktober 2026 publiceerde, vertelde Weir dat hij de grens van 95.000 woorden net was gepasseerd en aan het derde bedrijf werkte. Het ging toen om zijn eerste versie. Daarna zouden de opmerkingen van zijn redacteur en nieuwe schrijfrondes volgen.',
        'In de interviews maakte Weir geen titel of verschijningsdatum voor de roman bekend.',
      ],
    },
    {
      heading: 'Zou Weir ooit een vervolg schrijven?',
      paragraphs: [
        'In een interview met /Film, gepubliceerd op 1 november, zei Weir dat hij graag een vervolg zou schrijven als hij een idee vindt dat hem overtuigt. Hij bevestigde ook dat de roman waaraan hij werkt op zichzelf staat.',
      ],
    },
    {
      heading: 'Waar past Exoplanet in?',
      paragraphs: [
        'Op 5 november verscheen Exoplanet bij Audible. Benjamin Percy schreef dit afzonderlijke sciencefictionhoorspel. Weir was uitvoerend producent. De roman waarover hij in de interviews sprak is een ander project.',
      ],
    },
  ],
  sources: [
    { title: 'ScreenRant-interview met Andy Weir, via AOL', date: '28 oktober 2026', href: 'https://www.aol.com/articles/andy-weir-gives-official-next-221015000.html' },
    { title: '/Film-interview met Andy Weir over een mogelijk vervolg', date: '1 november 2026', href: 'https://www.slashfilm.com/2303088/project-hail-mary-author-andy-weir-sequel-condition/' },
    { title: 'Audible over Exoplanet en de rol van Andy Weir', date: '12 augustus 2026', href: 'https://www.audible.com/about/newsroom/andy-weir-to-executive-produce-new-sci-fi-thriller-exoplanet-for-audible' },
  ],
  book: { title: 'Project Hail Mary', href: '/nl/book/1' },
}] as const;
