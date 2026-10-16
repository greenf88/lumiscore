import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import type {SupabaseClient} from '@supabase/supabase-js';
import {insertUnrated} from './insert-unrated.ts';

test('atomic conflict policy preserves existing score and Read semantics; duplicate retry performs no update', async()=>{
  const db=new PGlite();
  await db.exec(`create table ratings(user_id text,work_id integer,rating integer,unique(user_id,work_id));
    create table read_events(user_id text,work_id integer);
    create function record_read() returns trigger language plpgsql as $$begin insert into read_events values(new.user_id,new.work_id); return new; end$$;
    create trigger read_after_rating after insert on ratings for each row execute function record_read();`);
  const client={from(table:string){assert.equal(table,'ratings');return {
    upsert(row:{user_id:string;work_id:number;rating:number},options:unknown){assert.deepEqual(options,{onConflict:'user_id,work_id',ignoreDuplicates:true});return {async select(){const r=await db.query('insert into ratings values($1,$2,$3) on conflict(user_id,work_id) do nothing returning rating',[row.user_id,row.work_id,row.rating]);return {data:r.rows,error:null};}};},
    select(){const filters: Record<string,unknown>={};const query={eq(key:string,value:unknown){filters[key]=value;return query;},async single(){const r=await db.query('select rating from ratings where user_id=$1 and work_id=$2',[filters.user_id,Number(filters.work_id)]);return {data:r.rows[0],error:r.rows.length?null:Error()};}};return query;},
  };}} as unknown as Pick<SupabaseClient,'from'>;
  try{
    assert.deepEqual(await insertUnrated(client,'alice','2',8),{rating:8,created:true});
    assert.deepEqual(await insertUnrated(client,'alice','2',3),{rating:8,created:false});
    assert.deepEqual(await insertUnrated(client,'bob','2',4),{rating:4,created:true});
    assert.equal((await db.query('select * from read_events')).rows.length,2);
    await assert.rejects(()=>insertUnrated(client,'alice','3',0));
  }finally{await db.close();}
});
