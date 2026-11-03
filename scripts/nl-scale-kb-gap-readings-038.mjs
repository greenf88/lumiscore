// Five exact public ISBN gaps; reuse cached bounded official KB access. No DB writes.
import fs from 'node:fs';
import {readKB} from './nl-scale-kb.mjs';
import {ROOT} from './nl-scale-snapshot.mjs';
const isbns=['9789086060153','9789062228027','9789464405989','9789029518284','9789029518277'];
const query='PREFIX schema: <http://schema.org/> SELECT ?isbn ?book ?p ?value WHERE { GRAPH <http://data.bibliotheken.nl/nbt> { VALUES ?isbn { '+isbns.map(JSON.stringify).join(' ')+' } ?book schema:isbn ?isbn ; ?p ?value } } LIMIT 1500';
const r=await readKB(query,{label:'Five independently identified exact Dutch print ISBN gaps, phase038'});
if(r.data.results.bindings.length>=1500)throw Error('Truncated public source; do not approve');
fs.writeFileSync(new URL('sources/kb-gap-isbn-038-manifest.json',ROOT),JSON.stringify({isbns,responseSha256:r.sha256,rows:r.data.results.bindings.length,checkedAt:r.checkedAt,cached:r.cached??false},null,2)+'\n');
console.log(JSON.stringify({isbns:isbns.length,rows:r.data.results.bindings.length,sha256:r.sha256,cached:r.cached??false}));
