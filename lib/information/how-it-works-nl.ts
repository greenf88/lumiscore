import type { InformationPageContent } from './pages.ts';

export const HOW_IT_WORKS_NL: InformationPageContent = {
  key: 'howItWorks', locale: 'nl', path: '/zo-werkt-het',
  eyebrow: 'ZO WERKT HET',
  title: 'Zo werkt LumiScore: boeken beoordelen en ontdekken',
  lead: 'Begin bij een boek dat je kent. Geef je eigen oordeel, houd bij wat je leest en ontdek nieuwe boeken. Je kunt eerst rustig rondkijken; voor het bewaren van boekbeoordelingen meld je je aan.',
  seoTitle: 'Zo werkt LumiScore: boeken beoordelen en ontdekken',
  seoDescription: 'Zoek een gelezen boek, geef je eigen cijfer en ontdek nieuwe leestips. Lees het verschil tussen de openbare LumiScore, jouw beoordeling en een persoonlijke match.',
  image: '/images/information/zo-werkt-het-nl.png',
  schemaType: 'WebPage', breadcrumbHome: 'Home',
  actions: [
    { text: 'Zoek een bekend boek', href: '/search', variant: 'primary' },
    { text: 'Start de smaaktest', href: '/taste-test', variant: 'secondary' },
  ],
  sections: [
    { heading: '1. Zoek een boek dat je hebt gelezen', paragraphs: [
      ['Zoek op titel of auteur en open de boekpagina. Zonder account kun je boekinformatie, beschikbare samenvattingen en openbare scores bekijken. Kijk ook naar de getoonde editie en taal.'],
      [{ type: 'link', text: 'Zoek een boek', href: '/search' }, ' of verken ', { type: 'link', text: 'boeken en collecties', href: '/collections' }, '.'],
    ] },
    { heading: '2. Meld je aan en geef jouw cijfer', paragraphs: [
      ['Log in of maak een account aan om een gelezen boek een heel cijfer van 1 tot 10 te geven. Pas na succesvolle opslag is het een bewaarde beoordeling. Je kunt jouw cijfer later op de boekpagina wijzigen.'],
      ['Je hebt één beoordeling per boek in je account, ook als je een andere editie bekijkt. Je eigen cijfer is jouw oordeel, niet de openbare LumiScore en ook geen persoonlijke match.'],
    ] },
    { heading: '3. Ontdek je smaak: niet gelezen mag je overslaan', paragraphs: [
      ['In de smaaktest geef je cijfers aan boeken die je hebt gelezen. Een onbekend of niet gelezen boek sla je over. Overgeslagen boeken tellen niet mee voor het aantal beoordelingen dat nodig is voor je resultaat.'],
      ['Zonder account kun je een gasttest doen. Na tien beoordeelde boeken zie je een eerste beeld van je leessmaak. Deze keuzes en het resultaat blijven alleen in de geopende pagina; ze worden niet als boekbeoordelingen opgeslagen en verdwijnen bij vernieuwen of verlaten van de pagina.'],
      ['Met een account worden je beoordelingen opgeslagen. Je kiest de lengte van een ronde en kunt pauzeren en later verdergaan. Na het gekozen aantal opgeslagen beoordelingen opent je resultaat. Het volgende boek verschijnt na een geslaagde actie; bij een opslagfout kun je opnieuw proberen.'],
      [{ type: 'link', text: 'Start de smaaktest', href: '/taste-test' }, ' of ', { type: 'link', text: 'probeer de gasttest', href: '/taste-test/preferences' }, '.'],
    ] },
    { heading: 'Openbare score, jouw cijfer en persoonlijke match', paragraphs: [
      ['De openbare LumiScore vat opgeslagen lezersbeoordelingen samen: het gemiddelde, afgerond op één decimaal, vanaf drie verschillende beoordelaars. Jouw eigen cijfer is je persoonlijke oordeel over dat boek.'],
      ['Een persoonlijke match vergelijkt je leessmaak met onderbouwde kenmerken van een boek. Een hoge openbare score hoeft daarom niet jouw beste match te zijn. Bij beperkte onderbouwing blijven tips verkennend of ontbreekt een matchcijfer; een match is geen garantie of kanspercentage.'],
      ['Staat er een streepje met ‘Onvoldoende beoordelingen’, dan is er nog geen bruikbaar openbaar cijfer. Dat is geen nul of negatief oordeel. Bij een tijdelijke laadfout meldt de pagina dat de beoordelingen niet beschikbaar zijn. Boekinformatie en je eigen oordeel blijven verschillende onderdelen.'],
    ] },
    { heading: 'Bewaar je boeken en kies een volgende', paragraphs: [
      ['Met een account houd je bij wat je wilt lezen, leest, hebt gelezen of niet hebt uitgelezen. Een beoordeeld boek telt ook als gelezen. In Mijn boeken staan je eigen boeken en beoordelingen.'],
      ['Gebruik je resultaat en persoonlijke leestips als vertrekpunt, of kies zelf via een collectie of redactionele leesroute. Reeksvoortgang gaat over de opgenomen delen; een volgende-leessuggestie hangt af van de bekende reeksvolgorde.'],
      [{ type: 'link', text: 'Bekijk collecties', href: '/collections' }, ' of ', { type: 'link', text: 'ontdek de redactionele leesroutes', href: '/toplijsten' }, '. Wil je eerst het idee achter boekcijfers begrijpen? Lees ', { type: 'link', text: 'IMDb voor boeken?', href: '/imdb-for-books' }, '.'],
    ] },
    { heading: 'Jouw keuze over productanalyse', paragraphs: [
      ['Optionele productanalyse staat standaard uit. Je kunt die via Analysevoorkeuren onderaan de pagina accepteren, weigeren of intrekken. Je kunt ook zonder analysetoestemming aanmelden, beoordelingen bewaren en je leesvoortgang gebruiken.'],
      ['Bij intrekken stopt nieuwe optionele registratie; eerder opgeslagen meetgegevens verdwijnen niet meteen uit bestaande totalen. Daarvoor geldt de vastgelegde bewaartermijn. Je boekbeoordelingen en noodzakelijke accountopslag staan los van deze analysekeuze.'],
    ] },
  ],
};
