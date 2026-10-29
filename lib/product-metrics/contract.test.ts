import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMetric,measurementTestTarget,measurementTarget,impressionTimer,RANKER_VERSION,campaignContext,parseMetricContext} from './contract.ts';
import {productMeasurementReport} from './report.ts';
const event=()=>({event_id:'b0000000-0000-4000-8000-000000000001',event:'recommendation_impression',properties:{locale:'nl',surface:'home',work_id:1,position:1,ranker_version:RANKER_VERSION}});
test('production activation is explicit, exact-target and keeps synthetic traffic isolated',()=>{
 const prod='https://qvplwejffhjvxaypmjut.supabase.co';
 assert.equal(measurementTarget(prod),null);assert.equal(measurementTarget(prod,'false'),null);
 assert.equal(measurementTarget(prod+'.attacker.invalid','true'),null);
 assert.equal(measurementTarget(undefined,'true'),null);
 assert.equal(measurementTarget(prod,'true')?.traffic,'production');
 assert.equal(measurementTarget('https://hlvujbrmfdlrfxdjwsmb.supabase.co','true')?.traffic,'synthetic');
 const c=campaignContext('https://lumisco.re/nl','','nl',null,'production');assert.equal(c.traffic,'production');assert.ok(parseMetricContext(c));
 const old=campaignContext('https://preview.invalid/nl?utm_source=facebook&utm_medium=organic_social&utm_campaign=dystopie_202610','','nl');
 assert.equal(campaignContext('https://lumisco.re/en','','en',old,'production').campaign,'none');
});
test('allowlisted contract rejects identity, free text, unknown dimensions and bad types',()=>{
 assert.ok(parseMetric(event()));
 for(const extra of ['email','user_id','ip','session_id','url','returnTo','query','score'])assert.equal(parseMetric({...event(),properties:{...event().properties,[extra]:'denied'}}),null);
 for(const properties of [{...event().properties,position:0},{...event().properties,work_id:'1'},{...event().properties,locale:'de'},{...event().properties,ranker_version:'unbounded'}])assert.equal(parseMetric({...event(),properties}),null);
 assert.ok(parseMetric({...event(),event:'taste_round_started',properties:{locale:'en',goal:10}}));
 assert.equal(parseMetric({...event(),event:'taste_round_started',properties:{locale:'en',goal:10,user_id:'x'}}),null);
 assert.equal(measurementTestTarget('https://qvplwejffhjvxaypmjut.supabase.co'),false);
 assert.equal(measurementTestTarget('https://hlvujbrmfdlrfxdjwsmb.supabase.co.attacker.invalid'),false);
 assert.equal(measurementTestTarget('https://hlvujbrmfdlrfxdjwsmb.supabase.co'),true);
});
test('report distinguishes unavailable from zero and exposes denominators without visitor conversion claims',()=>{
 const period={from:'2026-10-19',through:'2026-10-19'};
 assert.equal(productMeasurementReport({available:false,period,rows:[]}).counts,null);
 const context={source:'facebook',medium:'organic_social',campaign:'dystopie_202610',traffic:'synthetic'};
 const report=productMeasurementReport({available:true,includeSynthetic:true,period,rows:[{day:'2026-10-19',event:'recommendation_impression',dimensions:{...event().properties,...context},n:2},{day:'2026-10-19',event:'recommendation_open',dimensions:{...event().properties,...context},n:1}]});
 assert.equal(report.ratios?.opensPerImpression.numerator,1);assert.equal(report.ratios?.opensPerImpression.denominator,2);assert.equal(report.ratios?.completedPerStarted.value,null);
 assert.equal(report.coverage?.complete,false);assert.equal(report.coverage?.observedRejected,null);
});
test('bounded campaign/search context survives NL/EN navigation without retaining URLs or free text',()=>{
 const c=campaignContext('https://lumisco.re/nl/toplijsten/dystopie-vanaf-1990?utm_source=facebook&utm_medium=organic_social&utm_campaign=dystopie_202610&email=PRIVATE','', 'nl');
 assert.equal(c.campaign,'dystopie_202610');assert.equal(c.source,'facebook');assert.ok(parseMetricContext(c));
 const next=campaignContext('https://lumisco.re/en/book/114?returnTo=PRIVATE','https://lumisco.re/nl/toplijsten/dystopie-vanaf-1990','en',c);
 assert.equal(next.campaign,c.campaign);assert.equal(next.locale,'en');assert.equal(next.surface,'book_detail');assert.doesNotMatch(JSON.stringify(next),/PRIVATE|returnTo|https|email/);
 assert.equal(campaignContext('https://lumisco.re/en','https://www.google.nl/search?q=PRIVATE','en').source,'google');
 assert.equal(campaignContext('https://lumisco.re/en','https://www.google.nl.attacker.invalid/search','en').source,'direct_unknown');
 assert.equal(campaignContext('https://lumisco.re/en?utm_source=PRIVATE','','en',c).campaign,'none');
 assert.equal(parseMetricContext({...c,user_id:'private'}),null);
 assert.equal(productMeasurementReport({available:true,period:{from:'2026-10-19',through:'2026-10-19'},rows:[{day:'2026-10-19',event:'page_opened',dimensions:c,n:1}]}).counts,null);
});
test('impression requires continuous half visibility, cancelled timers and duplicate renders do not double count',()=>{
 let count=0,scheduled:(()=>void)|null=null,cancelled=0;
 const timer=impressionTimer(()=>count++,f=>{scheduled=f;return 1 as unknown as ReturnType<typeof setTimeout>;},()=>{cancelled++;scheduled=null;});
 timer.visible(.49);assert.equal(scheduled,null);
 timer.visible(.5);timer.visible(1);timer.visible(.2);assert.equal(cancelled,1);assert.equal(count,0);
 timer.visible(.7);(scheduled as unknown as ()=>void)();assert.equal(count,1);
 timer.visible(.9);timer.visible(0);timer.visible(1);assert.equal(count,1);assert.equal(timer.impressed,true);timer.stop();
});
