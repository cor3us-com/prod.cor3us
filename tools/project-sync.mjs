#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { watch as fsWatch } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  asNumber,
  blankRow,
  changedRows,
  csvValue,
  entitySignatures,
  hashText,
  intersects,
  mergeNote,
  nextId,
  normalizeKey,
  readCsv,
  roundMoney,
  serializeCsv,
  splitIds,
  unique,
} from './production-io.mjs';
import {
  loadVersionRegistry,
  resolveActivePath,
  snapshotTrackedFiles,
} from './version-manager.mjs';

const execFileAsync = promisify(execFile);
const VERSION = '1.0.0';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const SCREENPLAY = path.join(ROOT, '01_story', 'source', 'screenplay.fountain');
const STATE = path.join(ROOT, 'schema', 'sync-state.json');
const GRAPH = path.join(ROOT, 'schema', 'dependency-graph.json');
const REPORT = path.join(ROOT, '00_admin', 'LAST_SYNC_REPORT.md');
const HISTORY = path.join(ROOT, '00_admin', 'sync-history.jsonl');
const BACKUPS = path.join(ROOT, '09_draft', 'backups');
const DRAFT_INBOX = path.join(ROOT, '09_draft', 'inbox');
const DRAFT_PROCESSOR = path.join(ROOT, 'tools', 'draft-ingest.mjs');

const FILES = {
  scenes: path.join(ROOT, '02_breakdown', 'sequential_breakdown.csv'),
  locations: path.join(ROOT, '02_breakdown', 'location_index.csv'),
  elements: path.join(ROOT, '02_breakdown', 'elements_breakdown.csv'),
  shots: path.join(ROOT, '02_breakdown', 'shot_list.csv'),
  schedule: path.join(ROOT, '03_schedule', 'shooting_schedule.csv'),
  budget: path.join(ROOT, '04_budget', 'budget.csv'),
  research: path.join(ROOT, '05_research', 'research_log.csv'),
  evidence: path.join(ROOT, '05_research', 'evidence_register.csv'),
};

const GENERATED = {
  scenes: path.join(ROOT, '02_breakdown', 'SEQUENTIAL_BREAKDOWN.generated.md'),
  locations: path.join(ROOT, '02_breakdown', 'LOCATION_INDEX.generated.md'),
  budget: path.join(ROOT, '04_budget', 'BUDGET_SUMMARY.generated.md'),
};

const ID_PATTERNS = {
  scene: /^SC-\d{3,}$/,
  location: /^LOC-\d{3,}$/,
  element: /^EL-\d{3,}$/,
};

function parseArgs(argv) {
  const args = { apply: false, help: false, screenplay: null, trigger: 'manual', watch: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--apply') args.apply = true;
    else if (token === '--watch') args.watch = true;
    else if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--trigger') args.trigger = argv[++index] || 'manual';
    else if (token === '--screenplay') args.screenplay = argv[++index] || null;
    else throw new Error('Bilinmeyen seçenek: ' + token);
  }
  if (args.screenplay && args.apply) throw new Error('Alternatif senaryo yalnız önizlenebilir.');
  return args;
}

