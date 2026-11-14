import type { VerifiedBookDescription } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import { normalizeEditionLanguage } from './edition-ranking.ts';
import { normalizeIsbn13 } from './covers.ts';
import { SECOND_RECOVERY_DESCRIPTIONS } from './reviewed-descriptions-recovery2.ts';
import { THIRD_RECOVERY_DESCRIPTIONS } from './reviewed-descriptions-recovery3.ts';

/** Own short summaries, reviewed against an exact edition and named primary source. */
type ReviewedDescription = {
  workId?:string; editionId?:string; title:string; author:string; isbn13:string;
  openLibraryWorkId?:string; openLibraryEditionId?:string; editionLanguage?:'eng'|'nld';
  language:Locale; reviewedAt:string; sourceName:string; sourceUrl:string; text:string;
  source?:'official_publisher'|'official_catalog';
};
export const REVIEWED_DESCRIPTIONS:readonly ReviewedDescription[] = [{
  workId: '1305', editionId: '1305', title: 'Madonna', author: 'Suzanne Vermeer',
  isbn13: '9789044970791', language: 'nl' as const, reviewedAt: '2026-10-18',
  sourceName: 'A.W. Bruna Uitgevers',
  sourceUrl: 'https://www.awbruna.nl/boek/thrillers/suzanne-vermeer/madonna/',
  text: 'Reclamemanager Ingrid probeert een groot Italiaans modebedrijf als klant te winnen. Tijdens die zakelijke kans krijgt ze met een onaangename verrassing te maken. Dit korte verhaal komt uit de bundel De bestemming.',
}, {
  // Exact ISBN + selected title/author/language bind this public publisher
  // identity in both production and isolated catalogues with different IDs.
  title:'Souvenir',author:'Suzanne Vermeer',isbn13:'9789044978834',language:'nl',reviewedAt:'2026-10-21',
  sourceName:'A.W. Bruna Uitgevers',sourceUrl:'https://www.awbruna.nl/boek/thrillers/suzanne-vermeer/souvenir/',
  text:'Tijdens een vakantie in Umbrië verdwijnt Nienkes moeder Carolien, die alzheimer heeft. Haar spoor leidt naar Florence. Met een medaillon als aanwijzing probeert Nienke te achterhalen wat er is gebeurd.',
}, {
  title:'A \u200bCourt of Silver Flames',author:'Sarah J. Maas',isbn13:'9781526602312',
  openLibraryWorkId:'OL21703979W',openLibraryEditionId:'OL29532409M',editionLanguage:'eng',
  language:'en',reviewedAt:'2026-10-23',sourceName:'Bloomsbury',
  sourceUrl:'https://www.bloomsbury.com/au/court-of-silver-flames-9781526602312/',
  text:'After the war, Nesta Archeron struggles with becoming High Fae and finding her place in the Night Court. Training with Cassian forces her to face old wounds, while a renewed threat puts their court at risk.',
}, {
  title:"The Magician's Nephew (The Chronicles of Narnia)",author:'C. S. Lewis',isbn13:'9780064471107',
  openLibraryWorkId:'OL71042W',openLibraryEditionId:'OL7292690M',editionLanguage:'eng',
  language:'en',reviewedAt:'2026-10-23',source:'official_catalog',sourceName:'NSW Department of Education',
  sourceUrl:'https://online.education.nsw.gov.au/prc/booklist/listBooksByTitle.html?letter=M&levelId=3',
  text:'Polly and Digory unexpectedly reach Narnia. Their adventure explains how travel between Narnia and our world began.',
}, {
  title:'The Amber Spyglass',author:'Philip Pullman',isbn13:'9780440418566',
  openLibraryWorkId:'OL28996W',openLibraryEditionId:'OL7521619M',editionLanguage:'eng',
  language:'en',reviewedAt:'2026-10-23',sourceName:'Penguin Random House',
  sourceUrl:'https://www.penguinrandomhouse.com/books/136441/his-dark-materials-the-amber-spyglass-book-3-by-philip-pullman/9780440418566/',
  text:'Lyra and Will face a dangerous journey as Lord Asriel’s rebellion draws forces from many worlds into conflict. Their choices become central to the fate of the living and the dead.',
}, {
  title:"The Housemaid's Secret",author:'Freida McFadden',isbn13:'9781837901326',
  openLibraryWorkId:'OL34113490W',openLibraryEditionId:'OL46530123M',editionLanguage:'eng',
  language:'en',reviewedAt:'2026-10-23',sourceName:'Bookouture',
  sourceUrl:'https://bookouture.com/books/2903/',
  text:'A housemaid takes a job with the wealthy Garricks, hoping to keep her past hidden. The mysterious absence of Mrs Garrick and signs of distress lead her to investigate what is happening behind a closed bedroom door.',
}, {
  // Public edition identities and source evidence: docs/operations/reviewed-descriptions-20261113.json.
  // ISBN, title, author and language bind these summaries across catalogues with different local IDs.
  title:'10 Things I Hate About You',author:'David Levithan',isbn13:'9780439087308',editionLanguage:'eng',
  language:'en',reviewedAt:'2026-11-13',source:'official_catalog',sourceName:'Google Books — Scholastic edition',
  sourceUrl:'https://books.google.com/books/about/10_Things_I_Hate_about_You.html?id=UkSIGwAACAAJ',
  text:'Bianca Stratford has caught the attention of two boys at school: Cameron James and Joey Donner. Her father, however, has set a condition that puts her romantic plans on hold. Bianca can only date once her older sister starts going out with someone. That family rule ties the sisters’ love lives together and creates an awkward obstacle for Bianca’s admirers. David Levithan’s teenage romance centres on the competing hopes of these schoolmates and the complications of trying to arrange love around a parent’s restrictions.',
}, {
  title:'Palace of Solitude',author:'Esfandiary Bakhtiary',isbn13:'9780704370203',editionLanguage:'eng',
  language:'en',reviewedAt:'2026-11-13',source:'official_publisher',
  sourceName:'J’ai lu / FeniXX — publisher synopsis via Torrossa',
  sourceUrl:'https://www.torrossa.com/fr/resources/an/6336125',
  text:'Princess Soraya recalls a life shaped by royal expectations, public attention and private loneliness. Her account moves from childhood in Isfahan to marriage to the Shah of Iran, where court intrigues complicate the splendour of palace life. Divorce opens a different chapter in Europe, including the possibility of love and a new beginning in Rome. Further losses test that independence. Written with Louis Valentin, these memoirs trace Soraya’s changing circumstances and her efforts to build a life beyond the role that first made her famous.',
}, {
  title:"Zlata's Diary",author:'Zlata Filipovic\u0301',isbn13:'9780140242058',editionLanguage:'eng',
  language:'en',reviewedAt:'2026-11-13',source:'official_publisher',sourceName:'Penguin Random House',
  sourceUrl:'https://www.penguinrandomhouse.com/books/323402/zlatas-diary-by-zlata-filipovic/',
  text:'Zlata Filipović begins her diary as an eleven-year-old in Sarajevo, recording the familiar concerns of school, friends, music and celebrations. As war reaches the city, those ordinary routines give way to shortages, bombardments and the loss of people she knows. Writing becomes a way to describe what is happening around her while holding on to the life she remembers. Her observations show how conflict changes a child’s home and friendships, turning a personal diary into a record of civilian life under siege.',
}, {
  title:'The Official Filthy Rich Handbook',author:'Christopher Tennant',isbn13:'9780761147039',editionLanguage:'eng',
  language:'en',reviewedAt:'2026-11-13',source:'official_publisher',
  sourceName:'Workman Publishing — Spring 2011 catalog, page 94',
  sourceUrl:'https://edelweiss-assets.abovethetreeline.com/WN/pdfs/Workman_Spring2011.pdf',
  text:'Christopher Tennant presents the habits of the extremely wealthy through a humorous guide to their social world. Household staff, impressive homes, personal appearance and the rules of exclusive circles all become subjects for advice delivered with a straight face. The book considers such distinctions as the roles of a butler and a majordomo, alongside the etiquette of naming houses and making the right impression. Its handbook format turns the pursuit of status into a comic examination of the choices and customs surrounding extravagant wealth.',
}, ...SECOND_RECOVERY_DESCRIPTIONS, ...THIRD_RECOVERY_DESCRIPTIONS];

