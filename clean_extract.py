import zipfile
import xml.etree.ElementTree as ET
import re

z = zipfile.ZipFile(r'E:\prod.cor3us\FINAL_FINAL_GERÇEKTENSON_v27.docx')
xml_content = z.read('word/document.xml').decode('utf-8')

# Remove XML tags
text = re.sub(r'<[^>]+>', '\n', xml_content)
# Remove multiple newlines
text = re.sub(r'\n+', '\n', text)

lines = text.split('\n')
counter = 1
out = []
for l in lines:
    l = l.strip()
    # If it starts with 1. İÇ. or just İÇ.
    # We remove the leading numbers if any
    l = re.sub(r'^\d+\.\s*', '', l)
    
    if re.match(r'^(İÇ|DIŞ|INT|EXT)\.?\s+', l):
        l = l + f' #SC-{counter:03d}#'
        counter += 1
    out.append(l)

final_text = '\n'.join(out)
with open(r'E:\prod.cor3us\release\01_story\source\screenplay.fountain', 'w', encoding='utf-8') as f:
    f.write(final_text)
