import re
text = open(r'E:\prod.cor3us\release\01_story\source\screenplay.fountain', encoding='utf-8').read()
lines = text.split('\n')
counter = 1
out = []
for l in lines:
    if re.match(r'^(İÇ|DIŞ|INT|EXT)\.?\s+', l.strip()):
        l = l.strip() + f' #SC-{counter:03d}#'
        counter += 1
    out.append(l)
open(r'E:\prod.cor3us\release\01_story\source\screenplay.fountain', 'w', encoding='utf-8').write('\n'.join(out))
