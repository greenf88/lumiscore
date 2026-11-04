import type { InformationPageContent } from './pages.ts';
import { IMDB_COMPARISON_PATHS } from '../i18n/paths.ts';

export const IMDB_COMPARISON_CONTENT: Record<'nl' | 'en', InformationPageContent> = {
  nl: {
    key: 'imdbComparison', locale: 'nl', path: IMDB_COMPARISON_PATHS.nl, layout: 'compact',
    eyebrow: 'BOEKEN BEOORDELEN',
    title: 'Een IMDb voor boeken? Ontdek LumiScore',
    lead: 'Zoek je voor boeken wat een filmscore je bij films biedt? Op LumiScore bekijk je boekinformatie en lezersscores, geef je gelezen boeken een eigen cijfer en ontdek je nieuwe leestips. Het is een vergelijking van het idee: LumiScore is een onafhankelijk boekenplatform.',
    seoTitle: 'IMDb voor boeken? Boeken ontdekken met LumiScore',
    seoDescription: 'Zoek je een IMDb voor boeken? Bekijk boekinformatie en lezersscores op LumiScore. Ontdek het verschil tussen jouw cijfer, de openbare score en een persoonlijke match.',
    image: '/images/information/imdb-voor-boeken-nl.png',
    schemaType: 'WebPage', breadcrumbHome: 'Home',
    actions: [
      { text: 'Ontdek boeken', href: '/browse', variant: 'primary' },
      { text: 'Start de smaaktest', href: '/taste-test', variant: 'secondary' },
    ],
    sections: [
      { heading: 'Wat kun je bekijken en beoordelen?', paragraphs: [
        ['Je kunt zonder account zoeken op titel of auteur, een boekpagina openen en beschikbare samenvattingen, editiegegevens en openbare scores bekijken. Collecties helpen je boeken van een auteur of uit een reeks te vinden.'],
        ['Na aanmelden geef je een gelezen boek een heel cijfer van 1 tot 10. Je kunt dat cijfer later wijzigen. Verschillende edities van hetzelfde boek leveren geen aparte beoordelingen in jouw account op.'],
        [{ type: 'link', text: 'Bekijk boeken en collecties', href: '/collections' }, ' of lees de praktische stappen bij ', { type: 'link', text: 'Zo werkt het', href: '/zo-werkt-het' }, '.'],
      ] },
      { heading: 'Wat vertelt de openbare LumiScore?', paragraphs: [
        ['De publieke LumiScore is het gemiddelde van de opgeslagen lezersbeoordelingen, afgerond op één decimaal. De score verschijnt vanaf drie verschillende beoordelaars. Het getoonde aantal beoordelaars is een bandbreedte, geen volledig lezersaantal.'],
        ['Een algemeen cijfer helpt je oriënteren, maar vertelt niet of het verhaal bij jou past. Kijk ook naar de samenvatting en wat je zelf graag leest.'],
      ] },
      { heading: 'Jouw eigen cijfer en jouw match zijn iets anders', paragraphs: [
        ['Jouw cijfer is je eigen oordeel nadat je een boek hebt gelezen. Een persoonlijke match vergelijkt je leessmaak met onderbouwde kenmerken van een boek dat je zou kunnen kiezen.'],
        ['Een boek dat anderen hoog waarderen hoeft dus niet jouw beste match te zijn. Bij weinig onderbouwing blijven tips verkennend of ontbreekt een matchcijfer. Het is geen garantie en geen kanspercentage.'],
        [{ type: 'link', text: 'Lees hoe de drie soorten cijfers verschillen', href: '/zo-werkt-het' }, '.'],
      ] },
      { heading: 'Wat als er geen openbaar cijfer staat?', paragraphs: [
        ['Een streepje met ‘Onvoldoende beoordelingen’ betekent dat er nog geen bruikbaar openbaar cijfer is, niet dat het boek slecht is of een nul krijgt. Een cijfer op basis van weinig beoordelingen kan nog merkbaar veranderen.'],
        ['Bij een tijdelijke storing vermeldt de pagina dat beoordelingen niet beschikbaar zijn. Dat is iets anders dan onvoldoende beoordelingen. Je kunt beschikbare boekinformatie wel gebruiken om zelf een keuze te maken.'],
      ] },
      { heading: 'Hoe kies je van hieruit een volgend boek?', paragraphs: [
        ['Begin bij een boek dat je kent, verken een collectie of kies een redactionele leesroute. Zoek je bijvoorbeeld een eerste fantasyboek, dan helpt een inhoudelijke keuzehulp je verder dan alleen het hoogste cijfer.'],
        [{ type: 'link', text: 'Bekijk de redactionele leesroutes', href: '/toplijsten' }, ', ', { type: 'link', text: 'ontdek boeken', href: '/browse' }, ' of ', { type: 'link', text: 'start de smaaktest', href: '/taste-test' }, '. Daar beoordeel je gelezen boeken; onbekende boeken mag je overslaan. Voor het bewaren van boekbeoordelingen meld je je aan.'],
      ] },
    ],
    faq: { heading: 'Kort antwoord op je vragen', items: [
      { question: 'Bestaat er een IMDb voor boeken?', answer: 'LumiScore biedt boekinformatie, lezersscores en je eigen boekbeoordelingen. De vergelijking gaat over cijfers en ontdekken; het is geen officiële IMDb-dienst en geen kopie van alle IMDb-functies.' },
      { question: 'Moet ik me aanmelden om rond te kijken?', answer: 'Nee. Boekinformatie, collecties en uitleg zijn openbaar. Voor het bewaren en wijzigen van jouw beoordelingen en accountvoortgang meld je je aan.' },
      { question: 'Is een hoge LumiScore ook een hoge persoonlijke match?', answer: 'Niet automatisch. De openbare score vat lezersoordelen samen. Een persoonlijke match gebruikt je leessmaak en onderbouwde boekkenmerken.' },
      { question: 'Moet ik ieder boek in de smaaktest kennen?', answer: 'Nee. Beoordeel alleen gelezen boeken. Niet gelezen of onbekend? Sla over; dat telt niet als opgeslagen boekbeoordeling.' },
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
