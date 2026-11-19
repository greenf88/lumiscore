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

// Frozen round34 public identities; existing stored descriptions remain authoritative.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "3203",
    "editionId": "3362",
    "locale": "nl",
    "title": "Wat ik was",
    "author": "Meg Rosoff",
    "isbn": "9789048800230",
    "isbn10": "9048800234",
    "openLibraryWorkId": "OL5707253W",
    "openLibraryEditionId": "OL32419509M",
    "sourceKey": "9789048800230",
    "source": "official_publisher",
    "href": "https://www.megrosoff.co.uk/what-i-was",
    "marker": "Een oude man herinnert zich de jongen die hij op zestienjarige leeftijd ontmoette aan de Engelse kust",
    "start": "Een oude man"
  },
  {
    "id": "6508",
    "editionId": "6667",
    "locale": "nl",
    "title": "Het grote zwijgen",
    "author": "Erik Menkveld",
    "isbn": "9789028241589",
    "isbn10": null,
    "openLibraryWorkId": "OL16454700W",
    "openLibraryEditionId": "OL25165871M",
    "sourceKey": "9789028241589",
    "source": "official_publisher",
    "href": "https://www.vanoorschot.nl/category/erik-menkveld/",
    "marker": "In het Amsterdam van 1910 raakt de jonge muziekrecensent en componist Matthijs Vermeulen bevriend met Alphons Diepenbrock",
    "start": "In het Amsterdam"
  },
  {
    "id": "6532",
    "editionId": "6691",
    "locale": "nl",
    "title": "Poolse tranen",
    "author": "Miriam Guensberg",
    "isbn": "9789491567414",
    "isbn10": "9491567411",
    "openLibraryWorkId": "OL40362424W",
    "openLibraryEditionId": "OL54898760M",
    "sourceKey": "9789491567414",
    "source": "official_publisher",
    "href": "https://www.uitgeverijdekring.nl/poolse-tranen",
    "marker": "Tanek groeit op in Polen en wordt tijdens de Tweede Wereldoorlog arts bij de Eerste Poolse Pantserdivisie",
    "start": "Tanek groeit op"
  },
  {
    "id": "6252",
    "editionId": "6411",
    "locale": "nl",
    "title": "De regels van het spel",
    "author": "Heather Lewis",
    "isbn": "9789041400420",
    "isbn10": "9041400427",
    "openLibraryWorkId": "OL26179237W",
    "openLibraryEditionId": "OL35328814M",
    "sourceKey": "9789041400420",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL35328814M",
    "marker": "De vijftienjarige Lee moet haar kostschool verlaten en belandt in de wereld van de springruiterij",
    "start": "De vijftienjarige Lee"
  },
  {
    "id": "2942",
    "editionId": "3101",
    "locale": "en",
    "title": "Unraveled",
    "author": "Gennifer Albin",
    "isbn": "9780374316433",
    "isbn10": "0374316430",
    "openLibraryWorkId": "OL19989444W",
    "openLibraryEditionId": "OL27169559M",
    "sourceKey": "9780374316433",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Unraveled.html?id=xZBDBAAAQBAJ",
    "marker": "Adelice returns to Arras to find that the world she knew has changed",
    "start": "Adelice returns to"
  },
  {
    "id": "6972",
    "editionId": "7131",
    "locale": "en",
    "title": "Authority and the Individual",
    "author": "Bertrand Russell",
    "isbn": "9780041700312",
    "isbn10": "0041700317",
    "openLibraryWorkId": "OL1088583W",
    "openLibraryEditionId": "OL9227848M",
    "sourceKey": "9780041700312",
    "source": "official_publisher",
    "href": "https://www.routledge.com/Authority-and-the-Individual/Russell/p/book/9781138130470",
    "marker": "Bertrand Russell examines how a society can organise collective life without extinguishing individual initiative",
    "start": "Bertrand Russell examines"
  },
  {
    "id": "7858",
    "editionId": "8017",
    "locale": "en",
    "title": "If... Then",
    "author": "Taina Bucher",
    "isbn": "9780190493035",
    "isbn10": null,
    "openLibraryWorkId": "OL21161195W",
    "openLibraryEditionId": "OL28647888M",
    "sourceKey": "9780190493035",
    "source": "official_publisher",
    "href": "https://academic.oup.com/book/6695",
    "marker": "Taina Bucher studies how algorithms shape what people encounter and do in digital media",
    "start": "Taina Bucher studies"
  },
  {
    "id": "7466",
    "editionId": "7625",
    "locale": "en",
    "title": "A short history of the Jewish people",
    "author": "Raymond P. Scheindlin",
    "isbn": "9780195139419",
    "isbn10": "0195139410",
    "openLibraryWorkId": "OL15702008W",
    "openLibraryEditionId": "OL24626574M",
    "sourceKey": "9780195139419",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/A_Short_History_of_the_Jewish_People.html?id=O5jtAAAAMAAJ",
    "marker": "Raymond P",
    "start": "Raymond P. Scheindlin"
  },
  {
    "id": "3880",
    "editionId": "4039",
    "locale": "en",
    "title": "The drowned and the saved",
    "author": "Primo Levi",
    "isbn": "9780718130633",
    "isbn10": "0718130634",
    "openLibraryWorkId": "OL860027W",
    "openLibraryEditionId": "OL39472687M",
    "sourceKey": "9780718130633",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.ca/books/The-Drowned-and-the-Saved/Primo-Levi/9781501167638",
    "marker": "Primo Levi returns to his experience of Auschwitz through eight essays about memory, testimony and the difficulty of understanding extreme violence",
    "start": "Primo Levi returns"
  },
  {
    "id": "6838",
    "editionId": "6997",
    "locale": "en",
    "title": "Employee engagement",
    "author": "Emma Bridger",
    "isbn": "9780749472016",
    "isbn10": "0749472014",
    "openLibraryWorkId": "OL20000897W",
    "openLibraryEditionId": "OL27180995M",
    "sourceKey": "9780749472016",
    "source": "official_publisher",
    "href": "https://www.koganpage.com/hr-learning-development/employee-engagement-9781398605145",
    "marker": "Emma Bridger approaches employee engagement as something organisations need to understand, plan and assess",
    "start": "Emma Bridger approaches"
  },
  {
    "id": "5368",
    "editionId": "5527",
    "locale": "nl",
    "title": "Tumult",
    "author": "Frank Okker",
    "isbn": "9789045006109",
    "isbn10": null,
    "openLibraryWorkId": "OL7826128W",
    "openLibraryEditionId": "OL22655822M",
    "sourceKey": "9789045006109",
    "source": "official_catalog",
    "href": "https://www.dbnl.org/tekst/_ind004200901_01/_ind004200901_01_0025.php",
    "marker": "Frank Okker reconstrueert het leven van schrijfster Madelon Székely-Lulofs aan de hand van haar literaire werk, familiegeschiedenis en bewaard gebleven correspondentie",
    "start": "Frank Okker reconstrueert"
  },
  {
    "id": "5543",
    "editionId": "5702",
    "locale": "nl",
    "title": "Waarnemer, adviseur, beslisser",
    "author": "Uri Rosenthal",
    "isbn": "9789044634730",
    "isbn10": "9044634739",
    "openLibraryWorkId": "OL31244174W",
    "openLibraryEditionId": "OL42901327M",
    "sourceKey": "9789044634730",
    "source": "official_catalog",
    "href": "https://ramsj.nl/winkel/waarnemer-adviseur-beslisser/",
    "marker": "Uri Rosenthal kijkt terug op een leven dat van wetenschap en crisisadvies naar de landelijke politiek voert",
    "start": "Uri Rosenthal kijkt"
  },
  {
    "id": "6124",
    "editionId": "6283",
    "locale": "nl",
    "title": "Birk",
    "author": "Jaap Robben",
    "isbn": "9789044532777",
    "isbn10": "9044532774",
    "openLibraryWorkId": "OL31431303W",
    "openLibraryEditionId": "OL43087197M",
    "sourceKey": "9789044532777",
    "source": "official_catalog",
    "href": "https://rozet.nl/catalogus/2587641/",
    "marker": "Mikael woont met zijn ouders op een afgelegen eiland boven Schotland",
    "start": "Mikael woont met"
  },
  {
    "id": "5909",
    "editionId": "6068",
    "locale": "nl",
    "title": "De donkere bruid",
    "author": "Laura Restrepo",
    "isbn": "9789029068369",
    "isbn10": "9029068361",
    "openLibraryWorkId": "OL97953W",
    "openLibraryEditionId": "OL35328884M",
    "sourceKey": "9789029068369",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL24962449M/The_dark_bride",
    "marker": "In het Colombiaanse oliestadje Tora groeit een meisje uit tot Sayonara, een vrouw die een bijzondere plaats inneemt binnen de gemeenschap van sekswerkers",
    "start": "In het Colombiaanse"
  },
  {
    "id": "6046",
    "editionId": "6205",
    "locale": "nl",
    "title": "De verloofdes van meneer Hire",
    "author": "Georges Simenon",
    "isbn": "9789025421960",
    "isbn10": "9025421962",
    "openLibraryWorkId": "OL1242881W",
    "openLibraryEditionId": "OL37788322M",
    "sourceKey": "9789025421960",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/258352/mr-hires-engagement-by-simenon-georges/9780141978468",
    "marker": "Meneer Hire is een zonderlinge, teruggetrokken man die door zijn buren met achterdocht wordt bekeken",
    "start": "Meneer Hire is"
  },
  {
    "id": "6363",
    "editionId": "6522",
    "locale": "nl",
    "title": "Mannen na 50",
    "author": "Laurens De Keyzer",
    "isbn": "9789058265999",
    "isbn10": "9058265994",
    "openLibraryWorkId": "OL26411573W",
    "openLibraryEditionId": "OL35655705M",
    "sourceKey": "9789058265999",
    "source": "official_catalog",
    "href": "https://www.bol.com/nl/nl/p/mannen-na-50/1001004007255708/",
    "marker": "Laurens De Keyzer spreekt met vijftien mannen die de vijftig zijn gepasseerd",
    "start": "Laurens De Keyzer"
  },
  {
    "id": "5454",
    "editionId": "5613",
    "locale": "nl",
    "title": "De Republiek, 1477-1806",
    "author": "Jonathan I. Israel",
    "isbn": "9789051941326",
    "isbn10": "9051941323",
    "openLibraryWorkId": "OL24821964W",
    "openLibraryEditionId": "OL32986299M",
    "sourceKey": "9789051941326",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/De_Republiek_1477_1806.html?id=lRIjAQAAIAAJ",
    "marker": "Jonathan Israel onderzoekt de geschiedenis waaruit de Nederlandse Republiek voortkwam",
    "start": "Jonathan Israel onderzoekt"
  },
  {
    "id": "4781",
    "editionId": "4940",
    "locale": "en",
    "title": "A Tale of Love and Darkness",
    "author": "עמוס עוז",
    "isbn": "9780701174217",
    "isbn10": "0701174218",
    "openLibraryWorkId": "OL1580894W",
    "openLibraryEditionId": "OL22597755M",
    "sourceKey": "9780701174217",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/357612/a-tale-of-love-and-darkness-by-oz-amos/9780099450030",
    "marker": "Amos Oz recalls growing up in Jerusalem amid the upheavals of the 1940s and 1950s",
    "start": "Amos Oz recalls"
  },
  {
    "id": "6730",
    "editionId": "6889",
    "locale": "en",
    "title": "Schoolteacher",
    "author": "Dan C. Lortie",
    "isbn": "9780226493541",
    "isbn10": "0226493547",
    "openLibraryWorkId": "OL5956649W",
    "openLibraryEditionId": "OL9709233M",
    "sourceKey": "9780226493541",
    "source": "official_publisher",
    "href": "https://press.uchicago.edu/ucp/books/book/chicago/S/bo3645184.html",
    "marker": "Dan C",
    "start": "Dan C. Lortie"
  },
  {
    "id": "6774",
    "editionId": "6933",
    "locale": "en",
    "title": "Dark Fiber: Tracking Critical Internet Culture (Electronic Culture: History, Theory, and Practice)",
    "author": "Geert Lovink",
    "isbn": "9780262621809",
    "isbn10": "0262621800",
    "openLibraryWorkId": "OL8105280W",
    "openLibraryEditionId": "OL9555513M",
    "sourceKey": "9780262621809",
    "source": "official_publisher",
    "href": "https://doi.org/10.7551/mitpress/2272.001.0001",
    "marker": "Geert Lovink examines internet culture through criticism of the institutions, technologies and economic interests that shape it",
    "start": "Geert Lovink examines"
  },
  {
    "id": "6848",
    "editionId": "7007",
    "locale": "en",
    "title": "Disciplined Entrepreneurship 24 Steps To A Successful Startup",
    "author": "Bill Aulet",
    "isbn": "9781118692288",
    "isbn10": null,
    "openLibraryWorkId": "OL17579389W",
    "openLibraryEditionId": "OL26182543M",
    "sourceKey": "9781118692288",
    "source": "official_publisher",
    "href": "https://www.pubmatch.com/book/105236.html",
    "marker": "Bill Aulet presents entrepreneurship as a process that can be learned and practised",
    "start": "Bill Aulet presents"
  },
  {
    "id": "6858",
    "editionId": "7017",
    "locale": "en",
    "title": "Technological Revolutions and Financial Capital",
    "author": "Carlota Perez",
    "isbn": "9781843763314",
    "isbn10": "1843763311",
    "openLibraryWorkId": "OL224128W",
    "openLibraryEditionId": "OL8949952M",
    "sourceKey": "9781843763314",
    "source": "official_publisher",
    "href": "https://www.e-elgar.com/shop/gbp/technological-revolutions-and-financial-capital-9781843763314.html",
    "marker": "Carlota Perez connects major technological changes with recurring patterns in finance and economic development",
    "start": "Carlota Perez connects"
  },
  {
    "id": "6965",
    "editionId": "7124",
    "locale": "en",
    "title": "All of the Marvels",
    "author": "Douglas Wolk",
    "isbn": "9781788169288",
    "isbn10": null,
    "openLibraryWorkId": "OL25290104W",
    "openLibraryEditionId": "OL33867340M",
    "sourceKey": "9781788169288",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/549063/all-of-the-marvels-by-douglas-wolk/9780735222182/",
    "marker": "Douglas Wolk reads Marvel superhero comics as an enormous interconnected narrative rather than a collection of separate adventures",
    "start": "Douglas Wolk reads"
  },
  {
    "id": "7016",
    "editionId": "7175",
    "locale": "en",
    "title": "The Wizard and the Prophet",
    "author": "Charles C. Mann",
    "isbn": "9780307961693",
    "isbn10": null,
    "openLibraryWorkId": "OL17923653W",
    "openLibraryEditionId": "OL26496950M",
    "sourceKey": "9780307961693",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/220698/the-wizard-and-the-prophet-by-charles-c-mann/",
    "marker": "Charles C",
    "start": "Charles C. Mann"
  },
  {
    "id": "7103",
    "editionId": "7262",
    "locale": "en",
    "title": "The Faithful Executioner",
    "author": "Joel F. Harrington",
    "isbn": "9781847922120",
    "isbn10": "1847922120",
    "openLibraryWorkId": "OL16726859W",
    "openLibraryEditionId": "OL38774198M",
    "sourceKey": "9781847922120",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/414776/the-faithful-executioner-by-joel-f-harrington/9780099572664",
    "marker": "Frantz Schmidt recorded his work as an executioner in a diary that offers an unusual view of early modern European life",
    "start": "Frantz Schmidt recorded"
  },
  {
    "id": "7214",
    "editionId": "7373",
    "locale": "en",
    "title": "The Boys Who Challenged Hitler",
    "author": "Phillip M. Hoose",
    "isbn": "9781338030112",
    "isbn10": null,
    "openLibraryWorkId": "OL17628536W",
    "openLibraryEditionId": "OL26889858M",
    "sourceKey": "9781338030112",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9780374302726/theboyswhochallengedhitler/",
    "marker": "When German forces occupy Denmark, Knud Pedersen and a small group of other boys decide that waiting for adults to resist is not enough",
    "start": "When German forces"
  },
  {
    "id": "6631",
    "editionId": "6790",
    "locale": "en",
    "title": "Rise and Fall of Nations",
    "author": "Ruchir Sharma",
    "isbn": "9780241188514",
    "isbn10": null,
    "openLibraryWorkId": "OL20029931W",
    "openLibraryEditionId": "OL28598342M",
    "sourceKey": "9780241188514",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/280444/the-rise-and-fall-of-nations-by-sharma-ruchir/9780141980706",
    "marker": "Ruchir Sharma considers why some national economies advance while others lose momentum",
    "start": "Ruchir Sharma considers"
  },
  {
    "id": "6763",
    "editionId": "6922",
    "locale": "en",
    "title": "An Introduction To The Policy Process",
    "author": "Thomas A. Birkland",
    "isbn": "9780765614896",
    "isbn10": "0765614898",
    "openLibraryWorkId": "OL2640747W",
    "openLibraryEditionId": "OL8055021M",
    "sourceKey": "9780765614896",
    "source": "official_catalog",
    "href": "https://lib.umi.ac.ug/cgi-bin/koha/opac-detail.pl?biblionumber=2673",
    "marker": "Thomas A",
    "start": "Thomas A. Birkland"
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

  test(`recovery34 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
    assert.match(edition.sourceKey, /^97[89]\d{10}$/);
    assert.equal([...edition.sourceKey].reduce((sum, digit, i) => sum + Number(digit) * (i % 2 ? 3 : 1), 0) % 10, 0, 'attribution uses a valid ISBN-13 checksum');
    assert.equal(edition.sourceKey, edition.isbn, 'attribution retains the selected ISBN-13');
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

  test(`recovery34 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all 28 reviewed summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery34-tests', plugins: [react()],
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
      const renderedMarker = renderToStaticMarkup(createElement('span', null, edition.marker)).replace(/^<span>|<\/span>$/g, '');
      assert.ok(html.includes(renderedMarker), edition.id);
      assert.ok(description);
      const renderedParagraphs = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(match => match[1]);
      const expectedText = renderToStaticMarkup(createElement('span', null, description.text)).replace(/^<span>|<\/span>$/g, '');
      assert.equal(renderedParagraphs.join(' ').replace(/\s+/g, ' ').trim(), expectedText.replace(/\s+/g, ' ').trim(), `${edition.id}: paragraph formatting preserves the complete text and punctuation`);
      assert.ok(html.includes('href="' + edition.href.replaceAll('&', '&amp;') + '"'), edition.id);
      assert.match(html, /class="description-source"/);
      assert.doesNotMatch(html, /Loading the description|De beschrijving wordt geladen|could not load|kon tijdelijk niet|not available yet|geen geverifieerde|<[^>]+\shidden(?:\s|=|>)/);
    }
  } finally { await vite.close(); }
});
