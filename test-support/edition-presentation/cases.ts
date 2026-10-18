// Public bibliographic facts captured read-only on 2026-10-18. NO account data.
// The German row deliberately preserves the WRONG catalog/OL dut value.
export const capturedWorks=[
 {id:1410,title:'De man zonder ziekte',author_id:645,authors:{id:645,name:'Arnon Grunberg'},open_library_id:'OL19964025W',source_type:'open_library',first_publish_year:2012,editions:[{id:1462,work_id:1410,title:'Der Mann, der nie krank war',language:'dut',isbn_13:'9783462046601',open_library_edition_id:'OL28188774M',publisher:'Kiepenheuer & Witsch GmbH'}]},
 {id:1342,title:'Je revenais des autres',author_id:718,authors:{id:718,name:'Mélissa Da Costa'},open_library_id:'OL24343547W',source_type:'open_library',first_publish_year:2017,editions:[{id:1367,work_id:1342,title:'Waar de zon de sneeuw raakt',language:'dut',isbn_13:'9789022341674',open_library_edition_id:'OL61048815M',publisher:'Manteau'}]},
 {id:1456,title:'ההיסטוריה של המחר',author_id:65,authors:{id:65,name:'Yuval Noah Harari'},open_library_id:'OL17641518W',source_type:'open_library',first_publish_year:2015,editions:[{id:1523,work_id:1456,title:'Homo Deus',language:'eng',isbn_13:'9781910701874',open_library_edition_id:'OL26326058M',publisher:'Harvill Secker'}]},
];
export const sourceEditions=Object.fromEntries(capturedWorks.map(w=>{const e=w.editions[0];return ['/books/'+e.open_library_edition_id,{key:'/books/'+e.open_library_edition_id,title:e.title,works:[{key:'/works/'+w.open_library_id}],languages:[{key:'/languages/'+e.language}],isbn_13:[e.isbn_13],covers:[w.id===1410?12053167:w.id===1342?15157931:8001570]}];}));
// WHAT-IF fixture only. Not imported by application code and never applied to DB.
export const reviewedProposalWorks=capturedWorks.map(w=>({...w,editions:w.editions.map(e=>({...e,language:w.id===1410?'ger':e.language}))}));
