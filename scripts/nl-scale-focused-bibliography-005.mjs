// Five already identified edition questions; public CC0 read, never a bulk scan.
import {readKB} from './nl-scale-kb.mjs';
const isbns=['9789056726126','9789026997501','9789044333954','9789044342543','9789032004682'];
const query='PREFIX schema: <http://schema.org/> SELECT ?isbn ?book ?p ?value ?authorName WHERE { GRAPH <http://data.bibliotheken.nl/nbt> { VALUES ?isbn { '+isbns.map(JSON.stringify).join(' ')+' } ?book schema:isbn ?isbn ; ?p ?value . OPTIONAL { ?book schema:author ?a . ?a schema:name ?authorName } } } LIMIT 1500';
const r=await readKB(query,{label:'Exact existing paperback, Judy Moody, Cassandra printings and Asterix publisher questions'});
if(r.data.results.bindings.length>=1500)throw Error('Truncated; do not interpret');
console.log(JSON.stringify({status:r.status,checkedAt:r.checkedAt,sha256:r.sha256,cached:r.cached??false}));
for(const isbn of isbns){const rows=r.data.results.bindings.filter(x=>x.isbn.value===isbn);console.log(JSON.stringify({isbn,rows:rows.map(x=>({book:x.book.value,p:x.p.value,value:x.value.value,author:x.authorName?.value}))}));}
