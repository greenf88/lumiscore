import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {renderRollback} from './catalog-release-sql.mjs';
const root=new URL('../catalog/edition-recovery-20261031/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,root)));
test('reviewed print identities, language conflicts explicitly adjudicated, no new Works or private writes',()=>{
 const reviews=read('reviewed-editions.json'),plan=read('production-plan.json');
 assert.equal(reviews.editions.length,11);assert.equal(plan.summary.newWorks,0);
 assert.equal(new Set(reviews.editions.map(e=>e.isbn)).size,11);
 for(const e of reviews.editions){assert(['paperback','hardcover'].includes(e.format));assert(e.source.startsWith('https://'));assert(e.identity.length>50);assert.equal([...e.isbn].reduce((s,d,i)=>s+Number(d)*(i%2?3:1),0)%10,0);}
 assert(reviews.editions.find(e=>e.workId===179).identity.includes('incorrectly'));
 assert(reviews.existingCover.identity.includes('Keep corrected internal Work311'));
 for(const s of read('reviewed-summaries.json'))for(const lang of ['nl','en'])if(s[lang])assert(s[lang].split(/\s+/).length>=50&&s[lang].split(/\s+/).length<=95,`${s.workId} ${lang}`);
 assert(plan.actions.every(a=>['editions','catalog_work_descriptions','catalog_edition_metadata'].includes(a.relation)));
});
test('real public baseline: repeat-safe import, committed rollback, later-edit/dependency protection, private stand-ins untouched',async()=>{
 const b=read('production-public-snapshot.json'),plan=read('production-plan.json'),db=new PGlite();
 try{await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create sequence editions_seq start 500000;
 create table authors(id bigint primary key,open_library_id text unique,name text,created_at timestamptz);
 create table works(id bigint primary key,open_library_id text unique,title text,subtitle text,author_id bigint references authors,first_publish_year int,cover_id bigint,subjects text[],created_at timestamptz,source_type text,work_type text,native_identity_key text);
 create table editions(id bigint primary key default nextval('editions_seq'),work_id bigint references works,open_library_edition_id text unique,isbn_10 text,isbn_13 text,language text,publisher text,created_at timestamptz default now(),title text);
 create table synthetic_ratings(work_id bigint references works,score int);create table synthetic_progress(work_id bigint references works,status text);`);
 for(const t of ['authors','works','editions'])await db.query(`insert into ${t} select * from jsonb_populate_recordset(null::${t},$1::jsonb)`,[JSON.stringify(b[t])]);
 await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261030063949_nl_pilot_reviewed_presentation.sql',import.meta.url),'utf8'));
 await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261030120602_catalog_integrity_presentation_guards.sql',import.meta.url),'utf8'));
 for(const [t,key] of [['catalog_work_descriptions','descriptions'],['catalog_edition_metadata','metadata']])await db.query(`insert into ${t} select * from jsonb_populate_recordset(null::${t},$1::jsonb)`,[JSON.stringify(b[key])]);
 await db.exec("insert into synthetic_ratings values(311,8);insert into synthetic_progress values(311,'read');");
 const originals=Object.fromEntries(await Promise.all(['authors','works','editions'].map(async t=>[t,(await db.query(`select to_jsonb(t) value from ${t} t order by id`)).rows])));
 const sql=fs.readFileSync(new URL('production-import.sql',root),'utf8');
 // A single later ISBN10-only record is already a conflicting identity, not
 // merely a duplicate once a second row has been inserted by this package.
 const candidate=read('reviewed-editions.json').editions[0],body=candidate.isbn.slice(3,12),check=(11-[...body].reduce((a,d,i)=>a+Number(d)*(10-i),0)%11)%11;
 const legacy=(await db.query('insert into editions(work_id,title,isbn_10) values($1,$2,$3) returning id',[candidate.workId,'Synthetic legacy identifier',body+(check===10?'X':check)])).rows[0].id;
 await assert.rejects(db.exec(sql),/Equivalent identifier requires review/);await db.exec('rollback');
 await db.query('delete from editions where id=$1',[legacy]);
 const imported=await db.exec(sql),receipt=imported.find(r=>r.rows?.[0]?.receipt)?.rows[0].receipt;
 assert.equal(receipt.rows.length,46);
 const replay=await db.exec(fs.readFileSync(new URL('production-import.sql',root),'utf8'));assert.equal(replay.find(r=>r.rows?.[0]?.receipt).rows[0].receipt.rows.length,0);
 const counts=await db.query(`select count(distinct work_id)::int n from editions where language in('nld','dut','nl') and work_id in(102,2718,208,2600,100,2717,179,2724,2846,199)`);assert.equal(counts.rows[0].n,10);
 const newEd=receipt.rows.find(r=>r.relation==='editions').after_row.id;
 await db.query("select set_config('lumiscore.catalog_release_receipt',$1,false)",[JSON.stringify(receipt)]);
 await db.query('update catalog_work_descriptions set text=text||\' Later legitimate edit.\' where work_id=100 and language=\'nl\'');
 await assert.rejects(db.exec(renderRollback(plan)),/Later legitimate change/);await db.exec('rollback');
 await db.query('update catalog_work_descriptions set text=$1 where work_id=100 and language=\'nl\'',[receipt.rows.find(r=>r.relation==='catalog_work_descriptions'&&r.key.work_id===100&&r.key.language==='nl').after_row.text]);
 await db.exec('create table later_dependency(edition_id bigint references editions on delete cascade)');await db.query('insert into later_dependency values($1)',[newEd]);
 await assert.rejects(db.exec(renderRollback(plan)),/Later dependency/);await db.exec('rollback');await db.exec('delete from later_dependency');
 await db.exec(renderRollback(plan));await db.exec(renderRollback(plan));
 for(const t of ['authors','works','editions'])assert.deepEqual((await db.query(`select to_jsonb(t) value from ${t} t order by id`)).rows,originals[t]);
 assert.deepEqual((await db.query('select * from synthetic_ratings')).rows,[{work_id:311,score:8}]);assert.deepEqual((await db.query('select * from synthetic_progress')).rows,[{work_id:311,status:'read'}]);
 }finally{await db.close();}
});
