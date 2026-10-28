import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql = readFileSync(new URL('../catalog/editorial-campaigns-20261028/test-recovery.sql', import.meta.url), 'utf8');
const plan = JSON.parse(sql.match(/\$plan\$(.*?)\$plan\$/s)[1]);

test('test-only recovery rolls back and refuses later metadata or cascading dependents', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table authors(id bigint primary key,name text,open_library_id text);
      create table works(id bigint primary key,title text,open_library_id text,author_id bigint references authors(id),first_publish_year integer,work_type text,cover_id integer,source_type text,native_identity_key text);
      create table editions(id bigint primary key,work_id bigint references works(id) on delete cascade,title text,language text,open_library_edition_id text,isbn_10 text,isbn_13 text,publisher text,publish_date text,cover_id integer);
      create table retained_ratings(work_id bigint references works(id) on delete cascade,score integer);
      insert into works(id,open_library_id) values(91021001,'OL893414W');`);
    for (const p of plan) {
      await db.query('insert into authors values($1,$2,$3) on conflict do nothing', [p.author.id,p.author.name,p.author.open_library_id]);
      await db.query('insert into works(id,title,open_library_id,author_id,first_publish_year,work_type,source_type) values($1,$2,$3,$4,$5,$6,$7)',[p.id,p.title,p.source,p.author.id,p.year,p.workType,'open_library']);
      for (const e of p.editions) await db.query('insert into editions(id,work_id,title,language,open_library_edition_id,isbn_10,isbn_13,publisher,publish_date) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[e.id,p.id,e.title,e.language,e.source,e.isbn10,e.isbn13,e.publisher,e.publishDate]);
    }
    const before = (await db.query('select count(*)::integer n from works')).rows[0].n;
    await db.exec(sql);
    assert.equal((await db.query('select count(*)::integer n from works')).rows[0].n,before);
    await db.query('insert into retained_ratings values($1,8)',[plan[0].id]);
    await assert.rejects(db.exec(sql),/Later dependent data/);
    await db.exec('rollback');
    assert.equal((await db.query('select score from retained_ratings')).rows[0].score,8);
    await db.exec('delete from retained_ratings');
    await db.query('update works set title=$1 where id=$2',['Later legitimate change',plan[0].id]);
    await assert.rejects(db.exec(sql),/Later Work change/);
    await db.exec('rollback');
    assert.equal((await db.query('select title from works where id=$1',[plan[0].id])).rows[0].title,'Later legitimate change');
  } finally { await db.close(); }
});
