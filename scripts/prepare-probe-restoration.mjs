import{readFile,writeFile}from'node:fs/promises';
const text=await readFile('outputs/metadata-20261108/final-probe-corrected-receipt.json','utf8');
const receipt=JSON.parse(text.slice(text.indexOf('{'),text.lastIndexOf('}')+1)).rows[0].json_build_object;
let sql=await readFile('docs/public-metadata-20261108/test-restore.sql','utf8');
sql=sql.replaceAll("binding_hash=repeat('a',64)",()=>"binding_hash='"+receipt.snapshot.binding+"'")
 .replaceAll("repeat('a',64),'2026-11-08T12:25:55.924017Z'",()=>"'"+receipt.snapshot.binding+"','"+receipt.snapshot.fetched+"'")
 .replace("fetched_at='2026-11-08T12:25:55.924017Z'",()=>"fetched_at='"+receipt.snapshot.fetched+"'")
 .replace("content_changed_at='2026-11-08T12:25:55.924017Z'",()=>"content_changed_at='"+receipt.revision.changedAt+"'")
 .replace("md5(text)='75700b213e86be189f968b744cfde027'",()=>"md5(text)='"+receipt.snapshot.textHash+"'")
 .replace("language='eng'","language='en_US'");
await writeFile('outputs/metadata-20261108/final-restore.sql',sql);
