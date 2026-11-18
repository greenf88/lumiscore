import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import type { Book } from '../../app/data/books.ts';
import { getBookMetadataDescription } from './book-detail.ts';
import { getInitialPublicBookDescription, loadPublicBookDescriptionState } from './public-description.ts';
import { resolveBookDescription } from './description-resolution.ts';
import { publicDescriptionSource } from './description-source.ts';
import { descriptionBinding, isDescriptionSnapshotWithdrawn, type DescriptionSnapshot } from './description-snapshot.ts';
import { getReviewedCoverOverride } from './reviewed-cover-overrides.ts';

// Frozen round23 public identities; Dragon Ball title corrected against exact publisher ISBN.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "6081",
    "editionId": "6240",
    "locale": "nl",
    "title": "Het verleden spreekt",
    "author": "Dennis Lehane",
    "isbn": "9789044328004",
    "isbn10": "904432800X",
    "openLibraryWorkId": "OL15587800W",
    "openLibraryEditionId": "OL35336503M",
    "sourceKey": "9789044328004",
    "source": "official_publisher",
    "href": "https://dennislehane.com/books/moonlight/",
    "marker": "Amanda McCready",
    "start": "Amanda McCready is"
  },
  {
    "id": "3190",
    "editionId": "3349",
    "locale": "nl",
    "title": "Kikkermuziek",
    "author": "Emma Donoghue",
    "isbn": "9789025444020",
    "isbn10": "9025444024",
    "openLibraryWorkId": "OL17670692W",
    "openLibraryEditionId": "OL32818328M",
    "sourceKey": "9789025444020",
    "source": "official_publisher",
    "href": "https://www.emmadonoghue.com/books/novels/frog-music.html",
    "marker": "Blanche Beunon",
    "start": "San Francisco, 1876:"
  },
  {
    "id": "5364",
    "editionId": "5523",
    "locale": "nl",
    "title": "Een gouden kind",
    "author": "Jean-Paul Franssens",
    "isbn": "9789067661591",
    "isbn10": "9067661597",
    "openLibraryWorkId": "OL817068W",
    "openLibraryEditionId": "OL35327094M",
    "sourceKey": "9789067661591",
    "source": "official_catalog",
    "href": "https://www.dbnl.org/tekst/_eer001199101_01/_eer001199101_01_0004.php",
    "marker": "hersentumor",
    "start": "Bij de begrafenis"
  },
  {
    "id": "5009",
    "editionId": "5168",
    "locale": "nl",
    "title": "Het risico",
    "author": "Patricia Cornwell",
    "isbn": "9789024555581",
    "isbn10": "9024555582",
    "openLibraryWorkId": "OL134369W",
    "openLibraryEditionId": "OL37738261M",
    "sourceKey": "9789024555581",
    "source": "official_publisher",
    "href": "https://www.lsuitgeverij.nl/boek/het-risico/",
    "marker": "Winston Garano",
    "start": "Rechercheur Winston Garano"
  },
  {
    "id": "5004",
    "editionId": "5163",
    "locale": "nl",
    "title": "In de wouden van de nacht",
    "author": "Amelia Atwater-Rhodes",
    "isbn": "9789050162739",
    "isbn10": "9050162738",
    "openLibraryWorkId": "OL100079W",
    "openLibraryEditionId": "OL33003266M",
    "sourceKey": "9789050162739",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/6078/in-the-forests-of-the-night-by-amelia-atwater-rhodes/",
    "marker": "Risika",
    "start": "Risika leeft al"
  },
  {
    "id": "6039",
    "editionId": "6198",
    "locale": "nl",
    "title": "Verborgen lichamen",
    "author": "Christopher Brookmyre",
    "isbn": "9789047520603",
    "isbn10": "9047520602",
    "openLibraryWorkId": "OL17456733W",
    "openLibraryEditionId": "OL32418918M",
    "sourceKey": "9789047520603",
    "source": "official_publisher",
    "href": "https://groveatlantic.com/book/where-the-bodies-are-buried/",
    "marker": "Catherine McLeod",
    "start": "In Glasgow onderzoekt"
  },
  {
    "id": "5050",
    "editionId": "5209",
    "locale": "nl",
    "title": "Nora, het maandagelfje",
    "author": "Daisy Meadows",
    "isbn": "9789044724707",
    "isbn10": "9044724703",
    "openLibraryWorkId": "OL5886959W",
    "openLibraryEditionId": "OL39199038M",
    "sourceKey": "9789044724707",
    "source": "official_catalog",
    "href": "https://rozet.nl/catalogus/761463/",
    "marker": "Sanne en Eva",
    "start": "Koning Winter heeft"
  },
  {
    "id": "6461",
    "editionId": "6620",
    "locale": "nl",
    "title": "Snoepreis",
    "author": "Victor Meijer",
    "isbn": "9789029089210",
    "isbn10": "9029089210",
    "openLibraryWorkId": "OL23127158W",
    "openLibraryEditionId": "OL30967916M",
    "sourceKey": "9789029089210",
    "source": "official_catalog",
    "href": "https://rozet.nl/catalogus/1442325/",
    "marker": "Boris",
    "start": "De tienjarige Boris"
  },
  {
    "id": "6186",
    "editionId": "6345",
    "locale": "nl",
    "title": "Rich boy",
    "author": "Sharon Pomerantz",
    "isbn": "9789044616125",
    "isbn10": "9044616129",
    "openLibraryWorkId": "OL15408835W",
    "openLibraryEditionId": "OL35616115M",
    "sourceKey": "9789044616125",
    "source": "official_publisher",
    "href": "https://www.hachettebookgroup.com/titles/sharon-pomerantz/rich-boy/9780446571982/",
    "marker": "Robert Vishniak",
    "start": "Robert Vishniak groeit"
  },
  {
    "id": "6354",
    "editionId": "6513",
    "locale": "nl",
    "title": "De toverkast",
    "author": "Rafik Schami",
    "isbn": "9789026104824",
    "isbn10": "9026104820",
    "openLibraryWorkId": "OL8938431W",
    "openLibraryEditionId": "OL46535367M",
    "sourceKey": "9789026104824",
    "source": "official_catalog",
    "href": "https://www.lesen.bayern.de/9783981744323/",
    "marker": "Sami en Leila",
    "start": "Een oude verhalenverteller"
  },
  {
    "id": "1961",
    "editionId": "2149",
    "locale": "en",
    "title": "Pinocchio",
    "author": "Carlo Collodi",
    "isbn": "9780517618158",
    "isbn10": "051761815X",
    "openLibraryWorkId": "OL1527356W",
    "openLibraryEditionId": "OL2386771M",
    "sourceKey": "9780517618158",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/292299/pinocchio-by-carlo-collodi-original-translation-by-m-a-murray-revised-by-g-tassinari-introduction-by-jack-zipes-illustrated-by-charles-folkard/9780142437063/",
    "marker": "Geppetto",
    "start": "Geppetto carves a"
  },
  {
    "id": "9826",
    "editionId": "9985",
    "locale": "en",
    "title": "Sneezy the Snowman",
    "author": "Maureen Wright",
    "isbn": "9781477810545",
    "isbn10": "1477810544",
    "openLibraryWorkId": "OL20339612W",
    "openLibraryEditionId": "OL27548683M",
    "sourceKey": "9781477810545",
    "source": "official_publisher",
    "href": "https://clubs.scholastic.com/sneezy-the-snowman/9780545328265-rco-us.html",
    "marker": "Hot chocolate",
    "start": "Sneezy is a"
  },
  {
    "id": "9382",
    "editionId": "9541",
    "locale": "en",
    "title": "The miscalculations of Lightning Girl",
    "author": "Stacy McAnulty",
    "isbn": "9781524767570",
    "isbn10": null,
    "openLibraryWorkId": "OL19739397W",
    "openLibraryEditionId": "OL26952475M",
    "sourceKey": "9781524767570",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/557145/the-miscalculations-of-lightning-girl-by-stacy-mcanulty/",
    "marker": "Lucy Callahan",
    "start": "After a lightning"
  },
  {
    "id": "3561",
    "editionId": "3720",
    "locale": "nl",
    "title": "De vloek",
    "author": "Suzanne Collins",
    "isbn": "9789020664935",
    "isbn10": "902066493X",
    "openLibraryWorkId": "OL5735361W",
    "openLibraryEditionId": "OL32713072M",
    "sourceKey": "9789020664935",
    "source": "official_publisher",
    "href": "https://www.scholastic.com/content/dam/teachers/lesson-plans/migrated-featured-files/underland-chronicles-dg.pdf",
    "marker": "Boots",
    "start": "Een dodelijke plaag"
  },
  {
    "id": "5999",
    "editionId": "6158",
    "locale": "nl",
    "title": "Terugslag",
    "author": "Andy McNab",
    "isbn": "9789044319729",
    "isbn10": "9044319728",
    "openLibraryWorkId": "OL8140204W",
    "openLibraryEditionId": "OL35330147M",
    "sourceKey": "9789044319729",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/389043/recoil-by-mcnab-andy/9780552163613",
    "marker": "Nick Stone",
    "start": "Nick Stone probeert"
  },
  {
    "id": "3356",
    "editionId": "3515",
    "locale": "nl",
    "title": "Wieg van mijn vijand",
    "author": "Sara Pennypacker",
    "isbn": "9789063053376",
    "isbn10": "9063053371",
    "openLibraryWorkId": "OL9324709W",
    "openLibraryEditionId": "OL32859964M",
    "sourceKey": "9789063053376",
    "source": "official_catalog",
    "href": "https://books.google.com/books?id=tcrzp4qGOdEC",
    "marker": "Cyrla",
    "start": "Cyrla is half-Joods"
  },
  {
    "id": "5833",
    "editionId": "5992",
    "locale": "nl",
    "title": "Dicht bij huis",
    "author": "Linwood Barclay",
    "isbn": "9789022551813",
    "isbn10": "9022551814",
    "openLibraryWorkId": "OL771886W",
    "openLibraryEditionId": "OL33335082M",
    "sourceKey": "9789022551813",
    "source": "official_publisher",
    "href": "https://www.linwoodbarclay.com/thrillers/too-close-to-home/",
    "marker": "Promise Falls",
    "start": "In Promise Falls"
  },
  {
    "id": "6611",
    "editionId": "6770",
    "locale": "en",
    "title": "Stormbringers",
    "author": "Philippa Gregory",
    "isbn": "9780857077363",
    "isbn10": "0857077368",
    "openLibraryWorkId": "OL17627863W",
    "openLibraryEditionId": "OL28302997M",
    "sourceKey": "9780857077363",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Stormbringers/Philippa-Gregory/Order-of-Darkness/9781442476882",
    "marker": "Johann",
    "start": "In 1453, Luca"
  },
  {
    "id": "4896",
    "editionId": "5055",
    "locale": "en",
    "title": "Michael Jordan",
    "author": "Roland Lazenby",
    "isbn": "9780316194778",
    "isbn10": "0316194778",
    "openLibraryWorkId": "OL19976674W",
    "openLibraryEditionId": "OL27156838M",
    "sourceKey": "9780316194778",
    "source": "official_publisher",
    "href": "https://www.hachettebookgroup.com/titles/roland-lazenby/michael-jordan/9780316228763/",
    "marker": "North Carolina",
    "start": "Roland Lazenby traces"
  },
  {
    "id": "8669",
    "editionId": "8828",
    "locale": "en",
    "title": "The Cloud Castle",
    "author": "Elisabetta Dami",
    "isbn": "9780545835367",
    "isbn10": null,
    "openLibraryWorkId": "OL17314300W",
    "openLibraryEditionId": "OL25888916M",
    "sourceKey": "9780545835367",
    "source": "official_publisher",
    "href": "https://www.scholastic.ca/our-books/book/thea-stilton-se-the-cloud-castle-9780545835367",
    "marker": "Will Mystery",
    "start": "An urgent message"
  },
  {
    "id": "6074",
    "editionId": "6233",
    "locale": "nl",
    "title": "De neushoorn van de paus",
    "author": "Lawrence Norfolk",
    "isbn": "9789041401441",
    "isbn10": "904140144X",
    "openLibraryWorkId": "OL2566594W",
    "openLibraryEditionId": "OL37737458M",
    "sourceKey": "9789041401441",
    "source": "official_publisher",
    "href": "https://groveatlantic.com/book/the-popes-rhinoceros/",
    "marker": "paus Leo X",
    "start": "In het Europa"
  },
  {
    "id": "726",
    "editionId": "726",
    "locale": "en",
    "title": "Black rose",
    "author": "Nora Roberts",
    "isbn": "9780739454626",
    "isbn10": "0739454625",
    "openLibraryWorkId": "OL111418W",
    "openLibraryEditionId": "OL25545809M",
    "sourceKey": "9780739454626",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/293914/black-rose-by-nora-roberts/",
    "marker": "Mitchell Carnegie",
    "start": "Rosalind Harper has"
  },
  {
    "id": "8357",
    "editionId": "8516",
    "locale": "en",
    "title": "Fire star",
    "author": "Chris D'Lacey",
    "isbn": "9781408354636",
    "isbn10": "1408354632",
    "openLibraryWorkId": "OL5735053W",
    "openLibraryEditionId": "OL39222768M",
    "sourceKey": "9781408354636",
    "source": "official_publisher",
    "href": "https://www.hachettechildrens.co.uk/titles/chris-dlacey/the-last-dragon-chronicles-fire-star/9781843625223/",
    "marker": "Gwilanna",
    "start": "David Rain travels"
  },
  {
    "id": "3403",
    "editionId": "3562",
    "locale": "nl",
    "title": "De glimlach van Lisa",
    "author": "Elisabetta Dami",
    "isbn": "9789085920106",
    "isbn10": "9085920108",
    "openLibraryWorkId": "OL8115877W",
    "openLibraryEditionId": "OL35333981M",
    "sourceKey": "9789085920106",
    "source": "official_catalog",
    "href": "https://metadata.isbn.nl/1529018/de-glimlach-van-lisa.html",
    "marker": "Muis Lisa",
    "start": "Klem hoort dat"
  },
  {
    "id": "4408",
    "editionId": "4567",
    "locale": "en",
    "title": "Dragon Ball Z, Vol. 17: The Cell Game",
    "author": "鳥山 明 [Akira Toriyama]",
    "isbn": "9781591165057",
    "isbn10": "1591165059",
    "openLibraryWorkId": "OL5753059W",
    "openLibraryEditionId": "OL23028075M",
    "sourceKey": "9781591165057",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Dragon-Ball-Z-Vol-17/Akira-Toriyama/Dragon-Ball-Z/9781591165057",
    "marker": "Trunks",
    "start": "Cell has reached"
  },
  {
    "id": "8704",
    "editionId": "8863",
    "locale": "en",
    "title": "Frightful's mountain",
    "author": "Jean Craighead George",
    "isbn": "9780439329156",
    "isbn10": "0439329159",
    "openLibraryWorkId": "OL111827W",
    "openLibraryEditionId": "OL24390323M",
    "sourceKey": "9780439329156",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/331601/frightfuls-mountain-by-jean-craighead-george/",
    "marker": "Sam Gribley",
    "start": "Sam Gribley must"
  },
  {
    "id": "7336",
    "editionId": "7495",
    "locale": "en",
    "title": "Rebalancing Society",
    "author": "Henry Mintzberg",
    "isbn": "9781626563179",
    "isbn10": null,
    "openLibraryWorkId": "OL21090936W",
    "openLibraryEditionId": "OL28548971M",
    "sourceKey": "9781626563179",
    "source": "official_publisher",
    "href": "https://bkconnection.com/products/9781626563179_rebalancing-society",
    "marker": "voluntary associations",
    "start": "Henry Mintzberg argues"
  },
  {
    "id": "9682",
    "editionId": "9841",
    "locale": "en",
    "title": "Spinning silver",
    "author": "Naomi Novik",
    "isbn": "9780399180989",
    "isbn10": "0399180982",
    "openLibraryWorkId": "OL19145737W",
    "openLibraryEditionId": "OL26959526M",
    "sourceKey": "9780399180989",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/554775/spinning-silver-by-naomi-novik/9780399180989/",
    "marker": "Miryem",
    "start": "Miryem begins collecting"
  },
  {
    "id": "8771",
    "editionId": "8930",
    "locale": "en",
    "title": "The Sellout",
    "author": "Paul Beatty",
    "isbn": "9780374260507",
    "isbn10": null,
    "openLibraryWorkId": "OL17616758W",
    "openLibraryEditionId": "OL26221178M",
    "sourceKey": "9780374260507",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781250808240/thesellout/",
    "marker": "Dickens",
    "start": "After the death"
  },
  {
    "id": "3802",
    "editionId": "3961",
    "locale": "en",
    "title": "Mindf*ck",
    "author": "Christopher Wylie",
    "isbn": "9780593229149",
    "isbn10": null,
    "openLibraryWorkId": "OL20385508W",
    "openLibraryEditionId": "OL29851304M",
    "sourceKey": "9780593229149",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/604375/mindfck-by-christopher-wylie/",
    "marker": "Cambridge Analytica",
    "start": "Christopher Wylie recounts"
  },
  {
    "id": "4251",
    "editionId": "4410",
    "locale": "en",
    "title": "Naruto vol 33",
    "author": "Masashi Kishimoto",
    "isbn": "9781421520018",
    "isbn10": "142152001X",
    "openLibraryWorkId": "OL13268171W",
    "openLibraryEditionId": "OL23103190M",
    "sourceKey": "9781421520018",
    "source": "official_publisher",
    "href": "https://www.viz.com/manga-books/manga/naruto-volume-33/product/1529",
    "marker": "Orochimaru",
    "start": "Naruto’s encounter with"
  },
  {
    "id": "8423",
    "editionId": "8582",
    "locale": "en",
    "title": "Beartown",
    "author": "Fredrik Backman",
    "isbn": "9781501160776",
    "isbn10": null,
    "openLibraryWorkId": "OL20654696W",
    "openLibraryEditionId": "OL29765959M",
    "sourceKey": "9781501160776",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Beartown/Fredrik-Backman/Beartown-Series/9781501160776",
    "marker": "hockey",
    "start": "A struggling forest"
  },
  {
    "id": "3648",
    "editionId": "3807",
    "locale": "en",
    "title": "The New Jim Crow",
    "author": "Michelle Alexander",
    "isbn": "9781595586438",
    "isbn10": null,
    "openLibraryWorkId": "OL13826369W",
    "openLibraryEditionId": "OL56976450M",
    "sourceKey": "9781595586438",
    "source": "official_publisher",
    "href": "https://thenewpress.org/books/the-new-jim-crow/",
    "marker": "mass incarceration",
    "start": "Michelle Alexander argues"
  }
] as const;

