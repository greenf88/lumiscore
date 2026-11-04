// Compare actual browser image URLs with the reviewed target, never a bare flag.
export function sameReviewedCover(actual,expected){
 try{
  const a=new URL(actual),e=new URL(expected);
  if(a.protocol!=='https:'||a.hostname!==e.hostname)return false;
  const id=e.hostname==='covers.openlibrary.org'&&e.pathname.match(/^\/b\/id\/(\d+)-[LMS]\.jpg$/)?.[1];
  return id?new RegExp('^/b/id/'+id+'-[LMS]\\.jpg$').test(a.pathname)&&a.search===e.search:a.href===e.href;
 }catch{return false;}
}
