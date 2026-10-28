// Offline/read-only comparison: input files contain public bibliography, never credentials.
import { readFileSync, writeFileSync } from 'node:fs';
import campaigns from '../lib/catalog/editorial-campaigns-20261028.json' with { type: 'json' };
import register from '../catalog/editorial-campaigns-20261028/selection-register.json' with { type: 'json' };
import { selectStrictEdition, withStrictEdition } from '../lib/books/strict-edition.ts';
import { getReviewedCoverOverride } from '../lib/books/reviewed-cover-overrides.ts';
import { loadPublicRatingSummaries } from '../lib/supabase/public-rating-summaries.ts';
import { applyRatingSummaries, formatPublicRatingDisplay } from '../lib/ratings/card-summaries.ts';

const [productionFile, testFile, outputFile, scoreFile] = process.argv.slice(2);
if (!productionFile || !testFile) throw Error('Usage: public-production.json public-test.json');
const production = JSON.parse(readFileSync(productionFile, 'utf8'));
const isolated = JSON.parse(readFileSync(testFile, 'utf8'));
const scores=scoreFile?JSON.parse(readFileSync(scoreFile,'utf8')):[];
const summaries=await loadPublicRatingSummaries({rpc:async()=>({data:scores,error:null})},production.map(w=>String(w.id)));
const normalize = x => String(x ?? '').normalize('NFC').trim().toLocaleLowerCase('en');
function presentation(row, locale) {
  if (!row) return null;
  const edition = selectStrictEdition(row.editions, locale, row.title);
  const base = {id:'work-'+row.id,workId:String(row.id),openLibraryWorkId:row.open_library_id,title:row.title,author:row.author,score:null,ratingsCount:null,match:null,cover:'orbit'};
  const book = withStrictEdition(base, edition, locale);
  const evidence = book && getReviewedCoverOverride(book);
  return book ? {editionId:edition.id,workId:edition.work_id,title:book.title,language:book.editionLanguage,isbn13:book.isbn13,openLibraryEditionId:book.openLibraryEditionId,englishFallback:book.englishEditionFallback,cover:book.coverUrls[0]??null,coverSource:evidence?.evidenceUrl??null,identitySource:edition.open_library_edition_id?'https://openlibrary.org/books/'+edition.open_library_edition_id:null} : null;
}
const works = campaigns.books.map(choice => {
  const source = choice.source.split('/').at(-1);
  const matches = production.filter(w => w.open_library_id===source);
  const p = matches[0];
  const t = isolated.find(w => w.open_library_id===source);
  const notes = register.find(w => w.sourceWorkId===source);
  const locales = Object.fromEntries(['nl','en'].map(locale => {
    const prod = presentation(p,locale),test = presentation(t,locale);
    const summary=p&&summaries.get(String(p.id));
    const card=p&&applyRatingSummaries([{source:'supabase',workId:String(p.id),score:null,ratingsCount:null}],summaries)[0];
    const listScore=card&&formatPublicRatingDisplay(card.score,null,locale,card.ratingBand,card.publicRatingUnavailable);
    const detailScore=summary&&formatPublicRatingDisplay(summary.lumiscore,null,locale,summary.ratingBand);
    return [locale,{production:prod,test,parity:!!prod&&!!test&&['title','language','isbn13','openLibraryEditionId','cover'].every(k=>normalize(prod[k])===normalize(test[k])),editionWorkBinding:!!prod&&String(prod.workId)===String(p.id),sourceReviewed:!!prod&&notes.editions.some(e=>e.isbn13===prod.isbn13&&normalize(e.title)===normalize(prod.title)),publicScore:summary,listScore,detailScore,scoreParity:!!listScore&&JSON.stringify(listScore)===JSON.stringify(detailScore)}];
  }));
  return {expectedWorkId:choice.workId,sourceWorkId:source,productionWorkId:p?.id??null,author:p?.author??null,sourceMatches:matches.length,expectedNumericIdentity:p?.id===Number(choice.workId),authorIdentity:normalize(p?.author)===normalize(choice.author),lists:campaigns.lists.filter(l=>l.workIds.includes(choice.workId)).map(l=>l.slug),contentEvidence:notes?.sources??[],locales};
});
const summary={works:works.length,uniqueSources:new Set(works.map(w=>w.sourceWorkId)).size,existing:works.filter(w=>w.sourceMatches===1).length,missing:works.filter(w=>w.sourceMatches===0).length,duplicateSources:works.filter(w=>w.sourceMatches>1).length,identityConflicts:works.filter(w=>!w.expectedNumericIdentity||!w.authorIdentity).map(w=>w.expectedWorkId),eligiblePresentations:works.flatMap(w=>Object.values(w.locales)).filter(l=>l.production).length,reviewedCovers:works.flatMap(w=>Object.values(w.locales)).filter(l=>l.production?.cover).length,incorrectEditionBindings:works.flatMap(w=>Object.values(w.locales)).filter(l=>!l.editionWorkBinding).length,testDifferences:works.filter(w=>Object.values(w.locales).some(l=>!l.parity)).map(w=>w.expectedWorkId)};
const report={checkedAt:new Date().toISOString(),productionProject:'qvplwejffhjvxaypmjut',testProject:'hlvujbrmfdlrfxdjwsmb',method:'Read-only public bibliography snapshots; exact source Work identity; current central strict selector and reviewed-cover guard. No individual ratings accessed.',summary,works};
if(outputFile){if(!outputFile.endsWith('.json'))throw Error('Report must be JSON');writeFileSync(outputFile,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary));}
else console.log(JSON.stringify(report,null,2));
