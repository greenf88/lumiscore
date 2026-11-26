import test from 'node:test';
import assert from 'node:assert/strict';
import { priorityDestination, PRIORITY_DESTINATIONS } from './priority-destinations.ts';
import { getLandingGuide } from './landing-guides.ts';
import { parseMetric, campaignContext } from '../product-metrics/contract.ts';
import { readingGuidesReport } from '../product-metrics/reading-guides-report.ts';
import { productMeasurementReport } from '../product-metrics/report.ts';

test('only the three real Dutch destinations receive dedicated measurement IDs', () => {
  for (const item of PRIORITY_DESTINATIONS) {
    assert.equal(priorityDestination('/nl' + item.path)?.id, item.id);
    assert.ok(getLandingGuide(item.path, 'nl'));
    for (const path of ['/en' + item.path, '/nl' + item.path + '/other', '/nl' + item.path + '-fake']) assert.equal(priorityDestination(path), undefined);
    const guide = getLandingGuide(item.path,'nl')!;
    assert.equal(guide.editorial_review?.responsible,'LumiScore-redactie');
    assert.equal(guide.editorial_review?.updated,'2026-11-25');
    assert.ok(guide.cards?.every(card => card.choice && card.sources.length) ?? true);
  }
  assert.equal(getLandingGuide('/toplijsten/boeken-die-je-aan-het-denken-zetten','nl')?.editorial_review,undefined);
});
test('fixed social attribution and guide IDs reject free text, extra UTM fields and invented channels', () => {
  for (const source of ['facebook','instagram']) {
    const context=campaignContext(`https://lumisco.re/nl/toplijsten/na-project-hail-mary?utm_source=${source}&utm_medium=organic_social&utm_campaign=leesroutes_202611`,'','nl');
    assert.equal(context.source,source);assert.equal(context.campaign,'leesroutes_202611');
    for(const list_id of PRIORITY_DESTINATIONS.map(item=>item.id))assert.ok(parseMetric({event_id:crypto.randomUUID(),event:'reading_guide_opened',properties:{...context,list_id}}));
    assert.equal(campaignContext(`https://lumisco.re/nl?utm_source=${source}&utm_medium=organic_social&utm_campaign=leesroutes_202611&utm_content=PRIVATE`,'','nl').source,'direct_unknown');
    const envelope={event_id:crypto.randomUUID(),event:'reading_guide_opened',properties:{...context,list_id:'suzanne-vermeer'}};
    for(const extra of [{query:'PRIVATE'},{list_id:'PRIVATE'},{locale:'en'},{url:'PRIVATE'}])assert.equal(parseMetric({...envelope,properties:{...envelope.properties,...extra}}),null);
  }
});
test('aggregate report separates home clicks, destination views, book clicks and confirmed saves', () => {
 const actionDimensions={locale:'nl',traffic:'production',source:'facebook',medium:'organic_social',campaign:'leesroutes_202611'};
 const dimensions={...actionDimensions,list_id:'suzanne-vermeer'};
 const rows=[{event:'reading_guide_opened',dimensions:{...dimensions,surface:'home'},n:3},{event:'editorial_list_opened',dimensions:{...dimensions,surface:'collection'},n:2},{event:'book_card_opened',dimensions:{...dimensions,surface:'collection',work_id:1},n:1},{event:'want_to_read_saved',dimensions:{...actionDimensions,surface:'book_detail',work_id:1},n:1}].map(row=>({day:'2026-11-25',...row}));
 const report=readingGuidesReport([...rows,{...rows[0],n:100,dimensions:{...dimensions,surface:'home',traffic:'synthetic'}}]);
 assert.deepEqual(report.destinations[0],{id:'suzanne-vermeer',path:'/nl/collection/suzanne-vermeer',contentViews:2,homeClicks:3,bookClicks:1});
 assert.equal(report.social[0].confirmedAccountSaves,1);assert.equal(report.returningVisitors,null);assert.equal(report.linkedConversion,null);
 const input={available:true,period:{from:'2026-11-25',through:'2026-11-25'},rows};
 assert.equal(productMeasurementReport(input).readingGuides,null,'historical instrumentation must not invent zero guide traffic');
 const validated=productMeasurementReport({...input,readingGuidesAvailable:true});
 assert.equal(validated.readingGuides?.destinations[0].homeClicks,3);
});