export function reviewedDescriptionSource(sourceKey: string, source?: VerifiedBookDescription['source']): { name: string; href: string } | null {
  const entry = REVIEWED_DESCRIPTIONS.find(row => row.isbn13 === sourceKey &&
    (!source || (row.source ?? 'official_publisher') === source));
  return entry ? { name: entry.sourceName, href: entry.sourceUrl } : null;
}

export function getReviewedDescription(input: {
  workId?: string | null; editionId?: string | null; editionTitle?: string | null;
  author?: string | null; isbn13?: string | null; editionLanguage?: string | null;
  openLibraryWorkId?: string | null; openLibraryEditionId?: string | null;
}, locale: Locale): VerifiedBookDescription | null {
  const normalize = (text?: string | null) => text?.trim().normalize('NFC').toLocaleLowerCase('nl');
  const entry = REVIEWED_DESCRIPTIONS.find(row => (!row.workId || row.workId === input.workId) &&
    (!row.editionId || row.editionId === input.editionId) && row.isbn13 === normalizeIsbn13(input.isbn13) &&
    (!row.openLibraryWorkId || row.openLibraryWorkId === input.openLibraryWorkId) &&
    (!row.openLibraryEditionId || row.openLibraryEditionId === input.openLibraryEditionId) &&
    normalize(row.title) === normalize(input.editionTitle) && normalize(row.author) === normalize(input.author) &&
    row.language === locale && normalizeEditionLanguage(input.editionLanguage ?? '') ===
      (row.editionLanguage ?? (row.language === 'nl' ? 'nld' : 'eng')));
  return entry ? { text: entry.text, source: entry.source ?? 'official_publisher', sourceKey: entry.isbn13,
    verifiedAt: entry.reviewedAt, language: entry.language } : null;
}
