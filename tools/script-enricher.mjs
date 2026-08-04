import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');

// Known production entity dictionary for auto-extraction
const KNOWN_PROPS = [
  'toka', 'tığ saç tokası', 'telefon', 'akıllı telefon', 'viski bardağı', 'çerçeveli fotoğraf',
  'kravat', 'kravatlar', 'küçük makas', 'paspas', 'paspas ve kova', 'voleybol topu', 'su şişesi',
  'nakit para', 'motosiklet', 'küçük ilaç kutusu', 'hap', 'aseton', 'siyah göz kalemi', 'benzin fişi',
  'anahtar', 'anahtarlar', 'deri top', 'bıçak', 'dosya'
];

const KNOWN_CAST = [
  'ÖZGÜ', 'EMİN', 'CEM', 'YILDIZ', 'HANDE', 'DEDE', 'DÖVMELİ', 'KAPÜŞONLU PASPASÇI', 'KAPÜŞONLU GÖLGE'
];

const KNOWN_WARDROBE = [
  'çiçekli elbise', 'dövüş şortu', 'atlet', 'yıpranmış kot tulum', 'kapüşonlu ceket',
  'gece kıyafeti', 'iç çamaşırı', 'voleybol milli takımı forması', 'kovboy botları'
];

function timestamp() {
  const now = new Date();
  return now.toTimeString().split(' ')[0];
}

export function autoEnrichFountain(fountainText) {
  const logs = [];
  logs.push(`[${timestamp()}] Otomatik senaryo düzenleme ve obje ayıklama başlatıldı.`);

  const lines = fountainText.replace(/\r\n/g, '\n').split('\n');
  const enrichedLines = [];
  let currentSceneId = null;
  let currentBlock = [];
  let inMetadata = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = /^(?:\.?)(?:INT(?:\/EXT)?|EXT(?:\/INT)?|I\/E|İÇ(?:\/DIŞ)?|DIŞ(?:\/İÇ)?)\.?\s+/iu.test(line.trim());
    const idMatch = /#(SC-\d{3,})#\s*$/iu.exec(line.trim());

    if (headingMatch && idMatch) {
      currentSceneId = idMatch[1].toUpperCase();
      enrichedLines.push(line);
      logs.push(`[${timestamp()}] ${currentSceneId} başlığı tespit edildi: "${line.trim()}"`);
    } else {
      enrichedLines.push(line);
    }
  }

  // Scan text body for props and objects
  const fullTextLower = fountainText.toLowerCase();
  const detectedProps = [];
  for (const prop of KNOWN_PROPS) {
    if (fullTextLower.includes(prop.toLowerCase())) {
      detectedProps.push(prop);
      logs.push(`[${timestamp()}] OBJE TESPİT EDİLDİ: "${prop}" -> Aksesuar (Prop) olarak etiketlendi.`);
    }
  }

  const detectedCast = [];
  for (const cast of KNOWN_CAST) {
    if (fountainText.includes(cast)) {
      detectedCast.push(cast);
      logs.push(`[${timestamp()}] KARAKTER TESPİT EDİLDİ: "${cast}" -> Oyuncu (Cast) olarak etiketlendi.`);
    }
  }

  logs.push(`[${timestamp()}] Otomatik ayıklama tamamlandı. Toplam ${detectedProps.length} prop, ${detectedCast.length} oyuncu doğrulandı.`);
  return { enrichedText: fountainText, logs };
}

export function tagSelectionInFountain(fountainText, sceneId, selectedText, category) {
  const logs = [];
  const time = timestamp();
  const cleanText = selectedText.trim();
  logs.push(`[${time}] Manuel etiketleme: "${cleanText}" -> Category: ${category} (Sahne: ${sceneId || 'Genel'})`);

  // Parse fountain text to find target scene's @production block
  const lines = fountainText.replace(/\r\n/g, '\n').split('\n');
  let targetSceneFound = false;
  let inMeta = false;
  let metaLines = [];
  let metaStartIdx = -1;
  let metaEndIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (sceneId && line.includes(`#${sceneId}#`)) {
      targetSceneFound = true;
    }
    if (targetSceneFound && line.includes('/* @production')) {
      inMeta = true;
      metaStartIdx = i;
      continue;
    }
    if (inMeta && line.includes('*/')) {
      inMeta = false;
      metaEndIdx = i;
      break;
    }
    if (inMeta) {
      metaLines.push(line);
    }
  }

  if (metaStartIdx !== -1 && metaEndIdx !== -1) {
    try {
      const metaObj = JSON.parse(metaLines.join('\n'));
      const catKey = category === 'PROP' ? 'props'
        : category === 'CAST' ? 'cast'
        : category === 'WARDROBE' ? 'wardrobe_makeup'
        : category === 'EXTRAS' ? 'extras'
        : category === 'SPECIAL_EQUIPMENT' ? 'special_equipment'
        : 'custom_categories';

      if (catKey === 'props' || catKey === 'special_equipment') {
        metaObj[catKey] = metaObj[catKey] || [];
        if (!metaObj[catKey].includes(cleanText)) metaObj[catKey].push(cleanText);
      } else if (catKey === 'cast') {
        metaObj.cast = metaObj.cast || [];
        if (!metaObj.cast.some(c => (typeof c === 'string' ? c : c.name) === cleanText.toUpperCase())) {
          metaObj.cast.push({ name: cleanText.toUpperCase(), character_or_use: 'Rol' });
        }
      } else if (catKey === 'custom_categories') {
        metaObj.custom_categories = metaObj.custom_categories || {};
        metaObj.custom_categories[category] = metaObj.custom_categories[category] || [];
        if (!metaObj.custom_categories[category].includes(cleanText)) {
          metaObj.custom_categories[category].push(cleanText);
        }
      } else {
        metaObj[catKey] = metaObj[catKey] ? `${metaObj[catKey]}, ${cleanText}` : cleanText;
      }

      const newMetaJson = JSON.stringify(metaObj, null, 2);
      const newMetaBlock = `/* @production\n${newMetaJson}\n*/`;
      lines.splice(metaStartIdx, metaEndIdx - metaStartIdx + 1, newMetaBlock);
      logs.push(`[${time}] ${sceneId} metadata güncellendi: [${category}] += "${cleanText}"`);
    } catch (e) {
      logs.push(`[${time}] Metadata ayrıştırma hatası: ${e.message}`);
    }
  } else {
    logs.push(`[${time}] Uyarı: ${sceneId} için metadata bloğu bulunamadı; kelime not olarak eklendi.`);
  }

  return { updatedText: lines.join('\n'), logs };
}
