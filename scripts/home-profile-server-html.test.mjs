// Opt-in actual local SSR, with the explicit synthetic-only review runner.
import test from 'node:test';
import assert from 'node:assert/strict';
const origin=process.env.HOME_PROFILE_REVIEW_ORIGIN;
if(origin&&origin!=='http://127.0.0.1:3126')throw Error('LOCAL_REVIEW_TARGET_REQUIRED');
for(const locale of ['nl','en']){
 test(`${locale}: guest account redirects to login without private data`,{skip:!origin},async()=>{
  const r=await fetch(`${origin}/${locale}/account?review=guest`,{redirect:'manual'});
  assert.equal(r.status,307);assert.equal(r.headers.get('location'),`/${locale}/login?next=%2F${locale}%2Faccount`);
  assert.doesNotMatch(await r.text(),/reader-[ab]@example.invalid/);
 });
 for(const mode of ['reader','empty','many','b','error','sparse','partial'])test(`${locale}: private account SSR ${mode}`,{skip:!origin},async()=>{
  const r=await fetch(`${origin}/${locale}/account?review=${mode}`);assert.equal(r.status,200);
  const html=await r.text();assert.match(r.headers.get('cache-control'),/private/);assert.match(r.headers.get('cache-control'),/no-store/);assert.match(html,/noindex/);
  assert.ok(html.includes(mode==='b'?'reader-b@example.invalid':'reader-a@example.invalid'));
  assert.ok(!html.includes(mode==='b'?'reader-a@example.invalid':'reader-b@example.invalid'));
  const values=[...html.matchAll(/<dd>(.*?)<\/dd>/g)].map(m=>m[1].replace(/[.,]/g,''));
  if(mode==='error'){assert.match(html,/role="alert"/);assert.equal(values.length,0);}
  else assert.deepEqual(values,mode==='empty'?['0','0','0','0']:mode==='many'?['1519','1505','18','3']:mode==='b'?['1','1','0','0']:['24','10','18','3']);
  if(mode==='sparse'){assert.doesNotMatch(html,/Nog even ontdekken|Keep discovering|missen nog inhoudelijke kenmerken|lack usable content traits|class="taste-profile"|Jij bent een speurneus|You are a sleuth/);}
  if(mode==='partial'){assert.match(html,/class="taste-profile"/);assert.match(html,locale==='nl'?/Jouw leessmaak/:/Your reading taste/);assert.doesNotMatch(html,/Nog even ontdekken|Keep discovering|missen nog inhoudelijke kenmerken|lack usable content traits|Jij bent een speurneus|You are a sleuth/);}
 });
}
