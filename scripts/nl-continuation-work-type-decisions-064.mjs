// Keep rich bibliographic classification in evidence, not unsupported DB enum values.
import fs from 'node:fs';import {ROOT} from './nl-continuation-bootstrap.mjs';
const frozen=new Set(JSON.parse(fs.readFileSync(new URL('batch-001/selection.json',ROOT))).cases);
const allowed=new Set(['novel','novella','short_story','collection','audiobook_original']);
const collectionKinds=new Set(['story_collection','essay_collection','poetry_collection','column_collection']);
const changes=[];
for(const file of fs.readdirSync(ROOT).filter(f=>/^reviewed-\d+\.json$/.test(f))){const r=JSON.parse(fs.readFileSync(new URL(file,ROOT))),kind=r.proposedWork?.type;if(!kind||allowed.has(kind))continue;if(frozen.has(r.caseNumber))throw Error('Do not change frozen evidence');
 r.bibliographicContentKind=kind;r.proposedWork.type=collectionKinds.has(kind)?'collection':null;
 r.workTypeDecision='Production works_work_type_check permits novel/novella/short_story/collection/audiobook_original or NULL. Rich source classification is preserved separately; NULL is not fiction or taste-test approval. No schema or selection policy change.';
 fs.writeFileSync(new URL(file,ROOT),JSON.stringify(r,null,2)+'\n');changes.push({caseNumber:r.caseNumber,contentKind:kind,proposedDatabaseWorkType:r.proposedWork.type});}
fs.writeFileSync(new URL('work-type-review-064.json',ROOT),JSON.stringify({checkedOn:'2026-11-03',project:'qvplwejffhjvxaypmjut',route:'Read-only pg_constraint inspection; no DDL or DML',actualConstraint:"CHECK (work_type IS NULL OR work_type IN ('novel','novella','short_story','collection','audiobook_original')) NOT VALID",meaning:'NOT VALID still checks new/updated rows. Source taxonomy is not automatically the database taxonomy.',frozenBatch001Changed:false,changes},null,2)+'\n');console.log({changes:changes.length});