function printHelp() {
  console.log([
    'Kısa Film Proje Senkronizasyonu v' + VERSION,
    '',
    'Önizleme: node tools/project-sync.mjs',
    'Uygulama: node tools/project-sync.mjs --apply --trigger manual',
    'Sürekli izleme: node tools/project-sync.mjs --watch --apply',
    'Örnek: node tools/project-sync.mjs --screenplay 01_story/examples/screenplay.fountain',
  ].join('\n'));
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function rel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function assertInside(candidate) {
  const relative = path.relative(ROOT, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Dosya proje dışında: ' + candidate);
}

function cloneRows(table) {
  return table.rows.map((row) => ({ ...row }));
}

function isHeading(line) {
  return /^(?:\.?)(?:INT(?:\/EXT)?|EXT(?:\/INT)?|I\/E|İÇ(?:\/DIŞ)?|DIŞ(?:\/İÇ)?)\.?\s+/iu.test(line.trim());
}

function parseHeading(raw) {
  const heading = raw.replace(/\s+#SC-\d{3,}#\s*$/iu, '').replace(/^\./, '').trim();
  const match = /^(INT\/EXT|EXT\/INT|INT|EXT|I\/E|İÇ\/DIŞ|DIŞ\/İÇ|İÇ|DIŞ)\.?\s+/iu.exec(heading);
  if (!match) throw new Error('Sahne başlığı çözümlenemedi: ' + raw);
  const prefix = match[1].toLocaleUpperCase('tr-TR');
  const parts = heading.slice(match[0].length).split(/\s+[-–—]\s+/).map((item) => item.trim()).filter(Boolean);
  const locationName = parts[0] || 'TBD';
  const storyTime = parts.slice(1).join(' - ') || 'TBD';
  const timeKey = normalizeKey(storyTime);
  let dayNight = 'TBD';
  if (/(GECE|NIGHT)/.test(timeKey)) dayNight = 'NIGHT';
  else if (/(GUNDUZ|DAY|SABAH|MORNING|OGLE|NOON)/.test(timeKey)) dayNight = 'DAY';
  else if (/(AKSAM|EVENING|DUSK)/.test(timeKey)) dayNight = 'MIXED';
  let intExt = 'INT/EXT';
  if (prefix === 'INT' || prefix === 'İÇ') intExt = 'INT';
  if (prefix === 'EXT' || prefix === 'DIŞ') intExt = 'EXT';
  return { dayNight, heading, intExt, locationName, storyTime };
}

function parseMetadata(block, sceneId) {
  const match = /\/\*\s*@production\s*([\s\S]*?)\*\//iu.exec(block);
  if (!match) return {};
  try {
    return JSON.parse(match[1].trim());
  } catch (error) {
    throw new Error(sceneId + ' production metadata hatası: ' + error.message);
  }
}

function parseFountain(text) {
  const rawScenes = [];
  let current = null;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (isHeading(line)) {
      if (current) rawScenes.push(current);
      const idMatch = /#(SC-\d{3,})#\s*$/iu.exec(line.trim());
      if (!idMatch) throw new Error('Sahne kimliği eksik. Başlık sonuna #SC-001# ekleyin: ' + line.trim());
      current = { block: [], rawHeading: line.trim(), sceneId: idMatch[1].toUpperCase() };
    } else if (current) {
      current.block.push(line);
    }
  }
  if (current) rawScenes.push(current);
  if (!rawScenes.length) throw new Error('Senaryoda sahne başlığı bulunamadı.');
  const ids = rawScenes.map((scene) => scene.sceneId);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) throw new Error('Tekrarlanan sahne kimliği: ' + unique(duplicates).join(', '));
  return rawScenes.map((scene, index) => ({
    ...scene,
    ...parseHeading(scene.rawHeading),
    metadata: parseMetadata(scene.block.join('\n'), scene.sceneId),
    seqNo: index + 1,
  }));
}

function stateChanges(table, key, prior) {
  const current = entitySignatures(table, key);
  const ids = new Set([...Object.keys(prior || {}), ...Object.keys(current)]);
  return new Set([...ids].filter((id) => prior?.[id] !== current[id]));
}

function resolveLocation(scene, table, usedIds) {
  const requestedId = csvValue(scene.metadata.location_id);
  if (requestedId && !ID_PATTERNS.location.test(requestedId)) throw new Error(scene.sceneId + ' geçersiz location_id: ' + requestedId);
  const requestedName = csvValue(scene.metadata.location_name) || scene.locationName;
  let row = requestedId ? table.rows.find((item) => item.location_id === requestedId) : null;
  if (!row) row = table.rows.find((item) => normalizeKey(item.location_name) === normalizeKey(requestedName));
  if (!row) {
    row = blankRow(table.headers);
    row.location_id = requestedId || nextId('LOC', usedIds);
    row.permission_status = 'UNKNOWN';
    row.recce_status = 'TBD';
    row.status = 'DRAFT';
    row.notes = 'source=screenplay';
    table.rows.push(row);
  }
  row.location_name = requestedName;
  row.int_ext ||= scene.intExt;
  row.day_night ||= scene.dayNight;
  row.notes = mergeNote(row.notes, 'source=screenplay');
  return row.location_id;
}

function elementInputs(metadata) {
  const definitions = [
    ['cast', 'CAST', 'CAST'],
    ['props', 'PROP', 'ART'],
    ['wardrobe_makeup', 'WARDROBE_MAKEUP', 'WARDROBE_MAKEUP'],
    ['set_dressing', 'SET_DRESSING', 'ART'],
    ['vehicles_animals', 'VEHICLE_ANIMAL', 'PRODUCTION'],
    ['special_equipment', 'SPECIAL_EQUIPMENT', 'CAMERA_GRIP'],
  ];
  const values = [];
  for (const [field, elementType, department] of definitions) {
    const rawList = metadata[field] === undefined ? [] : Array.isArray(metadata[field]) ? metadata[field] : [metadata[field]];
    for (const raw of rawList) {
      const item = typeof raw === 'string' ? { name: raw } : raw;
      if (!item || !csvValue(item.name)) throw new Error(field + ' elemanında name zorunlu.');
      values.push({ field, item: { department, element_type: elementType, ...item } });
    }
  }
  return values;
}

function resolveElements(scene, table, usedIds, links) {
  const fields = { cast_ids: [], props: [], wardrobe_makeup: [], set_dressing: [], vehicles_animals: [], special_equipment: [] };
  for (const input of elementInputs(scene.metadata)) {
    const item = input.item;
    const requestedId = csvValue(item.element_id);
    if (requestedId && !ID_PATTERNS.element.test(requestedId)) throw new Error(scene.sceneId + ' geçersiz element_id: ' + requestedId);
    let row = requestedId ? table.rows.find((entry) => entry.element_id === requestedId) : null;
    if (!row) {
      row = table.rows.find((entry) =>
        normalizeKey(entry.element_type) === normalizeKey(item.element_type)
        && normalizeKey(entry.name) === normalizeKey(item.name),
      );
    }
    if (!row) {
      row = blankRow(table.headers);
      row.element_id = requestedId || nextId('EL', usedIds);
      row.status = 'DRAFT';
      row.notes = 'source=screenplay';
      table.rows.push(row);
    }
    for (const header of table.headers) if (item[header] !== undefined) row[header] = csvValue(item[header]);
    row.element_type = item.element_type;
    row.name = csvValue(item.name);
    row.department ||= item.department;
    row.notes = mergeNote(row.notes, 'source=screenplay');
    if (!links.has(row.element_id)) links.set(row.element_id, []);
    links.get(row.element_id).push(scene.sceneId);
    if (input.field === 'cast') fields.cast_ids.push(row.element_id);
    else fields[input.field].push(row.name);
  }
  return Object.fromEntries(Object.entries(fields).map(([key, list]) => [key, unique(list).join(',')]));
}

function syncFromScreenplay(parsed, tables, warnings) {
  const before = {
    scenes: cloneRows(tables.scenes),
    locations: cloneRows(tables.locations),
    elements: cloneRows(tables.elements),
  };
  const locationIds = new Set(tables.locations.rows.map((row) => row.location_id).filter(Boolean));
  const elementIds = new Set(tables.elements.rows.map((row) => row.element_id).filter(Boolean));
  const scenesByLocation = new Map();
  const scenesByElement = new Map();
  const activeScenes = new Set();

  for (const scene of parsed) {
    if (!ID_PATTERNS.scene.test(scene.sceneId)) throw new Error('Geçersiz scene_id: ' + scene.sceneId);
    activeScenes.add(scene.sceneId);
    const locationId = resolveLocation(scene, tables.locations, locationIds);
    if (!scenesByLocation.has(locationId)) scenesByLocation.set(locationId, []);
    scenesByLocation.get(locationId).push(scene.sceneId);
    const elementFields = resolveElements(scene, tables.elements, elementIds, scenesByElement);
    let row = tables.scenes.rows.find((item) => item.scene_id === scene.sceneId);
    const isNew = !row;
    if (!row) {
      row = blankRow(tables.scenes.headers);
      row.scene_id = scene.sceneId;
      row.status = 'DRAFT';
      row.notes = 'source=screenplay';
      tables.scenes.rows.push(row);
    }
    const sourceBefore = JSON.stringify([
      row.seq_no, row.scene_heading, row.int_ext, row.location_id, row.story_time,
      row.day_night, row.cast_ids, row.props, row.wardrobe_makeup, row.set_dressing,
      row.vehicles_animals, row.special_equipment,
    ]);
    row.seq_no = csvValue(scene.seqNo);
    row.scene_heading = scene.heading;
    row.int_ext = csvValue(scene.metadata.int_ext) || scene.intExt;
    row.location_id = locationId;
    row.story_time = csvValue(scene.metadata.story_time) || scene.storyTime;
    row.day_night = csvValue(scene.metadata.day_night) || scene.dayNight;
    Object.assign(row, elementFields);
    row.extras = csvValue(scene.metadata.extras ?? row.extras);
    for (const header of tables.scenes.headers) {
      if (scene.metadata[header] !== undefined && !['location_id', 'location_name'].includes(header)) {
        row[header] = csvValue(scene.metadata[header]);
      }
    }
    row.notes = mergeNote(row.notes, 'source=screenplay');
    const sourceAfter = JSON.stringify([
      row.seq_no, row.scene_heading, row.int_ext, row.location_id, row.story_time,
      row.day_night, row.cast_ids, row.props, row.wardrobe_makeup, row.set_dressing,
      row.vehicles_animals, row.special_equipment,
    ]);
    if (!isNew && sourceBefore !== sourceAfter) {
      row.status = 'REVIEW';
      row.notes = mergeNote(row.notes, 'source_changed=screenplay');
    }
  }

  for (const row of tables.locations.rows) {
    if (!row.notes.includes('source=screenplay') && !scenesByLocation.has(row.location_id)) continue;
    const next = unique(scenesByLocation.get(row.location_id) || []).join(',');
    if (row.scene_ids !== next) row.scene_ids = next;
    if (!next) {
      row.status = 'REVIEW';
      row.notes = mergeNote(row.notes, 'source_orphaned=screenplay');
    }
  }
  for (const row of tables.elements.rows) {
    if (!row.notes.includes('source=screenplay') && !scenesByElement.has(row.element_id)) continue;
    const next = unique(scenesByElement.get(row.element_id) || []).join(',');
    if (row.scene_ids !== next) row.scene_ids = next;
    if (!next) {
      row.status = 'REVIEW';
      row.notes = mergeNote(row.notes, 'source_orphaned=screenplay');
    }
  }
  for (const row of tables.scenes.rows) {
    if (row.notes.includes('source=screenplay') && !activeScenes.has(row.scene_id)) {
      row.status = 'REVIEW';
      row.notes = mergeNote(row.notes, 'source_removed=screenplay');
      warnings.push(row.scene_id + ' kaynak senaryodan çıktı; kayıt korunarak REVIEW yapıldı.');
    }
  }
  return before;
}

function propagate(tables, changedScenes, changedLocations, manualBudget, trigger, warnings) {
  const before = {
    shots: cloneRows(tables.shots),
    schedule: cloneRows(tables.schedule),
    budget: cloneRows(tables.budget),
    research: cloneRows(tables.research),
    evidence: cloneRows(tables.evidence),
    locations: cloneRows(tables.locations),
  };
  const note = 'dependency_changed=' + trigger;
  const locationNames = new Map(tables.locations.rows.map((row) => [row.location_id, row.location_name]));
  const totalShootDays = Math.max(1, tables.schedule.rows.length);

  for (const row of tables.shots.rows) {
    if (changedScenes.has(row.scene_id)) {
      row.status = 'REVIEW';
      row.notes = mergeNote(row.notes, note);
    }
  }
  for (const row of tables.budget.rows) {
    if ((row.unit === 'day' || row.unit === 'Gün') && totalShootDays > 0) {
      row.quantity = csvValue(totalShootDays);
    }
    const quantity = asNumber(row.quantity, null);
    const unitCost = asNumber(row.unit_cost_try, null);
    let totalChanged = false;
    if (quantity !== null && unitCost !== null) {
      const subtotal = roundMoney(quantity * unitCost);
      const contingency = roundMoney(subtotal * asNumber(row.contingency_pct, 0) / 100);
      const total = roundMoney(subtotal + contingency);
      totalChanged = csvValue(row.total_try) !== csvValue(total);
      row.subtotal_try = csvValue(subtotal);
      row.contingency_try = csvValue(contingency);
      row.total_try = csvValue(total);
    }
    if (totalChanged || manualBudget.has(row.budget_item_id) || intersects(row.scene_ids, changedScenes) || changedLocations.has(row.location_id)) {
      if (row.approval_status === 'APPROVED') warnings.push(row.budget_item_id + ' için bütçe onayı yeniden gerekli.');
      row.approval_status = 'NEEDS_APPROVAL';
      row.notes = mergeNote(row.notes, note);
    }
  }
  const locationTotals = new Map();
  for (const row of tables.budget.rows) {
    if (row.location_id) locationTotals.set(row.location_id, roundMoney((locationTotals.get(row.location_id) || 0) + asNumber(row.total_try, 0)));
  }
  for (const row of tables.locations.rows) {
    if (locationTotals.has(row.location_id)) row.cost_estimate_try = csvValue(locationTotals.get(row.location_id));
  }
  for (const id of changedRows(before.locations, tables.locations.rows, tables.locations.headers, 'location_id')) changedLocations.add(id);
  for (const row of tables.schedule.rows) {
    if (intersects(row.scene_ids, changedScenes) || changedLocations.has(row.location_id)) {
      row.status = 'REVIEW';
      row.notes = mergeNote(row.notes, note);
      if (locationNames.has(row.location_id)) row.location_name = locationNames.get(row.location_id);
    }
  }
  for (const row of tables.research.rows) {
    if (intersects(row.scene_ids, changedScenes) || intersects(row.location_ids, changedLocations)) {
      row.status = 'REVIEW';
      row.limitations = mergeNote(row.limitations, note);
    }
  }
  for (const row of tables.evidence.rows) {
    if (intersects(row.relevance_to_scene, changedScenes)) {
      row.review_status = 'REVIEW';
      row.notes = mergeNote(row.notes, note);
    }
  }
  return before;
}

function validate(tables) {
  const warnings = [];
  const sceneIds = new Set(tables.scenes.rows.map((row) => row.scene_id).filter(Boolean));
  const locationIds = new Set(tables.locations.rows.map((row) => row.location_id).filter(Boolean));
  for (const row of tables.scenes.rows) if (row.location_id && !locationIds.has(row.location_id)) warnings.push(row.scene_id + ' bilinmeyen mekana bağlı.');
  for (const row of tables.shots.rows) if (row.scene_id && !sceneIds.has(row.scene_id)) warnings.push(row.shot_id + ' bilinmeyen sahneye bağlı.');
  for (const row of [...tables.schedule.rows, ...tables.budget.rows]) {
    for (const id of splitIds(row.scene_ids)) if (!sceneIds.has(id)) warnings.push((row.shoot_day_id || row.budget_item_id) + ' bilinmeyen sahneye bağlı: ' + id);
    if (row.location_id && !locationIds.has(row.location_id)) warnings.push((row.shoot_day_id || row.budget_item_id) + ' bilinmeyen mekana bağlı.');
  }
  return unique(warnings);
}

function md(value) {
  return csvValue(value).replaceAll('|', '\\|').replace(/\r?\n/g, '<br>');
}

function resolveElementNames(castIdsStr, elementsTable) {
  if (!castIdsStr) return '';
  const elMap = new Map((elementsTable?.rows || []).map(r => [r.element_id, r.name]));
  const ids = castIdsStr.split(',').map(s => s.trim()).filter(Boolean);
  return ids.map(id => elMap.get(id) || id).join(', ');
}

function resolveLocationName(locId, locationsTable) {
  if (!locId) return '';
  const locRow = (locationsTable?.rows || []).find(r => r.location_id === locId);
  return locRow ? locRow.location_name : locId;
}

function renderScenes(table, elementsTable, locationsTable) {
  const lines = [
    '# Sıralı Döküm - Otomatik Görünüm',
    '',
    '| Sıra | Sahne | Başlık / Özet | Mekan | Sayfa | Oyuncular | Figüran | Aksesuar (Prop) | Kostüm & Makyaj | Özel Notlar | Durum |',
    '|---:|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const row of [...table.rows].sort((a, b) => asNumber(a.seq_no, 9999) - asNumber(b.seq_no, 9999))) {
    const castNames = resolveElementNames(row.cast_ids, elementsTable);
    const locName = resolveLocationName(row.location_id, locationsTable);
    lines.push('| ' + [
      row.seq_no,
      row.scene_id,
      (row.scene_heading + (row.scene_summary ? ' - ' + row.scene_summary : '')),
      locName,
      (row.script_page_count || row.script_page_start || '1/8'),
      castNames,
      row.extras,
      row.props,
      row.wardrobe_makeup,
      row.special_notes || row.camera_sound_notes || row.notes,
      row.status,
    ].map(md).join(' | ') + ' |');
  }
  if (!table.rows.length) lines.push('| - | - | Kaynak senaryo yok | - | - | - | - | - | - | - | DRAFT |');
  return lines.join('\n') + '\n';
}

function renderLocations(table) {
  const lines = ['# Mekan İndeksi - Otomatik Görünüm', '', '| Mekan | Ad | Sahneler | İzin | Recce | Maliyet TRY | Durum |', '|---|---|---|---|---|---:|---|'];
  for (const row of table.rows) lines.push('| ' + [row.location_id, row.location_name, row.scene_ids, row.permission_status, row.recce_status, row.cost_estimate_try, row.status].map(md).join(' | ') + ' |');
  if (!table.rows.length) lines.push('| - | Henüz mekan yok | - | UNKNOWN | TBD | - | DRAFT |');
  return lines.join('\n') + '\n';
}

function renderBudget(table) {
  const category = new Map();
  let total = 0;
  for (const row of table.rows) {
    const amount = asNumber(row.total_try, 0);
    total += amount;
    category.set(row.category || 'UNCATEGORIZED', (category.get(row.category || 'UNCATEGORIZED') || 0) + amount);
  }
  const lines = ['# Bütçe Özeti - Otomatik Görünüm', '', 'Genel toplam: ' + roundMoney(total) + ' TRY', '', '| Kategori | Toplam TRY |', '|---|---:|'];
  for (const [name, amount] of [...category.entries()].sort()) lines.push('| ' + md(name) + ' | ' + roundMoney(amount) + ' |');
  if (!category.size) lines.push('| - | 0 |');
  return lines.join('\n') + '\n';
}

function list(set) {
  return set.size ? [...set].sort().join(', ') : 'Yok';
}

function renderReport(context) {
  const lines = [
    '# Son Senkronizasyon Etki Raporu',
    '',
    '- Tarih: ' + context.timestamp,
    '- Tetikleyici: ' + context.trigger,
    '- Mod: ' + (context.apply ? 'APPLIED' : 'PREVIEW'),
    '- Senaryo: ' + context.screenplay,
    '',
    '## Etkilenen kayıtlar',
    '',
    '- Sahneler: ' + list(context.effects.scenes),
    '- Mekanlar: ' + list(context.effects.locations),
    '- Elemanlar: ' + list(context.effects.elements),
    '- Shot kayıtları: ' + list(context.effects.shots),
    '- Çekim günleri: ' + list(context.effects.schedule),
    '- Bütçe: ' + list(context.effects.budget),
    '- Araştırma: ' + list(context.effects.research),
    '- Kanıt: ' + list(context.effects.evidence),
    '',
    '## Güncellenen dosyalar',
    '',
  ];
  if (context.changedFiles.length) for (const file of context.changedFiles) lines.push('- ' + rel(file));
  else lines.push('- Üretim verisinde değişiklik yok.');
  lines.push('', '## Uyarılar', '');
  if (context.warnings.length) for (const warning of context.warnings) lines.push('- ' + warning);
  else lines.push('- Uyarı yok.');
  return lines.join('\n') + '\n';
}

async function readState() {
  return (await exists(STATE)) ? JSON.parse(await fs.readFile(STATE, 'utf8')) : null;
}

async function loadTables(registry, useActiveVersions) {
  const tables = {};
  for (const [name, file] of Object.entries(FILES)) {
    const active = useActiveVersions ? resolveActivePath(name, registry) : null;
    const source = active && await exists(active) ? active : file;
    const table = await readCsv(source);
    table.filePath = file;
    table.originalText = await fs.readFile(file, 'utf8');
    table.sourcePath = source;
    tables[name] = table;
  }
  return tables;
}

async function optionalText(file) {
  return (await exists(file)) ? fs.readFile(file, 'utf8') : '';
}

function makeState(tables, screenplayHash, timestamp) {
  return {
    schema_version: '1.0.0',
    processor_version: VERSION,
    last_sync: timestamp,
    screenplay_hash: screenplayHash,
    entity_signatures: {
      scene: entitySignatures(tables.scenes, 'scene_id'),
      location: entitySignatures(tables.locations, 'location_id'),
      element: entitySignatures(tables.elements, 'element_id'),
      shot: entitySignatures(tables.shots, 'shot_id'),
      schedule: entitySignatures(tables.schedule, 'shoot_day_id'),
      budget: entitySignatures(tables.budget, 'budget_item_id'),
      research: entitySignatures(tables.research, 'research_id'),
      evidence: entitySignatures(tables.evidence, 'evidence_id'),
    },
  };
}

async function buildPlan(args) {
  const inputVersions = args.apply
    ? await snapshotTrackedFiles('input:' + args.trigger)
    : { created: [], registry: await loadVersionRegistry() };
  const tables = await loadTables(inputVersions.registry, args.apply);
  const state = await readState();
  const warnings = [];
  const activeScreenplay = args.apply ? resolveActivePath('screenplay', inputVersions.registry) : null;
  const screenplayPath = args.screenplay
    ? path.resolve(ROOT, args.screenplay)
    : activeScreenplay && await exists(activeScreenplay) ? activeScreenplay : SCREENPLAY;
  assertInside(screenplayPath);
  const hasScreenplay = await exists(screenplayPath);
  const screenplayText = hasScreenplay ? await fs.readFile(screenplayPath, 'utf8') : '';
  const screenplayHash = hasScreenplay ? hashText(screenplayText) : null;
  const parsed = hasScreenplay ? parseFountain(screenplayText) : [];
  if (!hasScreenplay) warnings.push('Kanonik senaryo bulunamadı; sahne türetme adımı atlandı.');

  const manualLocations = stateChanges(tables.locations, 'location_id', state?.entity_signatures?.location);
  const manualBudget = stateChanges(tables.budget, 'budget_item_id', state?.entity_signatures?.budget);
  const sourceBefore = hasScreenplay ? syncFromScreenplay(parsed, tables, warnings) : {
    scenes: cloneRows(tables.scenes),
    locations: cloneRows(tables.locations),
    elements: cloneRows(tables.elements),
  };
  const changedScenes = changedRows(sourceBefore.scenes, tables.scenes.rows, tables.scenes.headers, 'scene_id');
  const changedLocations = new Set([
    ...manualLocations,
    ...changedRows(sourceBefore.locations, tables.locations.rows, tables.locations.headers, 'location_id'),
  ]);
  const changedElements = changedRows(sourceBefore.elements, tables.elements.rows, tables.elements.headers, 'element_id');
  const propagatedBefore = propagate(tables, changedScenes, changedLocations, manualBudget, args.trigger, warnings);
  const effects = {
    scenes: changedScenes,
    locations: changedLocations,
    elements: changedElements,
    shots: changedRows(propagatedBefore.shots, tables.shots.rows, tables.shots.headers, 'shot_id'),
    schedule: changedRows(propagatedBefore.schedule, tables.schedule.rows, tables.schedule.headers, 'shoot_day_id'),
    budget: changedRows(propagatedBefore.budget, tables.budget.rows, tables.budget.headers, 'budget_item_id'),
    research: changedRows(propagatedBefore.research, tables.research.rows, tables.research.headers, 'research_id'),
    evidence: changedRows(propagatedBefore.evidence, tables.evidence.rows, tables.evidence.headers, 'evidence_id'),
  };
  warnings.push(...validate(tables));

  const generated = {
    [GENERATED.scenes]: renderScenes(tables.scenes, tables.elements, tables.locations),
    [GENERATED.locations]: renderLocations(tables.locations),
    [GENERATED.budget]: renderBudget(tables.budget),
  };
  const writes = [];
  const changedFiles = [];
  for (const table of Object.values(tables)) {
    const next = serializeCsv(table);
    if (next !== table.originalText) {
      writes.push({ file: table.filePath, text: next });
      changedFiles.push(table.filePath);
    }
  }
  for (const [file, text] of Object.entries(generated)) {
    if (text !== await optionalText(file)) {
      writes.push({ file, text });
      changedFiles.push(file);
    }
  }
  const timestamp = new Date().toISOString();
  const context = {
    apply: args.apply,
    changedFiles,
    effects,
    screenplay: hasScreenplay ? rel(screenplayPath) : 'MISSING',
    timestamp,
    trigger: args.trigger,
    warnings: unique(warnings),
  };
  return {
    context,
    inputVersions: inputVersions.created,
    report: renderReport(context),
    state: makeState(tables, screenplayHash, timestamp),
    tables,
    writes,
  };
}

function printPlan(plan) {
  console.log('\nPROJE SENKRONİZASYONU - ' + (plan.context.apply ? 'UYGULAMA' : 'ÖNİZLEME'));
  console.log('  Senaryo: ' + plan.context.screenplay);
  console.log('  Sahneler: ' + list(plan.context.effects.scenes));
  console.log('  Mekanlar: ' + list(plan.context.effects.locations));
  console.log('  Bütçe: ' + list(plan.context.effects.budget));
  console.log('  Dosya: ' + plan.context.changedFiles.length);
  for (const warning of plan.context.warnings) console.log('  Uyarı: ' + warning);
}

async function backup(files, trigger) {
  const available = [];
  for (const file of files) if (await exists(file)) available.push(file);
  if (!available.length) return null;
  const stamp = new Date().toISOString().replaceAll(':', '-').replace('.', '-');
  const safeTrigger = trigger.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'sync';
  const root = path.join(BACKUPS, stamp + '-' + safeTrigger);
  for (const file of available) {
    const target = path.join(root, path.relative(ROOT, file));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(file, target);
  }
  return rel(root);
}

async function applyPlan(plan) {
  const backupPath = await backup([...plan.writes.map((item) => item.file), REPORT, STATE], plan.context.trigger);
  for (const item of plan.writes) {
    await fs.mkdir(path.dirname(item.file), { recursive: true });
    await fs.writeFile(item.file, item.text, 'utf8');
  }
  const outputVersions = await snapshotTrackedFiles('output:' + plan.context.trigger);
  const versions = [...plan.inputVersions, ...outputVersions.created];
  const versionLines = versions.length
    ? versions.map((item) => '- ' + item.key + ': v' + String(item.version).padStart(3, '0') + ' -> ' + item.active_file).join('\n')
    : '- Yeni sürüm oluşmadı.';
  await fs.writeFile(
    REPORT,
    plan.report + '\n## Sürümler\n\n' + versionLines + '\n\nYedek: ' + (backupPath || 'İlk kayıt') + '\n',
    'utf8',
  );
  await fs.writeFile(STATE, JSON.stringify(plan.state, null, 2) + '\n', 'utf8');
  await fs.appendFile(HISTORY, JSON.stringify({
    timestamp: plan.context.timestamp,
    trigger: plan.context.trigger,
    effects: Object.fromEntries(Object.entries(plan.context.effects).map(([key, set]) => [key, [...set].sort()])),
    changed_files: plan.context.changedFiles.map(rel),
    warnings: plan.context.warnings,
    backup_path: backupPath,
    versions: versions,
  }) + '\n', 'utf8');
  console.log('  Uygulandı: ' + rel(REPORT));
}

async function processOnce(args) {
  const plan = await buildPlan(args);
  printPlan(plan);
  if (args.apply) await applyPlan(plan);
}

async function runDraft(apply) {
  const args = [DRAFT_PROCESSOR];
  if (apply) args.push('--apply', '--all', '--no-sync');
  const result = await execFileAsync(process.execPath, args, { cwd: ROOT });
  if (result.stdout.trim()) console.log(result.stdout.trim());
  if (result.stderr.trim()) console.error(result.stderr.trim());
}

async function runWatch(args) {
  await fs.mkdir(path.dirname(SCREENPLAY), { recursive: true });
  await fs.mkdir(DRAFT_INBOX, { recursive: true });
  await runDraft(args.apply);
  await processOnce({ ...args, trigger: 'watch:start' });
  console.log('\nProje girdileri izleniyor. Durdurmak için Ctrl+C.');
  let timer = null;
  let draftChanged = false;
  let running = false;
  let queued = false;
  const schedule = (draft) => {
    draftChanged ||= draft;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (running) {
        queued = true;
        return;
      }
      running = true;
      try {
        if (draftChanged) await runDraft(args.apply);
        draftChanged = false;
        await processOnce({ ...args, trigger: 'watch:file-change' });
      } catch (error) {
        console.error('[HATA] ' + error.message);
      } finally {
        running = false;
        if (queued) {
          queued = false;
          schedule(false);
        }
      }
    }, 700);
  };
  const csvNames = new Set(Object.values(FILES).map((file) => path.basename(file)));
  const watchers = [];
  for (const folder of [path.dirname(SCREENPLAY), path.join(ROOT, '02_breakdown'), path.join(ROOT, '03_schedule'), path.join(ROOT, '04_budget'), path.join(ROOT, '05_research')]) {
    watchers.push(fsWatch(folder, { recursive: false }, (_event, filename) => {
      const name = filename ? String(filename) : '';
      if (name === 'screenplay.fountain' || csvNames.has(name)) schedule(false);
    }));
  }
  watchers.push(fsWatch(DRAFT_INBOX, { recursive: true }, () => schedule(true)));
  await new Promise((resolve) => watchers.forEach((watcher) => watcher.on('close', resolve)));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (!(await exists(GRAPH))) throw new Error('Bağımlılık grafiği eksik: schema/dependency-graph.json');
  if (args.watch) await runWatch(args);
  else await processOnce(args);
}

main().catch((error) => {
  console.error('[HATA] ' + error.message);
  process.exitCode = 1;
});
