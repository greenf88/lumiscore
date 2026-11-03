import fs from 'node:fs';
const root='catalog/nl-scale-20261102/release/';
const n=JSON.parse(fs.readFileSync(root+'net-availability.json'));
const wanted=n.rows.map(r=>({candidate:r.candidateId,id:r.productionWorkId,source:r.sourceWorkId??null}));
const json=JSON.stringify(wanted).replaceAll("'","''");
const sql=`with wanted as(select * from jsonb_to_recordset('${json}'::jsonb) x(candidate text,id bigint,source text)) select jsonb_build_object('at',clock_timestamp(),'currentDutch',(select count(distinct work_id) from public.editions where language in('nl','nld','dut')),'rows',(select jsonb_agg(jsonb_build_object('candidate',x.candidate,'work',w.id,'currentDutch',exists(select 1 from public.editions e where e.work_id=w.id and e.language in('nl','nld','dut')))) from wanted x left join public.works w on (x.id is not null and w.id=x.id) or (x.id is null and w.open_library_id=x.source))) as result;`;
fs.mkdirSync(root+'final-decision',{recursive:true});fs.writeFileSync(root+'final-decision/net-current.sql',sql);console.log(sql);
