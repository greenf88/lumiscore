// Fresh Node process, real shared loader + public TEST SDK. No provider calls.
import assert from'node:assert/strict';import{createHash}from'node:crypto';import{probeBook}from'./metadata-hosted-probe.mjs';import{loadPublicBookDescriptionState}from'../lib/books/public-description.ts';
if(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname!=='hlvujbrmfdlrfxdjwsmb.supabase.co')throw Error('Only isolated test');
let providers=0;const result=await loadPublicBookDescriptionState(probeBook,'en',async()=>{providers++;throw Error('Unexpected provider call');});
assert.equal(result.state,'resolved');assert.equal(providers,0);assert.equal(result.description.language,'en');
console.log(JSON.stringify({at:new Date().toISOString(),freshProcess:true,state:result.state,language:result.description.language,source:result.description.source,providerCalls:providers,textSha256:createHash('sha256').update(result.description.text).digest('hex')}));
