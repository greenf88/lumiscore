import test from 'node:test';
import assert from 'node:assert/strict';
import {safePublicCoverUrl} from './stored-presentation.ts';
test('Dutch library PPN covers preserve exact public identity and reject arbitrary query data',()=>{
 const url='https://www.sambis.nl/iguana/KB.AZB.cls?ppn=392490846&ExternalProfile=InforAll';
 assert.equal(safePublicCoverUrl(url),true);
 for(const invalid of [url+'&token=secret',url+'&ppn=123456789',url.replace('392490846','query'),url.replace('InforAll','private'),url.replace('www.sambis.nl','other.example'),url.replace('https:','http:'),url+'#fragment'])assert.equal(safePublicCoverUrl(invalid),false,invalid);
});
