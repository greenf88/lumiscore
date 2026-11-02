// Candidate matching only. Equality here is not substantive identity approval.
export const norm=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
