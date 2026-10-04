// Disposable in-memory PostgreSQL + the real Supabase client. No remote keys/data.
import { PGlite } from '@electric-sql/pglite';
import { createClient } from '@supabase/supabase-js';
import { loadWorkTraitEvidenceBatched } from '../lib/supabase/work-trait-evidence.ts';
import { loadPublicRatingSummariesBatched } from '../lib/supabase/public-rating-summaries.ts';
import { buildEffectiveWorkTraitVector } from '../lib/recommendations/work-trait-evidence.ts';
import { getReviewedWorkTraitCorrection } from '../lib/recommendations/reviewed-work-trait-corrections.ts';
import { TASTE_TEST_ANCHORS } from '../lib/taste-test/config.ts';
import { applyRatingSummaries } from '../lib/ratings/card-summaries.ts';
import { RECOMMENDATION_CATALOG_SELECT } from '../lib/supabase/recommendation-catalog.ts';

export function mapFixtureWorks(rows) {
  return rows.map(row=>({id:`work-${row.id}`,source:'supabase',workId:String(row.id),title:row.title,
    author:row.authors.name,firstPublishYear:row.first_publish_year,
    editionLanguage:row.editions[0].language,isbn13:row.editions[0].isbn_13,
    score:null,ratingsCount:null,match:null,cover:'orbit'}));
}
export async function legacyCatalog(client) {
  const first=await client.from('works').select(RECOMMENDATION_CATALOG_SELECT,{count:'exact'}).order('id').range(0,999);
  if(first.error) throw first.error;
  const rest=await Promise.all(Array.from({length:Math.max(0,Math.ceil(first.count/1000)-1)},(_,i)=>
    client.from('works').select(RECOMMENDATION_CATALOG_SELECT).order('id').range((i+1)*1000,(i+2)*1000-1)));
  if(rest.some(r=>r.error)) throw new Error('Legacy page failed.');
  const rows=[...first.data,...rest.flatMap(r=>r.data??[])],books=mapFixtureWorks(rows),ids=books.map(b=>b.workId);
  const [summaries,evidence]=await Promise.all([loadPublicRatingSummariesBatched(client,ids),loadWorkTraitEvidenceBatched(client,ids)]);
  const traitsById=new Map(rows.map(row=>[String(row.id),buildEffectiveWorkTraitVector(
    evidence.get(String(row.id))??[],getReviewedWorkTraitCorrection(String(row.id)))]));
  const candidates=applyRatingSummaries(books,summaries).flatMap(book=>{
    const effective=traitsById.get(book.workId);
    return effective.coverageLevel==='none'?[]:[{book,traits:effective.traits,metadataConfidence:effective.metadataConfidence,
      coverageLevel:effective.coverageLevel,seriesKey:TASTE_TEST_ANCHORS[book.workId]?.seriesKey}];
  });
  return {candidates,traitsById};
}
export async function createRecommendationFixture({works=10134,evidenceWorks=1283,dense=false}={}) {
  const db=new PGlite();
  await db.exec(`create table fixture_works(id bigint primary key, payload jsonb not null);
    create table fixture_evidence(work_id bigint,trait text,source text,source_key text,payload jsonb,
      primary key(work_id,trait,source,source_key));
    insert into fixture_works select n,jsonb_build_object('id',n,'title','Synthetic book '||n,
      'first_publish_year',1900+n%126,'open_library_id',null,'source_type','lumiscore_native','work_type','novel',
      'author_id',1+n%5650,'cover_id',null,'authors',jsonb_build_object('id',1+n%5650,'name','Synthetic author '||(1+n%5650)),
      'editions',jsonb_build_array(jsonb_build_object('id',n,'open_library_edition_id',null,'isbn_13',null,'language',case when n%7=0 then 'nl' else 'en' end)))
      from generate_series(1,${works}) n;
    update fixture_works set payload=jsonb_set(payload,'{editions}',payload->'editions'||
      jsonb_build_array(jsonb_build_object('id',${works}+id,'open_library_edition_id',null,'isbn_13',null,'language','nl')))
      where id<=least(159,${works});
    insert into fixture_evidence
      select n,trait,'open_library','synthetic-'||k,jsonb_build_object('work_id',n,'trait',trait,'source','open_library',
        'source_key','synthetic-'||k,'weight',0.9,'confidence',0.9,'raw_labels',jsonb_build_array('synthetic fixture'),
        'mapping_version','taste_traits_v1','verified_at','2026-10-04T00:00:00.000Z')
      from generate_series(1001,${1000+Math.min(evidenceWorks,Math.max(0,works-1000))}) n
      cross join lateral (select k,case k when 1 then (case when n%2=0 then 'fantasy' else 'science_fiction' end)
        when 2 then 'speculative' when 3 then 'contemporary' else 'fast_paced' end as trait from generate_series(1,
        case when ${dense?'true':'false'} then 6 when n<=1093 then 4 else 3 end) k) t;`);
  const metrics={requests:0,decodedBytes:0,works:0,evidenceRows:0,rpc:0,queries:[]};
  let failure=null;
  const client=createClient('http://fixture.invalid','synthetic-public-client',{auth:{persistSession:false,autoRefreshToken:false},
    global:{fetch:async(input,init)=>{
      const url=new URL(String(input)),table=url.pathname.split('/').at(-1);metrics.requests++;
      if(failure?.(url)) return new Response(JSON.stringify({message:'Synthetic failure'}),{status:503,headers:{'Content-Type':'application/json'}});
      let rows,total;
      if(table==='get_work_rating_summaries') {
        metrics.rpc++;
        const ids=JSON.parse(init.body).target_work_ids;
        rows=ids.map(id=>({work_id:Number(id),rating_count:Number(id)%25,lumiscore:5+Number(id)%5}));
      } else {
        const conditions=[],params=[];
        const idFilter=url.searchParams.get(table==='works'?'id':'work_id');
        if(idFilter) {params.push(idFilter.slice(4,-1).split(',').map(Number));conditions.push(`${table==='works'?'id':'work_id'}=any($${params.length}::bigint[])`);}
        const where=conditions.length?`where ${conditions.join(' and ')}`:'';
        const target=table==='works'?'fixture_works':'fixture_evidence';
        const offset=Number(url.searchParams.get('offset')??0),limit=Math.min(1000,Number(url.searchParams.get('limit')??1000));
        const order=table==='works'?'id':'work_id,trait,source,source_key';
        const query=`select payload from ${target} ${where} order by ${order} limit ${limit} offset ${offset}`;
        metrics.queries.push({table,offset,limit});
        rows=(await db.query(query,params)).rows.map(row=>row.payload);
        total=Number((await db.query(`select count(*) as n from ${target} ${where}`,params)).rows[0].n);
        if(table==='works') metrics.works+=rows.length;else metrics.evidenceRows+=rows.length;
      }
      const body=JSON.stringify(rows);metrics.decodedBytes+=Buffer.byteLength(body);
      const headers={'Content-Type':'application/json'};
      if(new Headers(init?.headers).get('prefer')?.includes('count=exact')) headers['Content-Range']=`0-${Math.max(0,rows.length-1)}/${total}`;
      return new Response(body,{status:200,headers});
    }}});
  return {db,client,metrics,failWhen:predicate=>{failure=predicate;},reset:()=>{
    metrics.requests=metrics.decodedBytes=metrics.works=metrics.evidenceRows=metrics.rpc=0;metrics.queries=[];
  }};
}
