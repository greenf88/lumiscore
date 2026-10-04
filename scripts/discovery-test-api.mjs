// Real Auth + PostgREST integration, callable only after local target/container/marker gates.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLocalTarget } from './discovery-test-fixture.mjs';
import { verifyAnonymousTasteApi } from './discovery-permissions.mjs';
export async function verifyLocalDiscoveryApi(status) {
  assertLocalTarget(status);
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
  const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,options);
  const anon=createClient(status.API_URL,status.ANON_KEY,options);
  const users=[],clients=[],credentials=[];
  let phase='public-discovery';
  const ok=result=>{
    if(result.error) {
      const code=/^[A-Za-z0-9_]{1,48}$/.test(result.error.code??'')?result.error.code:'withheld';
      throw new Error(`API request failed: ${code}`);
    }
    return result.data;
  };
  const rpc=async(client,name,args)=>ok(await client.rpc(name,args));
  const act=(client,action,state,work,score)=>rpc(client,'taste_rating_advance',{
    p_action:action,p_round_id:state?.round?.id??null,p_work_id:work??null,p_score:score??null,p_language:'en'});
  try {
    await verifyAnonymousTasteApi(anon);
    assert.equal(ok(await anon.from('catalog_categories').select('id')).length,20);
    const pages=[];
    for(let page=1;page<=4;page++) pages.push(await rpc(anon,'catalog_discovery_page',{
      p_query:'Synthetic',p_author_id:8800001,p_categories:['fiction_fantasy'],p_languages:['nl'],p_page:page}));
    assert.ok(pages.every(p=>p.total===100&&p.pageCount===4));
    assert.equal(new Set(pages.flatMap(p=>p.workIds)).size,100);
    assert.equal((await rpc(anon,'catalog_discovery_page',{p_categories:['nonfiction_cooking_food']})).total,0);
    assert.ok((await anon.rpc('taste_rating_advance',{p_action:'start'})).error);
    assert.ok((await anon.from('ratings').select('work_id')).error);
    phase='synthetic-auth';
    for(const label of ['a','b']) {
      phase=`synthetic-auth-create-${label}`;
      const password=randomBytes(30).toString('base64url');
      const email=`pr8-${label}-${randomBytes(8).toString('hex')}@example.invalid`;
      const created=ok(await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{discovery_fixture:'lumiscore-pr8-synthetic-v1'}}));
      users.push(created.user.id);
      credentials.push({email,password});
      const client=createClient(status.API_URL,status.ANON_KEY,options);
      phase=`synthetic-auth-login-${label}`;
      ok(await client.auth.signInWithPassword({email,password})); clients.push(client);
    }
    const [a,b]=clients;
    phase='ratings-and-preference-isolation';
    ok(await a.from('ratings').insert({work_id:8800300,rating:6}));
    ok(await b.from('ratings').insert({work_id:8800300,rating:10}));
    ok(await a.from('user_reading_preferences').insert({user_id:users[0],reading_periods:['2015_present']}));
    assert.equal(ok(await b.from('user_reading_preferences').select('user_id')).length,0);
    assert.ok((await b.from('user_reading_preferences').insert({user_id:users[0],reading_periods:['no_preference']})).error);
    let state=await act(a,'start'); assert.equal(state.round.number,1);
    phase='skip-and-resume';
    assert.deepEqual(await act(a,'start'),state);
    const skip=state.currentWorkId; state=await act(a,'skip',state,skip);
    assert.equal(state.round.ratedCount,0);
    assert.equal(ok(await a.from('ratings').select('work_id').eq('work_id',skip)).length,0);
    const seen=new Set([skip]);
    for(let round=1;round<=3;round++) {
      phase=`round-${round}`;
      assert.equal(state.round.number,round);
      for(let i=0;i<20;i++) {
        const current=state; assert.ok(!seen.has(current.currentWorkId)); seen.add(current.currentWorkId);
        state=await act(a,'rate',current,current.currentWorkId,(i%10)+1);
        assert.equal(state.round.ratedCount,i+1);
        assert.deepEqual(await act(a,'rate',current,current.currentWorkId,(i%10)+1),state);
        assert.deepEqual(await rpc(a,'taste_rating_state'),state);
        // Real token refresh and password reauthentication; browser UI remains a separate gate.
        if(i===9) {
          const session=ok(await a.auth.refreshSession()).session;
          const fresh=createClient(status.API_URL,status.ANON_KEY,options);
          ok(await fresh.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token}));
          assert.deepEqual(await rpc(fresh,'taste_rating_state'),state);
          ok(await fresh.auth.signOut({scope:'local'}));
          ok(await a.auth.signOut({scope:'global'}));
          ok(await a.auth.signInWithPassword(credentials[0]));
          assert.deepEqual(await rpc(a,'taste_rating_state'),state);
        }
      }
      assert.equal(state.round.complete,true);
      if(round<3) state=await act(a,'start');
    }
    assert.equal(seen.size,61);
    phase='persisted-ratings-and-owner-isolation';
    const ratings=ok(await a.from('ratings').select('work_id,rating'));
    assert.equal(ratings.length,61); assert.equal(ratings.find(r=>r.work_id===8800300).rating,6);
    const read=ok(await a.from('user_book_status').select('work_id').eq('status','read'));
    assert.equal(read.length,61);
    assert.equal(ok(await b.from('ratings').select('work_id')).length,1);
    assert.equal(ok(await b.from('taste_rating_rounds').select('id')).length,0);
    assert.equal(ok(await b.from('taste_rating_offers').select('work_id')).length,0);
    assert.ok((await b.rpc('taste_rating_advance',{p_action:'resume',p_round_id:state.round.id})).error);
    assert.ok((await a.from('taste_rating_rounds').insert({user_id:users[0],round_number:99,language:'en'})).error);
    assert.ok((await anon.schema('taste_private').rpc('advance_round',{p_action:'start'})).error);
    // Existing normal rating edits change highest order; no synthetic score overwrites elsewhere.
    ok(await a.from('ratings').update({rating:10}).eq('work_id',8800300));
    phase='highest-after-rating-change';
    assert.equal((await rpc(anon,'catalog_discovery_page',{p_sort:'highest'})).workIds[0],8800300);
    const totals=ok(await anon.from('works').select('id')); assert.equal(totals.length,389);
    return {realAuthPostgrest:true,passwordRelogin:true,explicitRoundRatings:60,rounds:3,skipsWithoutRating:1,ownerIsolation:true,idempotence:true,syntheticWorks:305,migrationPlaceholders:84};
  } catch(error) {
    const code=/^API request failed: ([A-Za-z0-9_]{1,48}|withheld)$/.exec(error.message??'')?.[1]??'assertion';
    console.error(`LOCAL API CHECK FAILED — ${phase}; code=${code}; details withheld.`);
    throw new Error('Local integration verification failed.');
  } finally {
    // Only users created by this run, never enumerate/delete any other account.
    let cleanupFailed=false;
    for(const client of clients) {try { if((await client.auth.signOut({scope:'global'})).error) cleanupFailed=true; } catch {cleanupFailed=true;} }
    for(const id of users) {try {if((await admin.auth.admin.deleteUser(id)).error) cleanupFailed=true;} catch {cleanupFailed=true;} }
    for(const credential of credentials) {credential.email='';credential.password='';}
    if(cleanupFailed) throw new Error('Synthetic account cleanup failed; inspect isolated local target only.');
  }
}
