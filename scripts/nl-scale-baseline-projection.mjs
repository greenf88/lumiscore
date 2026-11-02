// Compare the exact existing public snapshot projection, without exporting again.
// Historical digest files omitted their serialization query and cannot be compared
// to a differently ordered/serialized hash. This explicit query is reproducible.
import fs from'node:fs';import{PGlite}from'@electric-sql/pglite';import{ROOT,loadSnapshot}from'./nl-scale-snapshot.mjs';
const s=loadSnapshot(),db=new PGlite(),result={},parts=[];
const tables={works:'works',editions:'editions',authors:'authors',metadata:'catalog_edition_metadata',descriptions:'catalog_work_descriptions',aliases:'catalog_work_title_aliases'};
try{for(const[name,table]of Object.entries(tables)){
 const rows=s[name],keys=Object.keys(rows[0]??{}).sort();if(rows.some(r=>JSON.stringify(Object.keys(r).sort())!==JSON.stringify(keys)))throw Error('Mixed projection fields '+name);
 const hash=(await db.query("select md5(string_agg(value::text,'' order by value::text collate \"C\")) digest from jsonb_array_elements($1::jsonb)",[JSON.stringify(rows)])).rows[0].digest;result[name]={count:rows.length,fields:keys,expectedDigest:hash};
 const fields=keys.map(k=>"'"+k+"',"+(name==='works'&&k==='author'?'a.name':'t."'+k+'"')).join(',');
 if(name==='descriptions'){
  const expectedRows=(await db.query("select (value->>'work_id')||':'||(value->>'language') as key,md5(value::text) as digest from jsonb_array_elements($1::jsonb)",[JSON.stringify(rows)])).rows;
  fs.writeFileSync(new URL('production-description-projection-expected.json',ROOT),JSON.stringify(expectedRows,null,2)+'\n');
  fs.writeFileSync(new URL('production-description-projection-readonly.sql',ROOT),"select t.work_id::text||':'||t.language as key,md5(jsonb_build_object("+fields+")::text) as digest from public.catalog_work_descriptions t order by t.work_id,t.language;\n");
 }
 parts.push("select '"+name+"' as name,count(*) as n,md5(string_agg(row::text,'' order by row::text collate \"C\")) as digest from(select jsonb_build_object("+fields+") as row from public."+table+" t"+(name==='works'?' join public.authors a on a.id=t.author_id':'')+")p");
}const query="select clock_timestamp() as checked_at,jsonb_object_agg(name,jsonb_build_object('count',n,'digest',digest)) as projection from("+parts.join(' union all ')+')q;\n';fs.writeFileSync(new URL('production-projection-current.sql',ROOT),query);fs.writeFileSync(new URL('production-projection-expected.json',ROOT),JSON.stringify({scope:'Exact public snapshot columns, JSONB text sorted with explicit bytewise C collation; no private data or production writes',baselineAt:s.baseline.at,tables:result},null,2)+'\n');console.log(Object.fromEntries(Object.entries(result).map(([k,v])=>[k,{count:v.count,expectedDigest:v.expectedDigest}])));}finally{await db.close();}
