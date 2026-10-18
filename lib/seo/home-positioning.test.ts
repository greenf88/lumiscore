import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HOME_POSITIONING} from './home-positioning.ts';
import {createPageMetadata} from './page-metadata.ts';
import {translate} from '../i18n/translations.ts';
import {getInformationPageContent,buildInformationPageJsonLd} from '../information/pages.ts';
import {calculateRatingSummary,parseRating} from '../ratings/model.ts';
import {ratingSummaryMap} from '../ratings/card-summaries.ts';

test('homepage metadata and one shared introduction state the approved NL/EN positioning',()=>{
  assert.equal(HOME_POSITIONING.en.title,'Book Ratings & Personal Recommendations | LumiScore');
  assert.equal(HOME_POSITIONING.nl.title,'Boeken beoordelen & persoonlijke leestips | LumiScore');
  for(const locale of ['en','nl'] as const){
    const copy=HOME_POSITIONING[locale];
    assert.equal(translate(locale,'home.heroCopy'),copy.introduction);
    const metadata=createPageMetadata({...copy,canonicalPath:'/',locale});
    assert.equal(metadata.title,copy.title);assert.equal(metadata.description,copy.description);
    assert.equal(metadata.openGraph.siteName,'LumiScore');
    assert.equal(metadata.alternates.canonical,`https://lumisco.re/${locale}`);
    assert.deepEqual(metadata.robots,{index:true,follow:true});
    assert.deepEqual(metadata.alternates.languages,{en:'https://lumisco.re/en','nl-NL':'https://lumisco.re/nl','x-default':'https://lumisco.re/en'});
  }
});

test('existing H1 and primary taste-test action remain; introduction is not theme-hidden duplicated SEO copy',async()=>{
  const source=await readFile(new URL('../../app/components/LumiScoreHome.tsx',import.meta.url),'utf8');
  const hero=source.slice(source.indexOf('const Hero ='),source.indexOf('const CARD_STATUS_KEYS'));
  assert.match(hero,/<h1>\{t\('home.heroStart'\)\}<br \/><em>\{t\('home.heroEmphasis'\)\}<\/em><\/h1>/);
  assert.match(hero,/<LocaleLink className="primary-cta" href="\/taste-test">/);
  assert.match(hero,/<LocaleLink className="learn-link" href="\/zo-werkt-het">/);
  assert.equal((hero.match(/home.heroCopy/g)??[]).length,1);
  assert.doesNotMatch(hero,/hero-primary|hero-paper-copy|home.heroPrimary/);
  const css=await readFile(new URL('../../app/globals.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/\.hero-introduction[^}]*display:\s*none/);
});

test('how-it-works answers five questions, links to existing services, and adds no website rating schema',()=>{
  for(const locale of ['en','nl'] as const){
    const page=getInformationPageContent('howItWorks',locale);
    assert.equal(page.path,'/zo-werkt-het');assert.equal(page.sections.length,5);
    const body=JSON.stringify(page);
    for(const path of ['/browse','/taste-test','/collections'])assert.ok(body.includes(`"href":"${path}"`));
    assert.match(body,locale==='nl'?/drie verschillende beoordelaars/:/three different readers/);
    assert.match(body,/3–4/);
    assert.match(body,locale==='nl'?/geen voorspelde kans/:/not a predicted probability/);
    assert.doesNotMatch(body,/professionele critici|professional critics|written reviews|geschreven reviews|best books website|beste boekenwebsite/i);
    assert.doesNotMatch(JSON.stringify(buildInformationPageJsonLd(page)),/AggregateRating/);
  }
});

test('published explanation matches current rating range, rounded mean and privacy band gate',async()=>{
  assert.equal(parseRating(1),1);assert.equal(parseRating(10),10);
  assert.equal(parseRating(1.5),null);
  assert.equal(calculateRatingSummary([7,8,9]).lumiscore,8);
  const missing=ratingSummaryMap([{work_id:1,lumiscore:8,evidence_status:'insufficient_evidence',rating_count_band:null}]).get('1');
  assert.equal(missing?.lumiscore,null);
  const valid=ratingSummaryMap([{work_id:1,lumiscore:8,evidence_status:'available',rating_count_band:'3–4'}]).get('1');
  assert.equal(valid?.lumiscore,8);assert.equal(valid?.ratingCount,null);
  const sql=await readFile(new URL('../../supabase/migrations/20261007080316_public_rating_threshold_three.sql',import.meta.url),'utf8');
  assert.match(sql,/count\(distinct r.user_id\)/);
  assert.match(sql,/round\(avg\(r.rating\)::numeric,1\)/);
  assert.match(sql,/case when a.n>=3 then a.score end/);
  const detail=await readFile(new URL('../../app/components/LumiScoreBookDetail.tsx',import.meta.url),'utf8');
  assert.ok(detail.includes('onClick={() => void updateRating(rating)}'));
  for(const locale of ['nl','en'] as const){
    const copy=JSON.stringify(getInformationPageContent('howItWorks',locale));
    assert.doesNotMatch(copy,/Save your choice on the book page|aparte opslaanknop/);
  }
});
