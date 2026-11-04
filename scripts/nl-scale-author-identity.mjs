// A shared Work's authority matches do not establish that all coauthors are one person.
export function existingSourceAuthor(author,neighbour,currentAuthors){
 const key=author.sourceAuthorId??author.key?.split('/').at(-1);
 const exact=currentAuthors.filter(a=>a.open_library_id===key);
 if(exact.length>1)throw Error('Ambiguous exact source-author identity');
 if(exact.length===1)return exact[0];
 const eligible=(neighbour.authorityMatches??[]).filter(x=>x.sourceName===author.name||
  x.method==='shared_wikidata_authority'&&(x.sourceAuthorKey===key||neighbour.sourceAuthors?.length===1));
 const aliases=currentAuthors.filter(a=>eligible.some(x=>x.authorId===a.id));
 if(aliases.length>1)throw Error('Ambiguous author alias');
 return aliases[0]??null;
}
