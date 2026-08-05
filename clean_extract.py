import zipfile
import xml.etree.ElementTree as ET
import re
import os

base_dir = os.path.dirname(os.path.abspath(__file__))
docx_path = os.path.join(base_dir, 'FINAL_FINAL_GERÇEKTENSON_v27.docx')

z = zipfile.ZipFile(docx_path)
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
out_path = os.path.join(base_dir, '01_story', 'source', 'screenplay.fountain')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(final_text)