function selectedBook(edition: typeof editions[number]): Book {
  return {
    id: 'work-' + edition.id, source: 'supabase', workId: edition.id, title: edition.title,
    editionTitle: edition.title, author: edition.author, isbn13: edition.isbn, editionAvailable: true,
    isbn10: edition.isbn10,
    editionLanguage: ({ nl: 'nld', en: 'eng' } as const)[edition.locale], strictEditionLanguage: edition.locale,
    // Recorded public identities; all provider and storage access is replaced by test doubles.
    editionId: edition.editionId, authorId: '70002', openLibraryWorkId: edition.openLibraryWorkId, openLibraryEditionId: edition.openLibraryEditionId,
    score: null, ratingsCount: null, match: null, cover: 'orbit',
  };
}

test('the corrected Dragon Ball volume retains its exact English publisher jacket', () => {
  const edition = editions.find(e => e.id === '4408')!;
  const input = { ...selectedBook(edition), title: edition.title };
  const cover = getReviewedCoverOverride(input);
  assert.ok(cover);
  assert.equal(cover.coverUrl, 'https://d28hgpri8am2if.cloudfront.net/book_images/onix/cvr9781591165057/dragon-ball-z-vol-17-9781591165057_hr.jpg');
  for (const mismatch of [{ isbn13: '9781421520018' }, { editionLanguage: 'nld' },
    { openLibraryEditionId: 'OL23103190M' }, { title: 'Dragon Ball Z, Vol. 18' },
    { author: 'Masashi Kishimoto' }]) {
    assert.equal(getReviewedCoverOverride({ ...input, ...mismatch }), null);
  }
});

