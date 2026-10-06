import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { createRecommendationFixture,legacyCatalog,mapFixtureWorks } from './recommendation-performance-fixture.mjs';
import { loadRecommendationCatalog } from '../lib/supabase/recommendation-catalog.ts';
const f=await createRecommendationFixture();
try {
  await legacyCatalog(f.client);await loadRecommendationCatalog(f.client,mapFixtureWorks);
  const samples=[];
  for(let repeat=1;repeat<=3;repeat++) for(const method of (repeat%2?['before','after']:['after','before'])) {
    f.reset();const start=performance.now();
    const catalog=method==='before'?await legacyCatalog(f.client):await loadRecommendationCatalog(f.client,mapFixtureWorks);
    samples.push({repeat,method,wallMs:Math.round(performance.now()-start),requests:f.metrics.requests,decodedBytes:f.metrics.decodedBytes,
      workRecords:f.metrics.works,evidenceRows:f.metrics.evidenceRows,candidates:catalog.candidates.length});
  }
  assert.ok(samples.every(s=>s.candidates===1283));
  const report={at:new Date().toISOString(),tool:'PGlite 0.3.14, real supabase-js 2.116.0, in-memory SQL-backed fetch adapter',
    fixture:{works:10134,editions:10293,traitWorks:1283,evidenceRows:3942,authors:5650,synthetic:true},
    conditions:'one warmup per loader; alternating order; same initialized local database/process, no artificial network delay or personal cache',
    limitation:'Not PostgREST/hosted latency, wire transfer or production/LCP improvement. SQL query + JSON/client/parsing cost; synthetic mapper; selected-book hydration unchanged.',samples};
  await mkdir('outputs/performance-review',{recursive:true});await writeFile('outputs/performance-review/recommendation-fixture.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} finally {await f.db.close();}
