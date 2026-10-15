// Real existing PostgreSQL functions in disposable in-memory PGlite, no hosted access.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture} from '../test-support/taste-results/fixture.mjs';
import {browseQuery,editorialRpcArgs} from '../lib/catalog/editorial-query.ts';
import {editorialWindow} from '../lib/catalog/editorial-window.ts';

test('existing SQL ranks full 10,134 catalog before bounded IDs; 16-book windows preserve privacy and stable boundaries',async()=>{
  const db=await fixture();
  try{
    for(const file of ['20261006173806_public_rating_privacy_b.sql','20261007080316_public_rating_threshold_three.sql'])
      await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
    const users=Array.from({length:3},(_,i)=>'cccccccc-0000-4000-8000-'+String(i+1).padStart(12,'0'));
    for(const id of users){
      await db.query('insert into auth.users values($1)',[id]);
      for(const work of [10132,10133,10134])await db.query('insert into public.ratings(user_id,work_id,rating) values($1,$2,$3)',[id,work,work===10134?10:8]);
    }
    // Equal score AND title must still have stable, unique Work identity ordering.
    await db.exec("update public.works set title='Equal title' where id in (10132,10133); set role anon");
    const rpc=async state=>{
      const a=editorialRpcArgs(state);
      return (await db.query('select public.catalog_discovery_page($1,$2,$3,$4,$5,$6,$7,$8,$9) as data',[a.p_query,a.p_categories,a.p_selection,a.p_languages,a.p_sort,a.p_page,a.p_page_size,a.p_alias_ids,state.author?Number(state.author):null])).rows[0].data;
    };
    const reference=await rpc(browseQuery({pageSize:'128'}));
    assert.equal(reference.total,10134); assert.deepEqual(reference.workIds.slice(0,3),[10134,10132,10133]);
    const first=await rpc(browseQuery({}));
    assert.equal(first.workIds.length,32,'existing SQL minimum returns only 32 IDs, not books/covers');
    let combined=[];
    for(let page=1;page<=4;page++){
      const state=browseQuery({page:String(page)}),window=editorialWindow(state,await rpc(state));
      assert.equal(window.ids.length,16); combined.push(...window.ids);
    }
    assert.deepEqual(combined,reference.workIds.slice(0,64).map(String));
    assert.equal(new Set(combined).size,64);
    const tailState=browseQuery({page:'999999999999'}),tail=editorialWindow(tailState,await rpc(tailState));
    assert.equal(tail.page,634); assert.equal(tail.ids.length,6);
    const q=await rpc(browseQuery({q:'Synthetic Author 3',sort:'az',language:'nl'}));
    assert.ok(q.total>0); assert.ok(q.workIds.length<=32);
    const summaries=(await db.query('select * from public.get_work_rating_summaries_v2($1::bigint[])',[combined.slice(0,16)])).rows;
    assert.equal(summaries.find(r=>Number(r.work_id)===10134).rating_count_band,'3–4');
    assert.equal(summaries.find(r=>Number(r.work_id)===10134).evidence_status,'available');
    assert.ok(summaries.filter(r=>![10132,10133,10134].includes(Number(r.work_id))).every(r=>r.lumiscore===null));
    assert.ok(summaries.every(r=>!('rating_count' in r)));
    await assert.rejects(()=>db.query('select * from public.ratings'),e=>e.code==='42501');
  }finally{await db.close();}
});
