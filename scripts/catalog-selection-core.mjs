import { createHash } from 'node:crypto';
import model from '../lib/catalog/categories.json' with { type: 'json' };
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const normalizeIdentity = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export const olid = value => String(value ?? '').match(/OL\d+W/i)?.[0].toUpperCase() ?? null;
export function validIsbn(value) {
  const v=String(value).replace(/[\s-]/g,'');
  if (/^97[89]\d{10}$/.test(v)) return [...v].reduce((s,c,i)=>s+Number(c)*(i%2?3:1),0)%10===0;
  if (/^\d{9}[\dX]$/.test(v)) return [...v].reduce((s,c,i)=>s+(c==='X'?10:Number(c))*(10-i),0)%11===0;
  return false;
}
export function readCsv(text) {
  const rows=[]; let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++) { const c=text[i];
    if(c==='"') { if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted; }
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('Unclosed CSV quote');
  if(cell||row.length){row.push(cell);rows.push(row);}
  const head=rows.shift();head[0]=head[0].replace(/^\uFEFF/,'');
  if(new Set(head).size!==head.length)throw new Error('Duplicate CSV column');
  return rows.map(r=>{if(r.length!==head.length)throw new Error('CSV column mismatch');return Object.fromEntries(head.map((h,i)=>[h,r[i]]));});
}
export const csv = rows => rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
export function assertSelection(records) {
  if(records.length!==1000||new Set(records.map(r=>r.candidate_id)).size!==1000)throw new Error('Expected 1000 unique candidates');
  for(const r of records){
    if(!/^LS1000-\d{4}$/.test(r.candidate_id)||!r.title.trim()||!r.author.trim())throw new Error('Invalid candidate identity');
    if(!['ZEKER','WAARSCHIJNLIJK','TWIJFEL'].includes(r.status)||r.classifier!=='AI_EDITORIAL')throw new Error('Not an editorial AI record');
    if(r.categories.some(k=>!model.categories.some(c=>c.id===k))||new Set(r.categories).size!==r.categories.length)throw new Error('Invalid category');
    if(r.isbns.some(i=>!validIsbn(i)))throw new Error('Invalid ISBN');
    if(r.year!==null&&(!Number.isInteger(r.year)||r.year<1||r.year>2026))throw new Error('Invalid publication year');
    if(r.status==='TWIJFEL'&&!r.hold)throw new Error('Uncertain record needs explicit hold');
  }
}
/** Never merge existing Works. Only explicit identity pins can resolve translations.
 * Matching identifiers must also agree with title AND author (or a reviewed alias).
 */
export function buildPlan(records,works,pins={}) {
  assertSelection(records);
  const seen=new Map(),actions=[];
  for(const r of records){
    const identity=normalizeIdentity(r.title)+'::'+normalizeIdentity(r.author);
    const candidates=works.filter(w=>w.id===r.existing_work_id||(r.open_library_id&&olid(w.open_library_id)===r.open_library_id)
      ||normalizeIdentity(w.title)===normalizeIdentity(r.title)
      ||(w.editions??[]).some(e=>normalizeIdentity(e.title)===normalizeIdentity(r.title)
        ||r.isbns.includes(e.isbn_13)||r.isbns.includes(e.isbn_10)));
    const pin=pins[r.candidate_id];
    const exact=candidates.filter(w=>normalizeIdentity(w.author)===normalizeIdentity(r.author)
      &&(normalizeIdentity(w.title)===normalizeIdentity(r.title)||(w.editions??[]).some(e=>normalizeIdentity(e.title)===normalizeIdentity(r.title))));
    let pinned=pin?works.find(w=>w.id===pin.work_id&&normalizeIdentity(w.author)===normalizeIdentity(pin.author)&&normalizeIdentity(w.title)===normalizeIdentity(pin.title)&&olid(w.open_library_id)===pin.olid):null;
    // Optional reviewed edition binding is fail-closed, not a title/author override.
    // The frozen candidate hash also rejects changes of form (e.g. an adaptation).
    if(pin?.edition_identity) {
      const edition=pin.edition_identity;
      const bound=works.filter(w=>(w.editions??[]).some(e=>e.open_library_edition_id===edition.open_library_edition_id
        &&e.isbn_13===edition.isbn_13&&normalizeIdentity(e.title)===normalizeIdentity(pin.title)
        &&(!e.language||['nl','nld','dut'].includes(e.language))));
      if(digest(r)!==pin.candidate_hash||r.existing_work_id!==pin.work_id||r.open_library_id!==pin.olid
        ||!r.isbns.includes(edition.isbn_13)||!validIsbn(edition.isbn_13)
        ||!/^OL\d+M$/.test(edition.open_library_edition_id??'')||bound.length!==1||bound[0]!==pinned) pinned=null;
    }
    let action={candidate_id:r.candidate_id,kind:'insert',work_id:null,reason:'No existing identity match after candidate-specific database and author/title review'};
    if(r.hold)action={...action,kind:'skip',reason:r.hold};
    else if(pin&&!pinned)action={...action,kind:'skip',reason:'Reviewed identity pin no longer matches live catalog'};
    else if(pinned)action={...action,kind:'link',work_id:pinned.id,reason:pin.reason};
    else if(exact.length===1&&(!r.existing_work_id||exact[0].id===r.existing_work_id)&&(!r.open_library_id||olid(exact[0].open_library_id)===r.open_library_id))action={...action,kind:'link',work_id:exact[0].id,reason:'Work-ID/OL-ID and title-author agree'};
    else if(candidates.length)action={...action,kind:'skip',reason:'Identity conflict or multiple existing Work records; no merge'};
    else if(r.existing_work_id)action={...action,kind:'skip',reason:'Claimed existing Work-ID is missing; no replacement created'};
    if(action.kind!=='skip') {
      const keys=[identity,r.open_library_id&&'OL:'+r.open_library_id,action.work_id&&'ID:'+action.work_id].filter(Boolean);
      if(keys.some(k=>seen.has(k)))action={...action,kind:'skip',reason:'Duplicate candidate identity; no extra Work or membership'};
      else keys.forEach(k=>seen.set(k,r.candidate_id));
    }
    actions.push(action);
  }
  return {schema:'lumiscore-selection-plan-1',source_hash:digest(records),actions,counts:Object.fromEntries(['link','insert','skip'].map(k=>[k,actions.filter(a=>a.kind===k).length]))};
}
