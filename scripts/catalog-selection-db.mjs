import { buildPlan, digest, normalizeIdentity } from './catalog-selection-core.mjs';
import model from '../lib/catalog/categories.json' with { type:'json' };
export const SELECTION = 'lumiscore-selectie-1000';

export async function readWorks(db) {
  return (await db.query(`select w.id,w.title,w.open_library_id,w.first_publish_year,a.name as author,
    coalesce((select jsonb_agg(jsonb_build_object('title',e.title,'isbn_13',e.isbn_13,'isbn_10',e.isbn_10)) from public.editions e where e.work_id=w.id),'[]'::jsonb) as editions
    from public.works w left join public.authors a on a.id=w.author_id`)).rows;
}

export async function livePlan(db,records,pins) {
  const plan=buildPlan(records,await readWorks(db),pins);
  const byId=new Map(records.map(r=>[r.candidate_id,r]));
  for(const a of plan.actions.filter(a=>a.kind==='insert')) {
    const author=byId.get(a.candidate_id).author;
    const count=(await db.query('select count(*)::int as n from public.authors where lower(name)=lower($1)',[author])).rows[0].n;
    if(count>1) {a.kind='skip';a.reason='Multiple existing author records; isolated for identity review';}
  }
  plan.counts=Object.fromEntries(['link','insert','skip'].map(k=>[k,plan.actions.filter(a=>a.kind===k).length]));
  return plan;
}

/** Local PostgreSQL transaction. No UPDATE or DELETE of existing bibliographic/user data.
 * The caller supplies the exact reviewed plan; drift aborts the whole transaction.
 */
export async function importSelection(db, records, pins, expectedPlan, { apply=false }={}) {
  return db.transaction(async tx => {
    await tx.exec('lock table public.works in share row exclusive mode');
    const plan=await livePlan(tx,records,pins);
    if(expectedPlan && digest(plan)!==digest(expectedPlan))throw new Error('Catalog drift: regenerate and review the dry-run');
    const byId=new Map(records.map(r=>[r.candidate_id,r]));
    const prior=(await tx.query('select * from catalog_private.editorial_records where selection_slug=$1',[SELECTION])).rows;
    for(const old of prior) {
      const r=byId.get(old.candidate_id);
      if(!r || old.record_hash!==digest(r))throw new Error('Existing editorial record changed; explicit revision required: '+old.candidate_id);
    }
    const existing=new Map(prior.map(r=>[r.candidate_id,r]));
    const pending=plan.actions.filter(a=>a.kind!=='skip'&&!existing.has(a.candidate_id));
    for(const a of plan.actions) {
      const old=existing.get(a.candidate_id);
      if(old&&(a.kind!=='link'||old.work_id!==a.work_id))throw new Error('Previously imported identity drift: '+a.candidate_id);
    }
    const result={...plan,pending:pending.length,created:0,linked:0,unchanged:existing.size,applied:apply};
    if(!apply)return result;
    for(const c of model.categories) {
      await tx.query('insert into public.catalog_categories(id,label_nl,label_en) values($1,$2,$3) on conflict do nothing',[c.id,c.nl,c.en]);
      const saved=(await tx.query('select * from public.catalog_categories where id=$1',[c.id])).rows[0];
      if(saved.label_nl!==c.nl||saved.label_en!==c.en)throw new Error('Category label conflict: '+c.id);
    }
    await tx.query('insert into public.catalog_selections values($1,$2,$3) on conflict do nothing',[SELECTION,'LumiScore Selectie','LumiScore Selection']);
    for(const action of pending) {
      const r=byId.get(action.candidate_id);
      let workId=action.work_id;
      if(action.kind==='insert') {
        const authors=(await tx.query('select id from public.authors where lower(name)=lower($1) order by id',[r.author])).rows;
        // Multiple matching author records need manual adjudication, not a guessed FK.
        if(authors.length>1)throw new Error('Ambiguous author identity: '+r.candidate_id);
        const authorId=authors[0]?.id ?? (await tx.query('insert into public.authors(name) values($1) returning id',[r.author])).rows[0].id;
        workId=(await tx.query('insert into public.works(title,author_id,open_library_id,first_publish_year) values($1,$2,$3,$4) returning id',
          [r.title,authorId,r.open_library_id,r.year])).rows[0].id;
        // ISBN checksum != edition verification. Do not create an edition or cover.
        result.created++;
      } else {
        result.linked++;
        const current=(await tx.query('select title from public.works where id=$1',[workId])).rows[0];
        if(normalizeIdentity(current.title)!==normalizeIdentity(r.title))
          await tx.query('insert into public.catalog_work_title_aliases values($1,$2) on conflict do nothing',[workId,r.title]);
      }
      await tx.query('insert into public.catalog_selection_members values($1,$2,$3)',[SELECTION,workId,r.candidate_id]);
      for(const category of r.categories)
        await tx.query('insert into public.work_catalog_categories values($1,$2) on conflict do nothing',[workId,category]);
      await tx.query(`insert into catalog_private.editorial_records
        (selection_slug,candidate_id,work_id,record_hash,editorial_status,classifier,audience,work_form,evidence)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [SELECTION,r.candidate_id,workId,digest(r),r.status,r.classifier,r.audience,r.form,JSON.stringify(r)]);
    }
    return result;
  });
}
