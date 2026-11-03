// Existing database enum-like constraint, not a genre or taste classification.
const permitted=new Set(['novel','novella','short_story','collection','audiobook_original']);
export function reviewedWorkType(value){
 if(value===null||permitted.has(value))return value;
 throw Error('Work type must fit the existing reviewed database model; use explicit null for unsupported classifications');
}