function withdrawnSnapshot(book: Book, locale: 'nl' | 'en'): DescriptionSnapshot {
  return {
    work_id: book.workId!, edition_id: book.editionId!, locale, binding_hash: descriptionBinding(book, locale)!,
    bound_author_id: book.authorId!, bound_title: book.editionTitle!, bound_language: book.editionLanguage!,
    bound_isbn13: book.isbn13!, bound_open_library_work_id: book.openLibraryWorkId!,
    text: null, source_key: book.openLibraryEditionId!, provider_status: 'withdrawn',
    fetched_at: '2026-11-12T12:00:00.000Z', checked_at: '2026-11-13T12:00:00.000Z',
    validation: 'identity_and_language_verified',
  };
}

for (const edition of editions) {
  const book = selectedBook(edition);
  const { locale } = edition;

  test(`recovery23 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
    const initial = getInitialPublicBookDescription(book, locale);
    assert.ok(initial);
    assert.match(initial.text, new RegExp(edition.marker));
    assert.equal(initial.language, locale);
    assert.equal(initial.sourceKey, edition.sourceKey);
    assert.equal(initial.source, edition.source);
    assert.equal(publicDescriptionSource(initial)?.href, edition.href);
    const metadata = getBookMetadataDescription(book, locale, initial);
    assert.match(metadata, new RegExp('^' + edition.start));
    assert.ok(Array.from(metadata).length <= 160);
    assert.notEqual(metadata, getBookMetadataDescription(book, locale));
    const withoutEllipsis = metadata.endsWith('…') ? metadata.slice(0, -1) : metadata;
    assert.ok(initial.text.startsWith(withoutEllipsis));

    let providerCalls = 0;
    const unreachable: typeof fetch = async () => { providerCalls++; throw Error('No external request allowed'); };
    assert.deepEqual(await resolveBookDescription({ ...book, locale }, unreachable), { state: 'resolved', description: initial });
    const withdrawn = withdrawnSnapshot(book, locale);
    assert.equal(isDescriptionSnapshotWithdrawn(withdrawn, book, locale), true);
    let reads = 0, writes = 0;
    for (const outage of [false, true]) {
      const store = {
        loadDescriptionSnapshot: async () => { reads++; if (outage) throw Error('Snapshot unavailable'); return withdrawn; },
        saveDescriptionSnapshot: async () => { writes++; },
        markDescriptionSnapshotFailure: async () => { writes++; },
      };
      assert.deepEqual(await loadPublicBookDescriptionState(book, locale, unreachable, store), { state: 'resolved', description: initial });
    }
    assert.equal(reads, 0, 'independent original text does not read withdrawn-source status');
    assert.equal(writes, 0);
    assert.equal(providerCalls, 0);
  });

  test(`recovery23 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
    const otherLocale = locale === 'en' ? 'nl' : 'en';
    for (const mismatch of [
      { isbn13: '9780141439518' }, { isbn13: null, isbn10: null },
      { editionTitle: 'A different book' }, { editionTitle: null },
      { author: 'A different author' }, { author: '' },
      { editionLanguage: otherLocale === 'en' ? 'eng' : 'nld' }, { editionLanguage: null },
      { editionAvailable: false },
    ]) {
      const other = { ...book, ...mismatch };
      const initial = getInitialPublicBookDescription(other, locale);
      assert.equal(initial, null, JSON.stringify(mismatch));
      assert.equal(getBookMetadataDescription(other, locale, initial), getBookMetadataDescription(other, locale));
    }
    assert.equal(getInitialPublicBookDescription(book, otherLocale), null);

    // The new fallback must not accidentally revive the withdrawn OL source
    // when its own exact identity no longer matches.
    const other = { ...book, isbn13: '9780141439518' };
    let reads = 0, providerCalls = 0;
    const store = {
      loadDescriptionSnapshot: async () => { reads++; return withdrawnSnapshot(other, locale); },
      saveDescriptionSnapshot: async () => { throw Error('No source writes allowed'); },
      markDescriptionSnapshotFailure: async () => { throw Error('No source writes allowed'); },
    };
    const unreachable: typeof fetch = async () => { providerCalls++; throw Error('Withdrawn source must not be fetched'); };
    assert.deepEqual(await loadPublicBookDescriptionState(other, locale, unreachable, store), { state: 'confirmed_missing', description: null });
    assert.equal(reads, 1);
    assert.equal(providerCalls, 0);
  });
}


