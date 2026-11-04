"""Read-only source PDF extraction. Originals stay in ignored research cache."""
import json
from pathlib import Path
import pdfplumber
base=Path(__file__).resolve().parents[1]
manifest=json.loads((base/'catalog/nl-scale-20261102/sources/cpnb-download-manifest.json').read_text(encoding='utf8'))
out=base/'outputs/nl-scale-20261102/cpnb'
out.mkdir(parents=True,exist_ok=True)
for d in manifest['documents']:
    if d['status']!=200: continue
    target=out/f"{d['year']}-{d['signal']}.json"
    if target.exists(): continue
    source=base/'.research-cache/nl-scale-20261102/cpnb'/d['cacheFile']
    with pdfplumber.open(source) as pdf:
        pages=[]
        for number,page in enumerate(pdf.pages,1):
            pages.append({'page':number,'text':page.extract_text(x_tolerance=2,y_tolerance=3),'words':page.extract_words()})
        if d['year']==2025: pdf.pages[0].to_image(resolution=110).save(out/f"{d['signal']}-2025-page1.png")
    target.write_text(json.dumps({'source':d,'pages':pages},ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({'year':d['year'],'signal':d['signal'],'pages':len(pages),'characters':sum(len(p['text']or'') for p in pages)}))
    if d['year']==2025: print((pages[0]['text']or'')[:3000])
