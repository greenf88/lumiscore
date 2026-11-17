import type { Locale } from '../i18n/config.ts';
export type SharePortrait = { title: string; image: string; bars: {label:string;score:number}[]; locale: Locale };
/** Export only the chosen character and supported preferences. No account data,
 * reading history, answer payloads or private profile URL enters the image. */
export async function renderSharePortrait(portrait: SharePortrait): Promise<Blob> {
  const image = new Image(); image.src = portrait.image;
  await image.decode();
  await document.fonts.ready;
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#fff8ed'; ctx.fillRect(0,0,1080,1350);
  ctx.drawImage(image,290,35,500,500);
  ctx.textAlign = 'center'; ctx.fillStyle = '#42646a'; ctx.font = '600 27px sans-serif';
  ctx.fillText(portrait.locale === 'nl' ? 'MIJN LEESPERSONAGE' : 'MY READING CHARACTER',540,565);
  ctx.fillStyle = '#282a28'; ctx.font = 'bold 61px Georgia, serif';
  const lines: string[] = []; let line = '';
  for (const word of portrait.title.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > 900 && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  lines.forEach((text,index) => ctx.fillText(text,540,645+index*68));
  ctx.textAlign = 'left';
  const start = Math.max(790,645+lines.length*68+35);
  portrait.bars.slice(0,5).forEach((bar,index) => {
    const y = start+index*79;
    ctx.font = '30px sans-serif'; ctx.fillStyle='#33494c'; ctx.fillText(bar.label,105,y);
    ctx.fillStyle='#e7dfd3'; ctx.beginPath(); ctx.roundRect(105,y+15,870,13,7); ctx.fill();
    ctx.fillStyle=index === 0 ? '#b37b32' : '#42646a'; ctx.beginPath(); ctx.roundRect(105,y+15,870*Math.max(0,Math.min(100,bar.score))/100,13,7); ctx.fill();
  });
  ctx.textAlign='center'; ctx.fillStyle='#42646a'; ctx.font='bold 36px Georgia, serif'; ctx.fillText('LumiScore',540,1260);
  ctx.font='24px sans-serif';ctx.fillText(portrait.locale==='nl'?'Ontdek jouw leessmaak · lumisco.re':'Discover your reading taste · lumisco.re',540,1303);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Export unavailable')),'image/png'));
}
