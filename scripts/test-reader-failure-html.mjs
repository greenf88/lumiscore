// Run against a local production build with Supabase variables deliberately absent.
// No login, credentials or data writes; not part of the environment-free unit glob.
import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectServerHtml} from '../lib/seo/server-html.ts';
const origin=process.env.READER_FAILURE_ORIGIN;
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin??'')) throw new Error('A loopback failure-test origin is required.');
for(const locale of ['nl','en']) for(const path of ['/','/recommendations']) {
  test(`unconfigured ${locale} ${path}: explicit load failure, not empty success or HTTP 500`,async()=>{
    const response=await fetch(origin+path,{headers:{cookie:'lumiscore-locale='+locale}});
    assert.equal(response.status,200);
    const html=await response.text(),seo=inspectServerHtml(html);
    assert.equal(seo.robots.length,1);assert.equal(seo.canonical.length,1);assert.deepEqual(seo.duplicates,[]);
    assert.match(html,/role="alert"/);
    assert.ok(html.includes(locale==='nl'?'Dit is geen leeg profiel':'This is not an empty profile'));
    assert.ok(!html.includes(locale==='nl'?'We hebben nog geen bruikbaar smaakprofiel':'There is not enough taste evidence yet'));
  });
}
