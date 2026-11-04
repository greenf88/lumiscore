"""Original typographic social assets. No external images, scores or personal data."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parent.parent/'public/images/editorial'
font=Path('C:/Windows/Fonts/georgia.ttf')
sans=Path('C:/Windows/Fonts/arial.ttf')
assets=[
 ('suzanne-vermeer-nl.png','BOEKEN EN LEESTIPS',['Suzanne Vermeer','Waar wil je beginnen?'],'Kies een verhaal. Ontdek de boeken.'),
 ('fantasy-om-mee-te-beginnen-nl.png','REDACTIONELE LEESROUTE',['Fantasy voor beginners','Kies je eerste boek'],'Avontuur, verhalen of romantiek.'),
 ('na-project-hail-mary-nl.png','REDACTIONELE LEESROUTE',['Wat lees je na','Project Hail Mary?'],'Ruimtevaart, puzzels en eerste contact.'),
]
for filename,eyebrow,lines,sub in assets:
 image=Image.new('RGB',(1200,630),'#f4efe6');draw=ImageDraw.Draw(image)
 draw.rectangle((0,0,20,630),fill='#42646b')
 draw.text((75,60),'LumiScore',font=ImageFont.truetype(font,33),fill='#1f2328')
 draw.text((75,155),eyebrow,font=ImageFont.truetype(sans,22),fill='#42646b')
 for n,line in enumerate(lines):draw.text((75,220+n*85),line,font=ImageFont.truetype(font,58),fill='#1f2328')
 draw.text((75,465),sub,font=ImageFont.truetype(sans,29),fill='#536164')
 draw.text((75,555),'lumisco.re',font=ImageFont.truetype(sans,22),fill='#42646b')
 image.save(root/filename,optimize=True)
 print(filename,(root/filename).stat().st_size)
