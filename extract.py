import zipfile
import xml.etree.ElementTree as ET
import re

def extract_docx():
    z = zipfile.ZipFile(r'E:\prod.cor3us\FINAL_FINAL_GERÇEKTENSON_v27.docx')
    xml_content = z.read('word/document.xml').decode('utf-8')
    text = re.sub(r'<[^>]+>', '\n', xml_content)
    text = re.sub(r'\n+', '\n', text)
    with open(r'E:\prod.cor3us\release\01_story\source\screenplay.fountain', 'w', encoding='utf-8') as f:
        f.write(text)

extract_docx()
