// Small, exact-definition guarded repair after four hosted search failures.
// Local file preparation only; never executes a database statement.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
const before=readJson(new URL('search-normalization-production-before.json',ROOT)).rows[0];
const test=readJson(new URL('search-normalization-test-before.json',ROOT)).rows[0];
if(before.definition!==test.definition||before.body_md5!=='22d828c503e8b36cdd86a16602e594e4'||before.prosecdef||test.prosecdef)throw Error('Actual function changed; review required');
const old=before.definition;
if((old.match(/position\(lower\(trim\(p_query\)\) in lower\(/g)??[]).length!==4)throw Error('Unexpected candidate predicates');
let next=old.replace('  result jsonb;','  result jsonb;\n  -- Same NFKC equivalence as the application query; no title/data mutation.\n  q_match text := lower(normalize(trim(p_query),NFKC));');
for(const field of['w.title','a.name','x.title','e.title']){
 const from=`position(lower(trim(p_query)) in lower(${field}))`;
 if(!next.includes(from))throw Error('Exact predicate missing');
 next=next.replace(from,`position(q_match in lower(normalize(${field},NFKC)))`);
}
const body=s=>s.split('AS $function$')[1].split('$function$')[0];
const nextMD5=createHash('md5').update(body(next)).digest('hex');
const signature='public.catalog_search_selection_v2(text,text,text[],text,text[],text,bigint[],bigint)';
function guard(hashes){return `do $guard$ declare p record;begin\n select * into p from pg_proc where oid=to_regprocedure('${signature}');\n if p.oid is null or p.prosecdef or p.proconfig is distinct from array['search_path=""']::text[]\n or pg_get_userbyid(p.proowner)<>'postgres' or p.proacl::text<>'{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}'\n or md5(p.prosrc) not in (${hashes.map(h=>"'"+h+"'").join(',')}) then raise exception 'Search function drift; stop and review';end if;\n if current_setting('server_encoding')<>'UTF8' then raise exception 'UTF8 required';end if;\nend;$guard$;\n`;}
const install=`-- Exact shared Unicode candidate-match repair. No table/data/grant/taste/ranking changes.\n-- https://www.postgresql.org/docs/17/functions-string.html\nbegin;set local lock_timeout='3s';set local statement_timeout='30s';\n${guard([before.body_md5,nextMD5])}${next};\ncommit;\n`;
const rollback=`-- Restore only this function; abort if a later function edit exists. No catalogue data touched.\nbegin;set local lock_timeout='3s';set local statement_timeout='30s';\n${guard([nextMD5,before.body_md5])}${old};\ncommit;\n`;
const root=new URL('search-normalization/',ROOT);fs.mkdirSync(root,{recursive:true});
for(const[n,v]of Object.entries({'install.sql':install,'rollback.sql':rollback,'before-function.sql':old,'after-function.sql':next}))fs.writeFileSync(new URL(n,root),v);
fs.writeFileSync(new URL('hashes.json',root),JSON.stringify({oldBodyMD5:before.body_md5,newBodyMD5:nextMD5,installSHA256:createHash('sha256').update(install).digest('hex'),rollbackSHA256:createHash('sha256').update(rollback).digest('hex'),purpose:'NFKC on four candidate fields and query only; existing edition choice, sort, limits, result shape and grants retained'},null,2)+'\n');
console.log(JSON.stringify({newBodyMD5:nextMD5,bytes:Buffer.byteLength(install)}));
