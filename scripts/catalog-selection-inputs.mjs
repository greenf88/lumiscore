import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
export const revision='identity-20261001';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const directory=new URL('../catalog/selection-v1/',import.meta.url);
export async function refuseLegacyRewrite() {
  try{await fs.access(new URL(`${revision}.manifest.json`,directory));}
  catch(error){if(error.code==='ENOENT')return;throw error;}
  throw new Error('V1 is frozen. Create a new explicit version; legacy files must not be overwritten.');
}
export async function reviewedInput() {
  const manifestBytes=await fs.readFile(new URL(`${revision}.manifest.json`,directory));
  const manifest=JSON.parse(manifestBytes);
  const bytes=await fs.readFile(new URL(`${revision}.records.json`,directory));
  const pins=await fs.readFile(new URL('identity-pins.json',directory));
  if(manifest.version!==revision || manifest.records_file!==`${revision}.records.json`
    ||sha256(bytes)!==manifest.files[manifest.records_file]||sha256(pins)!==manifest.pins_sha256)
    throw new Error('Frozen input checksum mismatch');
  return {records:JSON.parse(bytes),pins:JSON.parse(pins),manifest,manifestSha256:sha256(manifestBytes)};
}
