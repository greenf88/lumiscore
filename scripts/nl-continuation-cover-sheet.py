"""Internal inspection sheet; transport/decode does not approve book identity."""
import json,hashlib,math,sys
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
base=Path(__file__).resolve().parents[1]
root=base/'catalog/nl-continuation-20261103'
cache=base/'.research-cache/nl-continuation-20261103/covers'
manifest=sys.argv[1] if len(sys.argv)>1 else 'cover-archive-request.json'
if '/' in manifest or '\\' in manifest or not manifest.endswith('.json'):raise ValueError('Named local manifest required')
targets=json.loads((root/manifest).read_text(encoding='utf8'))['targets']
items=[]
for t in targets:
    p=cache/f"{t['coverId']}-L.jpg"
    if not p.exists():continue
    raw=p.read_bytes();r=json.loads((root/f"cover-{t['coverId']}.json").read_text(encoding='utf8'))
    if hashlib.sha256(raw).hexdigest()!=r['sha256']:raise ValueError('Changed image')
    with Image.open(p) as im:im.load();items.append({**t,'dimensions':list(im.size),'bytes':len(raw),'decoded':True})
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',15)
for start in range(0,len(items),8):
    chunk=items[start:start+8];sheet=Image.new('RGB',(1200,520*math.ceil(len(chunk)/4)),(245,245,245));d=ImageDraw.Draw(sheet)
    for i,t in enumerate(chunk):
        x=i%4*300;y=i//4*520
        d.text((x+5,y+4),f"{t['caseNumber']} | {t['coverId']}",font=font,fill='black')
        d.text((x+5,y+25),t['title'][:31],font=font,fill='black')
        d.text((x+5,y+46),' / '.join(t['isbn13']),font=font,fill='black')
        with Image.open(cache/f"{t['coverId']}-L.jpg") as im:
            im=im.convert('RGB');im.thumbnail((284,440));sheet.paste(im,(x+(300-im.width)//2,y+70))
    out=cache/f"{Path(manifest).stem}-sheet-{start//8+1:03}.jpg";sheet.save(out,quality=90);print(str(out))
(root/'cover-decode-current.json').write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
