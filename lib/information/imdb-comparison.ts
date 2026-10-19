import type { InformationPageContent } from './pages.ts';
import { IMDB_COMPARISON_PATHS } from '../i18n/paths.ts';

export const IMDB_COMPARISON_CONTENT: Record<'nl' | 'en', InformationPageContent> = {
  nl: {
    key: 'imdbComparison', locale: 'nl', path: IMDB_COMPARISON_PATHS.nl, layout: 'compact',
    eyebrow: 'BOEKEN BEOORDELEN',
    title: 'Zoek je een IMDb voor boeken?',
    lead: 'Met LumiScore beoordeel je boeken van 1 tot 10, ontdek je lezersscores en houd je bij welke boeken en reeksdelen je hebt gelezen.',
    seoTitle: 'IMDb voor boeken? Ontdek LumiScore',
    seoDescription: 'Beoordeel boeken van 1 tot 10, ontdek lezersscores en houd je leesreeksen bij. Maak kennis met LumiScore, een onafhankelijk platform voor lezers.',
    schemaType: 'WebPage', breadcrumbHome: 'Home',
    actions: [
      { text: 'Ontdek boeken', href: '/browse', variant: 'primary' },
      { text: 'Doe de smaaktest', href: '/taste-test', variant: 'secondary' },
    ],
    sections: [
      { heading: 'Een cijfer voor wat je hebt gelezen', paragraphs: [
        ['Zoek je bij IMDb vooral een cijfer en overzicht? Bij LumiScore vind je een vergelijkbare aanpak voor boeken, niet alle functies van IMDb.'],
        ['Log in, zoek een gelezen boek en geef een heel cijfer van 1 tot 10. Je kunt je beoordeling later aanpassen; een andere editie van hetzelfde boek levert geen tweede beoordeling op.'],
      ] },
      { heading: 'Lezersscore of persoonlijke match?', paragraphs: [
        ['De publieke LumiScore is het gemiddelde van de lezersbeoordelingen, afgerond op één decimaal. Die verschijnt vanaf drie verschillende beoordelaars. Bij minder beoordelingen zie je een streepje. Het aantal lezers wordt als bandbreedte getoond.'],
        ['Jouw persoonlijke match vergelijkt je leessmaak met onderbouwde kenmerken van een boek. Het is geen publieke kwaliteitsscore of kans dat je een boek leuk vindt. Bij weinig bewijs blijft een tip verkennend of ontbreekt een matchcijfer.'],
        ['LumiScore is een groeiend platform. Veel boeken hebben nog weinig beoordelingen; één nieuw cijfer kan een vroege score merkbaar veranderen.'],
      ] },
      { heading: 'Ontdek je volgende boek', paragraphs: [
        [{ type: 'link', text: 'Doorzoek de boekencatalogus', href: '/browse' }, ' op titel of auteur. Met de ', { type: 'link', text: 'smaaktest', href: '/taste-test' }, ' beoordeel je gelezen boeken en bouw je aan je leesprofiel. Je beoordelingen helpen bij persoonlijke boekentips, voor zover er voldoende onderbouwing is.'],
      ] },
      { heading: 'Houd je boeken en reeksen bij', paragraphs: [
        ['Bewaar in je account wat je wilt lezen, leest of hebt gelezen. Een beoordeeld boek telt ook als gelezen. In Mijn boeken vind je je eigen overzicht.'],
        [{ type: 'link', text: 'Bekijk boekenreeksen en collecties', href: '/collections' }, ' om je voortgang binnen de opgenomen delen te volgen. Waar de bekende reeksvolgorde dat ondersteunt, zie je welk deel hierna komt.'],
      ] },
    ],
    faq: { heading: 'Kort antwoord op je vragen', items: [
      { question: 'Is er een IMDb voor boeken?', answer: 'Zoek je cijfers en overzicht voor boeken, dan kun je bij LumiScore terecht. Het is een vergelijking van de aanpak, geen belofte van alle IMDb-functies.' },
      { question: 'Kan ik boeken een cijfer van 1 tot 10 geven?', answer: 'Ja. Na het inloggen geef je een gelezen boek een heel cijfer van 1 tot 10, op de boekpagina of in de smaaktest.' },
      { question: 'Heb ik een account nodig?', answer: 'Rondkijken kan zonder account. Voor boeken beoordelen en je leesvoortgang in een account bewaren log je in. Gastvoorkeuren zijn geen opgeslagen accountbeoordelingen.' },
      { question: 'Hoe krijg ik persoonlijke boekentips?', answer: 'Beoordeel boeken die je hebt gelezen. De smaaktest helpt je op weg; je leesprofiel en aanbevelingen gebruiken dezelfde smaakberekening. Bij weinig onderbouwing blijven tips verkennend.' },
    ] },
    disclaimer: 'LumiScore is een onafhankelijk platform en is niet verbonden aan IMDb.',
  },
  en: {
    key: 'imdbComparison', locale: 'en', path: IMDB_COMPARISON_PATHS.en, layout: 'compact',
    eyebrow: 'BOOK RATINGS',
    title: 'Looking for an IMDb for books?',
    lead: 'With LumiScore, you can rate books from 1 to 10, explore reader ratings and keep track of the books and series volumes you’ve read.',
    seoTitle: 'Looking for an IMDb for Books? Meet LumiScore',
    seoDescription: 'Rate books from 1 to 10, explore reader ratings and track your reading series. Meet LumiScore, an independent platform for readers.',
    schemaType: 'WebPage', breadcrumbHome: 'Home',
    actions: [
      { text: 'Browse books', href: '/browse', variant: 'primary' },
      { text: 'Take the taste test', href: '/taste-test', variant: 'secondary' },
    ],
    sections: [
      { heading: 'A number for the books you’ve read', paragraphs: [
        ['If you mainly use IMDb for a rating and an overview, LumiScore offers a similar approach for books—not every IMDb feature.'],
        ['Sign in, find a book you’ve read and give it a whole-number rating from 1 to 10. You can change your rating later; viewing another edition of the same book does not create a second rating.'],
      ] },
      { heading: 'Reader rating or personal match?', paragraphs: [
        ['The public LumiScore is the average of reader ratings, rounded to one decimal place. It appears after at least three different readers have rated a book. Below that threshold, you see a dash. Reader counts are shown in ranges.'],
        ['Your personal match compares your reading taste with supported traits of a book. It is not a public quality score or a probability that you will enjoy it. With little evidence, a recommendation stays exploratory or no match number is shown.'],
        ['LumiScore is a growing platform. Many books still have few ratings, so one new rating can noticeably change an early score.'],
      ] },
      { heading: 'Discover your next read', paragraphs: [
        [{ type: 'link', text: 'Browse the book catalog', href: '/browse' }, ' by title or author. In the ', { type: 'link', text: 'taste test', href: '/taste-test' }, ', rate books you’ve read to build your reading profile. Your ratings help inform personal recommendations where there is enough supporting evidence.'],
      ] },
      { heading: 'Keep track of books and series', paragraphs: [
        ['Use your account to track what you want to read, are reading or have read. Rated books also count as read. My books brings your own list together.'],
        [{ type: 'link', text: 'Explore book series and collections', href: '/collections' }, ' to follow your progress through the listed volumes. Where the known series order supports it, you can see which volume comes next.'],
      ] },
    ],
    faq: { heading: 'A few quick answers', items: [
      { question: 'Is there an IMDb for books?', answer: 'If you want ratings and an overview for books, try LumiScore. The comparison describes the approach, not a promise of every IMDb feature.' },
      { question: 'Can I rate books from 1 to 10?', answer: 'Yes. Sign in to give a book you’ve read a whole-number rating from 1 to 10, on its book page or in the taste test.' },
      { question: 'Do I need an account?', answer: 'You can browse without an account. Sign in to rate books and keep reading progress in your account. Guest preferences are not saved account ratings.' },
      { question: 'How do I get personal book recommendations?', answer: 'Rate books you’ve read. The taste test helps you get started; your reading profile and recommendations share the same taste calculation. With little supporting evidence, suggestions stay exploratory.' },
    ] },
    disclaimer: 'LumiScore is an independent platform and is not affiliated with IMDb.',
  },
};
