import {selectStrictEdition} from '../lib/books/strict-edition.ts';
import rows from '../catalog/fantasy-descriptions-20261029/catalogue-readonly.json' with {type:'json'};
console.log(JSON.stringify(rows.map(w=>({workId:w.work_id,title:w.work_title,sourceId:w.open_library_id,author:w.author,en:selectStrictEdition(w.editions,'en',w.work_title),nl:selectStrictEdition(w.editions,'nl',w.work_title)}))));
