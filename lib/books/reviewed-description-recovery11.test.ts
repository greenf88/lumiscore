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

// Frozen identities from the independently captured round11 candidate-audit.json.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "4185",
    "editionId": "4344",
    "locale": "en",
    "title": "The One and Only Ivan",
    "author": "Katherine Applegate",
    "isbn": "9780605527799",
    "isbn10": null,
    "sourceKey": "9780605527799",
    "source": "official_publisher",
    "href": "https://www.theoneandonlyivan.com/product/?isbn=9780061992278",
    "marker": "Ruby",
    "start": "Ivan has spent"
  },
  {
    "id": "4445",
    "editionId": "4604",
    "locale": "en",
    "title": "A Deadly Education",
    "author": "Naomi Novik",
    "isbn": "9781804966495",
    "isbn10": null,
    "sourceKey": "9781804966495",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/609361/a-deadly-education-by-naomi-novik/9780593128497/",
    "marker": "Scholomance",
    "start": "At the Scholomance,"
  },
  {
    "id": "4447",
    "editionId": "4606",
    "locale": "en",
    "title": "Schoolgirl",
    "author": "太宰 治",
    "isbn": "9781935548089",
    "isbn10": null,
    "sourceKey": "9781935548089",
    "source": "official_publisher",
    "href": "https://www.onepeacebooks.com/op/Schoolgirl.html",
    "marker": "schoolgirl",
    "start": "An unnamed schoolgirl"
  },
  {
    "id": "8967",
    "editionId": "9126",
    "locale": "en",
    "title": "Who Killed the Homecoming Queen?",
    "author": "Robert Lawrence Stine",
    "isbn": "9780671529642",
    "isbn10": null,
    "sourceKey": "9780671529642",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Who-Killed-the-Homecoming-Queen/R-L-Stine/Fear-Street/9781665927673",
    "marker": "Tania",
    "start": "Tania seems to"
  },
  {
    "id": "9871",
    "editionId": "10030",
    "locale": "en",
    "title": "Of Blood and Bone (Chronicles of The One)",
    "author": "Nora Roberts",
    "isbn": "9780349415000",
    "isbn10": null,
    "sourceKey": "9780349415000",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781250123022/ofbloodandbone/",
    "marker": "Fallon Swift",
    "start": "Fallon Swift grows"
  },
  {
    "id": "10036",
    "editionId": "10195",
    "locale": "en",
    "title": "Skin Deep",
    "author": "Kay Thorpe",
    "isbn": "9780373112616",
    "isbn10": null,
    "sourceKey": "9780373112616",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL10738699M",
    "marker": "Tessa Cadman",
    "start": "Tessa Cadman keeps"
  },
  {
    "id": "8307",
    "editionId": "8466",
    "locale": "en",
    "title": "The Encounter",
    "author": "Katherine Applegate",
    "isbn": "9780590629799",
    "isbn10": null,
    "sourceKey": "9780590629799",
    "source": "official_publisher",
    "href": "https://www.scholastic.com/internationalsales/sts/61311sts/ScholasticSummer2011Catalog.pdf",
    "marker": "Tobias",
    "start": "Tobias has broken"
  },
  {
    "id": "9090",
    "editionId": "9249",
    "locale": "en",
    "title": "A Man of Means",
    "author": "Kay Thorpe",
    "isbn": "9780373105731",
    "isbn10": null,
    "sourceKey": "9780373105731",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL24941013M",
    "marker": "Dana",
    "start": "Dana accepts a"
  },
  {
    "id": "10053",
    "editionId": "10212",
    "locale": "en",
    "title": "How to Betray a Dragon's Hero",
    "author": "Cressida Cowell",
    "isbn": "9781444913989",
    "isbn10": null,
    "sourceKey": "9781444913989",
    "source": "official_publisher",
    "href": "https://www.hachette.co.uk/titles/cressida-cowell/how-to-train-your-dragon-how-to-betray-a-dragons-hero/9781444913989/",
    "marker": "Murderous Mountains",
    "start": "Hiccup and the"
  },
  {
    "id": "1471",
    "editionId": "1544",
    "locale": "en",
    "title": "Charlie and the great glass elevator",
    "author": "Roald Dahl",
    "isbn": "9780553121445",
    "isbn10": null,
    "sourceKey": "9780553121445",
    "source": "official_publisher",
    "href": "https://shop.roalddahlmuseum.org/products/charlie-and-the-great-glass-elevator-large-paperback",
    "marker": "Space Hotel",
    "start": "Charlie Bucket's adventure"
  },
  {
    "id": "1839",
    "editionId": "1997",
    "locale": "en",
    "title": "Pericles",
    "author": "William Shakespeare",
    "isbn": "9780521075503",
    "isbn10": null,
    "sourceKey": "9780521075503",
    "source": "official_catalog",
    "href": "https://www.folger.edu/explore/shakespeares-works/pericles/read/",
    "marker": "Pericles",
    "start": "Prince Pericles flees"
  },
  {
    "id": "1890",
    "editionId": "2064",
    "locale": "en",
    "title": "The Magic Finger",
    "author": "Roald Dahl",
    "isbn": "9780141322681",
    "isbn10": null,
    "sourceKey": "9780141322681",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/328790/the-magic-finger-by-roald-dahl-illustrated-by-quentin-blake/",
    "marker": "Gregg",
    "start": "The Gregg family's"
  },
  {
    "id": "2126",
    "editionId": "2329",
    "locale": "en",
    "title": "Applause First Folio of Shakespeare in Modern Type",
    "author": "William Shakespeare",
    "isbn": "9781557833334",
    "isbn10": null,
    "sourceKey": "9781557833334",
    "source": "official_publisher",
    "href": "https://www.bloomsbury.com/us/applause-first-folio-of-shakespeare-in-modern-type-9781557833334/",
    "marker": "First Folio",
    "start": "This edition presents"
  },
  {
    "id": "2392",
    "editionId": "2617",
    "locale": "en",
    "title": "A Briefer History of Time",
    "author": "Stephen Hawking",
    "isbn": "9780553804362",
    "isbn10": null,
    "sourceKey": "9780553804362",
    "source": "official_publisher",
    "href": "https://penguinrandomhousehighereducation.com/book/?isbn=9780553804362",
    "marker": "Leonard Mlodinow",
    "start": "Stephen Hawking and"
  },
  {
    "id": "2458",
    "editionId": "2693",
    "locale": "en",
    "title": "The Theory of Everything",
    "author": "Stephen Hawking",
    "isbn": "9781597775083",
    "isbn10": null,
    "sourceKey": "9781597775083",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/The_Theory_of_Everything.html?id=dEEbvgAACAAJ",
    "marker": "cosmos",
    "start": "This lecture-based introduction"
  },
  {
    "id": "2715",
    "editionId": "2874",
    "locale": "en",
    "title": "The Blade Itself",
    "author": "Joe Abercrombie",
    "isbn": "9780316387316",
    "isbn10": null,
    "sourceKey": "9780316387316",
    "source": "official_publisher",
    "href": "https://joeabercrombie.com/books/the-blade-itself/",
    "marker": "Logen Ninefingers",
    "start": "Logen Ninefingers has"
  },
  {
    "id": "3032",
    "editionId": "3191",
    "locale": "en",
    "title": "The Light Fantastic",
    "author": "Terry Pratchett",
    "isbn": "9780061020704",
    "isbn10": null,
    "sourceKey": "9780061020704",
    "source": "official_publisher",
    "href": "https://www.terrypratchettbooks.com/books/the-light-fantastic/",
    "marker": "Rincewind",
    "start": "A red star"
  },
  {
    "id": "4110",
    "editionId": "4269",
    "locale": "en",
    "title": "The visitor",
    "author": "Katherine Applegate",
    "isbn": "9780439012799",
    "isbn10": null,
    "sourceKey": "9780439012799",
    "source": "official_publisher",
    "href": "https://www.scholastic.com/internationalsales/sts/61311sts/ScholasticSummer2011Catalog.pdf",
    "marker": "Rachel",
    "start": "Rachel is still"
  },
  {
    "id": "4245",
    "editionId": "4404",
    "locale": "en",
    "title": "Cruel King",
    "author": "Rina Kent",
    "isbn": "9781685450212",
    "isbn10": null,
    "sourceKey": "9781685450212",
    "source": "official_publisher",
    "href": "https://www.sourcebooks.com/9781464246678-cruel-king-standard-edition-tp.html",
    "marker": "Astrid",
    "start": "Astrid's place at"
  },
  {
    "id": "4299",
    "editionId": "4458",
    "locale": "en",
    "title": "Renegades",
    "author": "Marissa Meyer",
    "isbn": "9781250044662",
    "isbn10": null,
    "sourceKey": "9781250044662",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781250180636/renegades/",
    "marker": "Nova",
    "start": "The Renegades used"
  },
  {
    "id": "4823",
    "editionId": "4982",
    "locale": "en",
    "title": "God Created the Integers",
    "author": "Stephen Hawking",
    "isbn": "9780762430048",
    "isbn10": null,
    "sourceKey": "9780762430048",
    "source": "official_publisher",
    "href": "https://www.hachettebookgroup.com/titles/stephen-hawking/god-created-the-integers/9780762432721/?lens=running-press",
    "marker": "mathematical",
    "start": "Stephen Hawking edits"
  },
  {
    "id": "8520",
    "editionId": "8679",
    "locale": "en",
    "title": "Twisted",
    "author": "Robert Lawrence Stine",
    "isbn": "9780590408325",
    "isbn10": null,
    "sourceKey": "9780590408325",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL24754968M/Twisted",
    "marker": "Abby and Leila",
    "start": "Abby and Leila"
  },
  {
    "id": "8550",
    "editionId": "8709",
    "locale": "en",
    "title": "Bond of Vengeance",
    "author": "Jessica Steele",
    "isbn": "9780373107490",
    "isbn10": null,
    "sourceKey": "9780373107490",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL9748682M/Bond_of_Vengeance",
    "marker": "Keely",
    "start": "Keely understands that"
  },
  {
    "id": "8591",
    "editionId": "8750",
    "locale": "en",
    "title": "A Vengeful Passion",
    "author": "Lynne Graham",
    "isbn": "9780263841060",
    "isbn10": null,
    "sourceKey": "9780263841060",
    "source": "official_publisher",
    "href": "https://www.lynnegraham.com/book/a-vengeful-passion/",
    "marker": "Ashley",
    "start": "Ashley must approach"
  },
  {
    "id": "8817",
    "editionId": "8976",
    "locale": "en",
    "title": "Empire of Desire",
    "author": "Rina Kent",
    "isbn": "9781685450649",
    "isbn10": null,
    "sourceKey": "9781685450649",
    "source": "official_publisher",
    "href": "https://www.rinakent.com/vipers-series/empire-of-desire",
    "marker": "Nathaniel Weaver",
    "start": "An attraction to"
  },
  {
    "id": "8838",
    "editionId": "8997",
    "locale": "en",
    "title": "Dead Man's Folly",
    "author": "Agatha Christie",
    "isbn": "9780671811266",
    "isbn10": null,
    "sourceKey": "9780671811266",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/dead-mans-folly",
    "marker": "Ariadne Oliver",
    "start": "Crime writer Ariadne"
  },
  {
    "id": "9092",
    "editionId": "9251",
    "locale": "en",
    "title": "Best Served Cold",
    "author": "Joe Abercrombie",
    "isbn": "9780575082458",
    "isbn10": null,
    "sourceKey": "9780575082458",
    "source": "official_publisher",
    "href": "https://joeabercrombie.com/books/best-served-cold/",
    "marker": "Monza Murcatto",
    "start": "Mercenary commander Monza"
  },
  {
    "id": "9266",
    "editionId": "9425",
    "locale": "en",
    "title": "Death Comes as the End",
    "author": "Agatha Christie",
    "isbn": "9780671811259",
    "isbn10": null,
    "sourceKey": "9780671811259",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/death-comes-as-the-end",
    "marker": "Renisenb",
    "start": "In ancient Egypt,"
  },
  {
    "id": "9274",
    "editionId": "9433",
    "locale": "en",
    "title": "Man vs. Beast",
    "author": "Robert Muchamore",
    "isbn": "9781416999454",
    "isbn10": null,
    "sourceKey": "9781416999454",
    "source": "official_catalog",
    "href": "https://catalog.ocls.org/Record/.b18355523",
    "marker": "animal protection",
    "start": "James and his"
  },
  {
    "id": "9355",
    "editionId": "9514",
    "locale": "en",
    "title": "Last Argument of Kings",
    "author": "Joe Abercrombie",
    "isbn": "9780316387408",
    "isbn10": null,
    "sourceKey": "9780316387408",
    "source": "official_publisher",
    "href": "https://joeabercrombie.com/books/last-argument-of-kings/",
    "marker": "Glokta",
    "start": "War in the"
  },
  {
    "id": "9785",
    "editionId": "9944",
    "locale": "en",
    "title": "Destined to Meet",
    "author": "Jessica Steele",
    "isbn": "9780263132588",
    "isbn10": null,
    "sourceKey": "9780263132588",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL10239623M",
    "marker": "Bevin Pemberton",
    "start": "Bevin Pemberton has"
  },
  {
    "id": "9863",
    "editionId": "10022",
    "locale": "en",
    "title": "Wizards of Once",
    "author": "Cressida Cowell",
    "isbn": "9780316592765",
    "isbn10": null,
    "sourceKey": "9780316592765",
    "source": "official_publisher",
    "href": "https://www.hachettechildrens.co.uk/titles/cressida-cowell/the-wizards-of-once/9781444936728/",
    "marker": "Xar",
    "start": "Xar belongs to"
  },
  {
    "id": "5063",
    "editionId": "5222",
    "locale": "nl",
    "title": "Liefde is business",
    "author": "Arnon Grunberg",
    "isbn": "9789038827001",
    "isbn10": null,
    "sourceKey": "9789038827001",
    "source": "official_catalog",
    "href": "https://www.arnongrunberg.com/words/1-netherlands-belgium/4-other/116-liefde-is-business/reviews/511-1999-07-24-vrij-nederland",
    "marker": "New York",
    "start": "Een schrijver en"
  },
  {
    "id": "5069",
    "editionId": "5228",
    "locale": "nl",
    "title": "Omdat ik u begeer",
    "author": "Arnon Grunberg",
    "isbn": "9789038890418",
    "isbn10": null,
    "sourceKey": "9789038890418",
    "source": "official_publisher",
    "href": "https://querido.nl/nijgh-van-ditmar/boek/omdat-ik-u-begeer/",
    "marker": "Humo",
    "start": "In deze bundel"
  },
  {
    "id": "10020",
    "editionId": "10179",
    "locale": "en",
    "title": "Black Coffee",
    "author": "Agatha Christie",
    "isbn": "9780573702341",
    "isbn10": null,
    "sourceKey": "9780573702341",
    "source": "official_publisher",
    "href": "https://www.concordtheatricals.com/s/1120/black-coffee",
    "marker": "Sir Claud Amory",
    "start": "Physicist Sir Claud"
  },
  {
    "id": "10128",
    "editionId": "10287",
    "locale": "en",
    "title": "The Jasmine Bride",
    "author": "Daphne Clair",
    "isbn": "9780373023295",
    "isbn10": null,
    "sourceKey": "9780373023295",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL26453245M",
    "marker": "Rachel",
    "start": "Rachel's sheltered life"
  },
  {
    "id": "2741",
    "editionId": "2900",
    "locale": "en",
    "title": "I am legend",
    "author": "Richard Matheson",
    "isbn": "9780575079007",
    "isbn10": null,
    "sourceKey": "9780575079007",
    "source": "official_publisher",
    "href": "https://www.foliosociety.com/row/i-am-legend",
    "marker": "Robert Neville",
    "start": "Robert Neville survives"
  },
  {
    "id": "3813",
    "editionId": "3972",
    "locale": "en",
    "title": "Bad Bishop",
    "author": "L.J. Shen",
    "isbn": "9781399752503",
    "isbn10": null,
    "sourceKey": "9781399752503",
    "source": "official_publisher",
    "href": "https://www.jonathanball.co.za/wp-content/uploads/2025/12/Jonathan_Ball_Publishers_December_2025_Highlights.pdf",
    "marker": "Tiernan Callaghan",
    "start": "After a sexual"
  },
  {
    "id": "3845",
    "editionId": "4004",
    "locale": "en",
    "title": "The 5 Second Rule",
    "author": "Mel Robbins",
    "isbn": "9781682612385",
    "isbn10": null,
    "sourceKey": "9781682612385",
    "source": "official_publisher",
    "href": "https://www.melrobbins.com/book/the-5-second-rule/",
    "marker": "countdown",
    "start": "Mel Robbins introduces"
  },
  {
    "id": "4330",
    "editionId": "4489",
    "locale": "en",
    "title": "Vicious",
    "author": "L.J. Shen",
    "isbn": "9780996135665",
    "isbn10": null,
    "sourceKey": "9780996135665",
    "source": "official_publisher",
    "href": "https://www.authorljshen.com/books/vicious/",
    "marker": "Emilia LeBlanc",
    "start": "Emilia LeBlanc has"
  },
  {
    "id": "4545",
    "editionId": "4704",
    "locale": "en",
    "title": "Trapped",
    "author": "Robert Lawrence Stine",
    "isbn": "9780671015008",
    "isbn10": null,
    "sourceKey": "9780671015008",
    "source": "official_publisher",
    "href": "https://rlstine.com/bookshelf/trapped",
    "marker": "Shadyside High",
    "start": "Saturday detention becomes"
  },
  {
    "id": "7514",
    "editionId": "7673",
    "locale": "en",
    "title": "High 5 Habit",
    "author": "Mel Robbins",
    "isbn": "9781788174107",
    "isbn10": null,
    "sourceKey": "9781788174107",
    "source": "official_publisher",
    "href": "https://www.melrobbins.com/book/the-high-5-habit/",
    "marker": "encouragement",
    "start": "Mel Robbins explores"
  },
  {
    "id": "8632",
    "editionId": "8791",
    "locale": "en",
    "title": "Cherub 5 Divine Madness",
    "author": "Robert Muchamore",
    "isbn": "9780340894347",
    "isbn10": null,
    "sourceKey": "9780340894347",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Divine-Madness/Robert-Muchamore/CHERUB/9781442413641",
    "marker": "The Survivors",
    "start": "CHERUB discovers a"
  },
  {
    "id": "8841",
    "editionId": "9000",
    "locale": "en",
    "title": "Unfriendly Proposition",
    "author": "Jessica Steele",
    "isbn": "9780373030958",
    "isbn10": null,
    "sourceKey": "9780373030958",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL10691744M",
    "marker": "Farran",
    "start": "Farran finds herself"
  },
  {
    "id": "8909",
    "editionId": "9068",
    "locale": "en",
    "title": "Never Count Tomorrow",
    "author": "Daphne Clair",
    "isbn": "9780373024209",
    "isbn10": null,
    "sourceKey": "9780373024209",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL10691226M",
    "marker": "Wingard",
    "start": "Lin takes a"
  },
  {
    "id": "8972",
    "editionId": "9131",
    "locale": "en",
    "title": "Black Thorns",
    "author": "Rina Kent",
    "isbn": "9781685450403",
    "isbn10": null,
    "sourceKey": "9781685450403",
    "source": "official_publisher",
    "href": "https://www.rinakent.com/vipers-series/black-thorns",
    "marker": "Naomi",
    "start": "A relationship that"
  },
  {
    "id": "9555",
    "editionId": "9714",
    "locale": "en",
    "title": "Key of Light",
    "author": "Nora Roberts",
    "isbn": "9780739437919",
    "isbn10": null,
    "sourceKey": "9780739437919",
    "source": "official_publisher",
    "href": "https://www.hachetteukdistribution.co.uk/titles/nora-roberts/key-of-light/9780349411637/",
    "marker": "Malory Price",
    "start": "With her finances"
  },
  {
    "id": "9965",
    "editionId": "10124",
    "locale": "en",
    "title": "How to Twist a Dragon's Tale (Hiccup Horrendous Haddock III)",
    "author": "Cressida Cowell",
    "isbn": "9780340902622",
    "isbn10": null,
    "sourceKey": "9780340902622",
    "source": "official_publisher",
    "href": "https://www.hachettechildrens.co.uk/titles/cressida-cowell/how-to-train-your-dragon-how-to-twist-a-dragons-tale/9780340999110/",
    "marker": "Lava-Lout Island",
    "start": "A volcano on"
  },
  {
    "id": "9968",
    "editionId": "10127",
    "locale": "en",
    "title": "What Dreams May Come",
    "author": "Richard Matheson",
    "isbn": "9780425042021",
    "isbn10": null,
    "sourceKey": "9780425042021",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9780765308702/whatdreamsmaycome/",
    "marker": "Chris",
    "start": "After a fatal"
  },
  {
    "id": "4370",
    "editionId": "4529",
    "locale": "en",
    "title": "Cress",
    "author": "Marissa Meyer",
    "isbn": "9780545848176",
    "isbn10": null,
    "sourceKey": "9780545848176",
    "source": "official_publisher",
    "href": "https://www.marissameyer.com/books/cress/",
    "marker": "Queen Levana",
    "start": "Cress has spent"
  },
  {
    "id": "8219",
    "editionId": "8378",
    "locale": "en",
    "title": "The moral landscape",
    "author": "Sam Harris",
    "isbn": "9780593064870",
    "isbn10": null,
    "sourceKey": "9780593064870",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/The-Moral-Landscape/Sam-Harris/9781439171233",
    "marker": "well-being",
    "start": "Sam Harris argues"
  },
  {
    "id": "8421",
    "editionId": "8580",
    "locale": "en",
    "title": "The Roald Dahl Treasury",
    "author": "Roald Dahl",
    "isbn": "9780141353227",
    "isbn10": null,
    "sourceKey": "9780141353227",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/59209/the-roald-dahl-treasury-by-roald-dahl/9780141378435",
    "marker": "poems",
    "start": "Stories, poems, memories"
  },
  {
    "id": "8832",
    "editionId": "8991",
    "locale": "en",
    "title": "American Revolution, 1776",
    "author": "Lauren Tarshis",
    "isbn": "9780545919746",
    "isbn10": null,
    "sourceKey": "9780545919746",
    "source": "official_publisher",
    "href": "https://www.laurentarshis.com/15-i-survived-american-revolution-1776",
    "marker": "Nathaniel Knox",
    "start": "Eleven-year-old Nathaniel Knox"
  },
  {
    "id": "9490",
    "editionId": "9649",
    "locale": "en",
    "title": "Come Back To Me",
    "author": "Catherine George",
    "isbn": "9780373113217",
    "isbn10": null,
    "sourceKey": "9780373113217",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL10738745M",
    "marker": "Julia",
    "start": "Julia puts considerable"
  },
  {
    "id": "1408",
    "editionId": "1459",
    "locale": "en",
    "title": "King Lear",
    "author": "William Shakespeare",
    "isbn": "9780342048960",
    "isbn10": null,
    "sourceKey": "9780342048960",
    "source": "official_catalog",
    "href": "https://www.folger.edu/explore/shakespeares-works/king-lear/read/",
    "marker": "Cordelia",
    "start": "King Lear divides"
  },
  {
    "id": "2151",
    "editionId": "2354",
    "locale": "en",
    "title": "Murder is Announced (Miss Marple)",
    "author": "Agatha Christie",
    "isbn": "9781579126292",
    "isbn10": null,
    "sourceKey": "9781579126292",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/a-murder-is-announced",
    "marker": "Chipping Cleghorn",
    "start": "An advertisement in"
  },
  {
    "id": "8603",
    "editionId": "8762",
    "locale": "en",
    "title": "Inner Harbour (Quinn Brothers 3)",
    "author": "Nora Roberts",
    "isbn": "9780749906191",
    "isbn10": null,
    "sourceKey": "9780749906191",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/354765/inner-harbor-by-nora-roberts/",
    "marker": "Phillip Quinn",
    "start": "Phillip Quinn has"
  },
  {
    "id": "8978",
    "editionId": "9137",
    "locale": "en",
    "title": "General",
    "author": "Robert Muchamore",
    "isbn": "9781481456685",
    "isbn10": null,
    "sourceKey": "9781481456685",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/The-General/Robert-Muchamore/CHERUB/9781481456678",
    "marker": "James and Lauren",
    "start": "James and Lauren"
  },
  {
    "id": "9229",
    "editionId": "9388",
    "locale": "en",
    "title": "Twisted Kingdom",
    "author": "Rina Kent",
    "isbn": "9781685450045",
    "isbn10": null,
    "sourceKey": "9781685450045",
    "source": "official_publisher",
    "href": "https://www.sourcebooks.com/9781464246708-twisted-kingdom-standard-edition-tp.html",
    "marker": "Elsa",
    "start": "Elsa's search for"
  },
  {
    "id": "9435",
    "editionId": "9594",
    "locale": "en",
    "title": "Tomorrow -- Come Soon",
    "author": "Jessica Steele",
    "isbn": "9780373026074",
    "isbn10": null,
    "sourceKey": "9780373026074",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL9746541M",
    "marker": "Devon",
    "start": "Devon is delighted"
  }
] as const;

function selectedBook(edition: typeof editions[number]): Book {
  return {
    id: 'work-' + edition.id, source: 'supabase', workId: edition.id, title: edition.title,
    editionTitle: edition.title, author: edition.author, isbn13: edition.isbn, editionAvailable: true,
    isbn10: edition.isbn10,
    editionLanguage: ({ nl: 'nld', en: 'eng' } as const)[edition.locale], strictEditionLanguage: edition.locale,
    // Remaining storage identifiers are synthetic; tests never query a real catalogue.
    editionId: edition.editionId, authorId: '70002', openLibraryWorkId: 'OL70001W', openLibraryEditionId: 'OL70001M',
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

  test(`recovery11 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery11 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all sixty recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery11-tests', plugins: [react()],
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
      assert.ok(html.includes('href="' + edition.href + '"'), edition.id);
      assert.match(html, /class="description-source"/);
      assert.doesNotMatch(html, /Loading the description|De beschrijving wordt geladen|could not load|kon tijdelijk niet|not available yet|geen geverifieerde|<[^>]+\shidden(?:\s|=|>)/);
    }
  } finally { await vite.close(); }
});
