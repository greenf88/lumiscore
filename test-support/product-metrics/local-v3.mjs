// Isolated SQL simulation. Never imported by application or deployed SQL.
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {fixture} from './local-fixture.mjs';
export const actor='b0000000-0000-4000-8000-000000000001';
export const context={locale:'nl',surface:'taste_test',source:'facebook',medium:'organic_social',campaign:'dystopie_202610',traffic:'synthetic'};
export const text=name=>readFile(new URL(name,import.meta.url),'utf8');
export async function localMetrics(){const db=new PGlite();await db.exec(fixture);await db.exec(await text('install.sql'));await db.exec(await text('install.sql'));return db;}
export async function grant(db){return(await db.query("select public.product_analysis_consent_test_v3('accept') as g")).rows[0].g.token;}
export async function headers(db,token,c=context,extra={},local=false){await db.query("select set_config('request.jwt.claim.sub',$1,$4),set_config('request.jwt.claims',$2,$4),set_config('request.headers',$3,$4)",[actor,JSON.stringify({sub:actor,session_id:'b0000000-0000-4000-8000-000000000002'}),JSON.stringify({'x-lumiscore-product-context':JSON.stringify(c),...(token?{'x-lumiscore-analysis-grant':token}:{}),...extra}),local]);}
export const browser=async(db,e)=>(await db.query('select public.record_product_events_test_v1($1) as r',[Array.isArray(e)?e:[e]])).rows[0].r;
export const event=(id=crypto.randomUUID(),name='page_opened',properties=context)=>({event_id:id,event:name,properties});
export async function clock(db,t){await db.exec(`create or replace function product_metrics_test.current_time() returns timestamptz language sql volatile set search_path='' as $$select '${t.replaceAll("'",'')}'::timestamptz$$`);}