test('all thirty-three reviewed summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery23-tests', plugins: [react()],
    css: { postcss: { plugins: [] } }, resolve: { alias: { '@': root }, dedupe: ['react', 'react-dom'] },
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  try {
    const { LumiScoreBookDescription: Description } = await vite.ssrLoadModule('/app/components/LumiScoreBookDescription.tsx');
    const { LumiScoreLocaleProvider: Provider } = await vite.ssrLoadModule('/app/components/LumiScoreLocale.tsx');
    for (const edition of editions) {
      const description = getInitialPublicBookDescription(selectedBook(edition), edition.locale);
      const html = renderToStaticMarkup(createElement(Provider, { initialLocale: edition.locale, hasPersistedChoice: true, initialPath: '/book/' + edition.id },
        createElement(Description, { description })));
      assert.match(html, new RegExp(edition.marker), edition.id);
      assert.ok(description);
      const renderedParagraphs = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(match => match[1]);
      const expectedText = renderToStaticMarkup(createElement('span', null, description.text)).replace(/^<span>|<\/span>$/g, '');
      assert.equal(renderedParagraphs.join(' ').replace(/\s+/g, ' ').trim(), expectedText.replace(/\s+/g, ' ').trim(), `${edition.id}: paragraph formatting preserves the complete text and punctuation`);
      assert.ok(html.includes('href="' + edition.href + '"'), edition.id);
      assert.match(html, /class="description-source"/);
      assert.doesNotMatch(html, /Loading the description|De beschrijving wordt geladen|could not load|kon tijdelijk niet|not available yet|geen geverifieerde|<[^>]+\shidden(?:\s|=|>)/);
    }
  } finally { await vite.close(); }
});

