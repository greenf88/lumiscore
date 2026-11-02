// Explicit bibliography values only; unknown never defaults to print.
export function reviewedPrintFormat(value){
 const v=String(value??'').trim().toLowerCase();
 if(['paperback','mass market paperback'].includes(v))return'paperback';
 if(['hardcover','hardback','gebonden'].includes(v))return'hardcover';
 return null;
}
