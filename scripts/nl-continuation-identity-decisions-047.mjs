import fs from 'node:fs';import {ROOT} from './nl-continuation-bootstrap.mjs';
for(const n of[235,239,244,245,252,253,258,261,262,264]){const f=new URL('reviewed-'+n+'.json',ROOT),x=JSON.parse(fs.readFileSync(f));x.currentReadback='followup-preflight-readback-022.json';
 if(n===262){x.proposedWork={originalTitle:"Mowgli's tranen",sourceWorkKey:'OL34893131W',firstPublishYear:1990,primaryAuthor:{id:3093,name:'Eric de Kuyper',sourceKey:'OL196170A'}};x.identityDecision+=' CurrentfullEricDeKuypercorpusonlyHetTeruggevondenKind5687/DrieZustersInLonden6517; noexistingMowgliWork/editionISBN.';}
 if(n===239)x.identityDecision+=' Currentconstituents3429Shelter/3550SecondsAway/2998Found; homonym1545NuOfNooitisDaiCarterNOTCoben. Noexistingexactomnibus.';
 if(n===245)x.identityDecision+=' Current3058SoLong/3076MostlyHarmless/4984AndAnotherThingEoinColfer; homonym1577isPaulienCornelisse. Noexistingexactomnibus. Existingedition-ranking flags literalomnibus; do not rename to evade eligibility.';
 if(n===264)x.identityDecision+=' Current2528Tehanu/2188Tales/2191OtherWindand9460EarthseaQuartet aredifferentcontents. Noomnibus-to-individualbinding.';
 if(n===252)x.identityDecision+=' Current5639AmericanaisJoostZwagermannotarchitecture. No merge.';
 fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n');
}
const r=JSON.parse(fs.readFileSync(new URL('reviewed-262.json',ROOT)));
fs.writeFileSync(new URL('cover-largezip-request-021.json',ROOT),JSON.stringify({targets:[{caseNumber:262,candidateId:r.candidateId,editionKey:'/books/'+r.edition.sourceKey,isbn13:r.edition.isbn13,title:r.edition.title,coverId:13695688,notImportApproval:true}]},null,2)+'\n');
