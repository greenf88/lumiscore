// Read-only report. The example is deliberately invented synthetic data, never hosted proof.
import {readFile} from 'node:fs/promises';
import {productMeasurementReport} from '../lib/product-metrics/report.ts';
const synthetic=process.argv.includes('--synthetic-example');
let input;
if(synthetic){
 const c={locale:'nl',surface:'editorial',source:'facebook',medium:'organic_social',campaign:'dystopie_202610',traffic:'synthetic'};
 const definitions=[['page_opened',3,{}],['editorial_list_opened',2,{list_id:'dystopie-vanaf-1990'}],['book_card_opened',1,{work_id:1,list_id:'dystopie-vanaf-1990'}],['book_detail_opened',1,{surface:'book_detail',work_id:1}],['sign_in_succeeded',1,{surface:'login'}],['taste_round_started',1,{surface:'taste_test',goal:10}],['rating_saved',10,{surface:'taste_test',work_id:1,operation:'new'}],['rating_saved',1,{surface:'book_detail',work_id:1,operation:'updated'}],['taste_round_completed',1,{surface:'taste_test',goal:10}],['taste_result_opened',1,{surface:'taste_result'}]];
 input={available:true,includeSynthetic:true,period:{from:'2026-10-22',through:'2026-10-22'},rows:definitions.map(([event,n,d])=>({day:'2026-10-22',event,n,dimensions:{...c,...d}}))};
}else{
 const file=process.argv[2];if(!file)throw Error('Provide a JSON report input or --synthetic-example');
 input=JSON.parse(await readFile(file,'utf8'));
}
console.log(JSON.stringify({evidence:synthetic?'LOCAL SYNTHETIC EXAMPLE — NOT OBSERVED TRAFFIC':'supplied counter rows; provenance must be verified',...productMeasurementReport(input)},null,2));
