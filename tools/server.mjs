import http from 'node:http';
import fs from 'node:fs/promises';
import { constants as fsConstants, createReadStream, watch as fsWatch } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { autoEnrichFountain, tagSelectionInFountain } from './script-enricher.mjs';

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(ROOT, 'public');
const ADMIN_DIR = path.join(ROOT, '00_admin');
const STORY_DIR = path.join(ROOT, '01_story');
const BREAKDOWN_DIR = path.join(ROOT, '02_breakdown');
const SCHEDULE_DIR = path.join(ROOT, '03_schedule');
const BUDGET_DIR = path.join(ROOT, '04_budget');
const ASSETS_DIR = path.join(ROOT, '06_assets');
const DRAFT_DIR = path.join(ROOT, '09_draft');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseDelimited(text, delimiter = ';') {
  const result = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field); field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      result.push(row);
      row = []; field = '';
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    result.push(row);
  }
  return result.filter(r => r.some(v => v !== ''));
}

async function readCsvRows(filePath) {
  if (!(await exists(filePath))) return [];
  const text = await fs.readFile(filePath, 'utf8');
  const matrix = parseDelimited(text);
  if (!matrix.length) return [];
  const headers = matrix[0];
  return matrix.slice(1).map(fields =>
    Object.fromEntries(headers.map((h, idx) => [h, fields[idx] || '']))
  );
}

async function runProjectSync() {
  const scriptPath = path.join(ROOT, 'tools', 'project-sync.mjs');
  const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, '--apply', '--trigger', 'ui-web'], { cwd: ROOT });
  return { stdout, stderr };
}

async function runDraftIngest() {
  const scriptPath = path.join(ROOT, 'tools', 'draft-ingest.mjs');
  const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, '--apply', '--all'], { cwd: ROOT });
  return { stdout, stderr };
}

function escapeDelimited(value, delimiter = ';') {
  const str = value === undefined || value === null ? '' : String(value).trim();
  if (str.includes(delimiter) || str.includes('"') || /[\r\n]/.test(str)) {
    return '"' + str.replaceAll('"', '""') + '"';
  }
  return str;
}

function serializeCsvRows(headers, rows) {
  const lines = [headers.map(h => escapeDelimited(h)).join(';')];
  for (const row of rows) {
    lines.push(headers.map(h => escapeDelimited(row[h] || '')).join(';'));
  }
  return lines.join('\n') + '\n';
}

async function updateCsvCell(fileName, keyField, keyValue, targetField, newValue) {
  const filePath = path.join(ROOT, fileName);
  if (!(await exists(filePath))) throw new Error('Dosya bulunamadı: ' + fileName);
  const text = await fs.readFile(filePath, 'utf8');
  const matrix = parseDelimited(text);
  if (!matrix.length) throw new Error('Boş CSV dosyası');
  const headers = matrix[0];
  const rows = matrix.slice(1).map(fields =>
    Object.fromEntries(headers.map((h, idx) => [h, fields[idx] || '']))
  );
  const targetRow = rows.find(r => r[keyField] === keyValue);
  if (!targetRow) throw new Error(`${fileName} içinde ${keyField}=${keyValue} kaydı bulunamadı.`);
  const oldValue = targetRow[targetField];
  targetRow[targetField] = String(newValue).trim();
  await fs.writeFile(filePath, serializeCsvRows(headers, rows), 'utf8');
  return { oldValue, newValue, keyField, keyValue, targetField };
}

async function getLocationsWithAssets() {
  const locations = await readCsvRows(path.join(BREAKDOWN_DIR, 'location_index.csv'));
  const locDir = path.join(ASSETS_DIR, 'locations');
  for (const loc of locations) {
    loc.assets = [];
    const dir = path.join(locDir, loc.location_id);
    const jsonFile = path.join(dir, 'assets.json');
    if (await exists(jsonFile)) {
      try {
        const data = JSON.parse(await fs.readFile(jsonFile, 'utf8'));
        loc.assets = data.assets || [];
      } catch {}
    }
  }
  return locations;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Basic Auth — AUTH_USER / AUTH_PASS env vars varsa zorunlu
  const AUTH_USER = process.env.AUTH_USER;
  const AUTH_PASS = process.env.AUTH_PASS;
  if (AUTH_USER && AUTH_PASS) {
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader.startsWith('Basic ')) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Cor3us Ready"', 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('401 Unauthorized — Lütfen giriş yapın.');
      return;
    }
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
    const colonIdx = decoded.indexOf(':');
    const user = decoded.slice(0, colonIdx);
    const pass = decoded.slice(colonIdx + 1);
    if (user !== AUTH_USER || pass !== AUTH_PASS) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Cor3us Ready"', 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('401 Unauthorized — Kullanıcı adı veya şifre hatalı.');
      return;
    }
  }

  try {
    if (pathname === '/api/status') {
      const regPath = path.join(ADMIN_DIR, 'version-registry.json');
      const registry = (await exists(regPath)) ? JSON.parse(await fs.readFile(regPath, 'utf8')) : {};
      const scenes = await readCsvRows(path.join(BREAKDOWN_DIR, 'sequential_breakdown.csv'));
      const locations = await readCsvRows(path.join(BREAKDOWN_DIR, 'location_index.csv'));
      const budget = await readCsvRows(path.join(BUDGET_DIR, 'budget.csv'));
      const reportText = (await exists(path.join(ADMIN_DIR, 'LAST_SYNC_REPORT.md')))
        ? await fs.readFile(path.join(ADMIN_DIR, 'LAST_SYNC_REPORT.md'), 'utf8')
        : '';
      
      let totalBudget = 0;
      for (const item of budget) totalBudget += Number(item.total_try || 0);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        scene_count: scenes.length,
        location_count: locations.length,
        budget_total: totalBudget,
        registry,
        report_summary: reportText.slice(0, 1000),
      }));
      return;
    }

    if (pathname === '/api/screenplay' && req.method === 'GET') {
      const spPath = path.join(STORY_DIR, 'source', 'screenplay.fountain');
      const content = (await exists(spPath)) ? await fs.readFile(spPath, 'utf8') : '';
      const revDir = path.join(STORY_DIR, 'revisions');
      let revisions = [];
      if (await exists(revDir)) {
        const files = await fs.readdir(revDir);
        revisions = files.filter(f => f.endsWith('.fountain')).sort();
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ content, revisions }));
      return;
    }

    if (pathname === '/api/screenplay' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const data = JSON.parse(body);
      if (typeof data.content === 'string' && data.content.trim().length > 0) {
        const spPath = path.join(STORY_DIR, 'source', 'screenplay.fountain');
        await fs.mkdir(path.dirname(spPath), { recursive: true });
        await fs.writeFile(spPath, data.content, 'utf8');
        const syncRes = await runProjectSync();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, sync: syncRes }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Boş senaryo kaydedilemez.' }));
      }
      return;
    }

    if (pathname === '/api/screenplay/auto-format' && req.method === 'POST') {
      const spPath = path.join(STORY_DIR, 'source', 'screenplay.fountain');
      const content = (await exists(spPath)) ? await fs.readFile(spPath, 'utf8') : '';
      const { enrichedText, logs } = autoEnrichFountain(content);
      await fs.writeFile(spPath, enrichedText, 'utf8');
      const syncRes = await runProjectSync();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, content: enrichedText, logs, sync: syncRes }));
      return;
    }

    if (pathname === '/api/screenplay/tag-selection' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const data = JSON.parse(body);
      const spPath = path.join(STORY_DIR, 'source', 'screenplay.fountain');
      const content = (await exists(spPath)) ? await fs.readFile(spPath, 'utf8') : '';
      const { updatedText, logs } = tagSelectionInFountain(content, data.sceneId, data.selectedText, data.category);
      await fs.writeFile(spPath, updatedText, 'utf8');
      const syncRes = await runProjectSync();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, content: updatedText, logs, sync: syncRes }));
      return;
    }

    if (pathname === '/api/custom-categories' && req.method === 'GET') {
      const catFile = path.join(ADMIN_DIR, 'custom_categories.json');
      const data = (await exists(catFile)) ? JSON.parse(await fs.readFile(catFile, 'utf8')) : [];
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
      return;
    }

    if (pathname === '/api/custom-categories' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const newCat = JSON.parse(body);
      const catFile = path.join(ADMIN_DIR, 'custom_categories.json');
      let current = (await exists(catFile)) ? JSON.parse(await fs.readFile(catFile, 'utf8')) : [];
      if (!current.some(c => c.key === newCat.key)) {
        current.push(newCat);
        await fs.writeFile(catFile, JSON.stringify(current, null, 2), 'utf8');
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, categories: current }));
      return;
    }

    if (pathname === '/api/constraints' && req.method === 'GET') {
      const constFile = path.join(SCHEDULE_DIR, 'user_constraints.json');
      const data = (await exists(constFile)) ? JSON.parse(await fs.readFile(constFile, 'utf8')) : [];
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
      return;
    }

    if (pathname === '/api/constraints/update' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const constData = JSON.parse(body);
      const constFile = path.join(SCHEDULE_DIR, 'user_constraints.json');
      await fs.mkdir(path.dirname(constFile), { recursive: true });
      await fs.writeFile(constFile, JSON.stringify(constData, null, 2), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (pathname === '/api/crew' && req.method === 'GET') {
      const crewFile = path.join(ADMIN_DIR, 'crew_registry.json');
      const data = (await exists(crewFile)) ? JSON.parse(await fs.readFile(crewFile, 'utf8')) : null;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
      return;
    }

    if (pathname === '/api/crew' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const crewData = JSON.parse(body);
      const crewFile = path.join(ADMIN_DIR, 'crew_registry.json');
      await fs.writeFile(crewFile, JSON.stringify(crewData, null, 2), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (pathname === '/api/budget/items' && req.method === 'GET') {
      const budgetFile = path.join(ADMIN_DIR, 'budget_items.json');
      if (await exists(budgetFile)) {
        const data = JSON.parse(await fs.readFile(budgetFile, 'utf8'));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
        return;
      }
      const budgetRows = await readCsvRows(path.join(BUDGET_DIR, 'budget.csv'));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(budgetRows));
      return;
    }

    if (pathname === '/api/budget/update' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const budgetData = JSON.parse(body);
      const budgetFile = path.join(ADMIN_DIR, 'budget_items.json');
      await fs.writeFile(budgetFile, JSON.stringify(budgetData, null, 2), 'utf8');

      // Sync-uyumlu semicolon CSV yaz (production-io.mjs formatı)
      if (Array.isArray(budgetData) && budgetData.length > 0) {
        const STATUS_MAP = {
          '❌ Talep Edilmedi': 'DRAFT', '⏳ Onay Bekliyor': 'NEEDS_APPROVAL',
          '✅ Onaylandı': 'APPROVED', '🔴 Reddedildi': 'REJECTED', '—': 'DRAFT',
        };
        const UNIT_MAP = { 'Gün': 'day', 'Adet': 'adet', 'Paket': 'paket', 'Set': 'set', 'Kişi': 'kisi' };
        const CSV_HEADERS = [
          'budget_item_id','category','sub_category','description',
          'quantity','unit','unit_cost_try','subtotal_try','contingency_pct',
          'contingency_try','total_try','approval_status','paid_status',
          'scene_ids','location_id','supply_method','usage_purpose','producer_note','notes',
        ];
        const csvRows = budgetData.map(item => {
          const qty    = Number(item.quantity)         || 0;
          const cost   = Number(item.unit_cost_try)    || 0;
          const ctgPct = Number(item.contingency_pct)  || 0;
          const subtotal = Math.round(qty * cost * 100) / 100;
          const ctg    = Math.round(subtotal * ctgPct / 100 * 100) / 100;
          const total  = Math.round((subtotal + ctg) * 100) / 100;
          const rawScenes = String(item.scenes || '');
          const sceneIds = /SC-\d+/.test(rawScenes)
            ? (rawScenes.match(/SC-\d+/g) || []).join(',')
            : '';
          return {
            budget_item_id:  item.budget_item_id || '',
            category:        item.category       || '',
            sub_category:    item.sub_category   || '',
            description:     item.description    || '',
            quantity:        String(qty),
            unit:            UNIT_MAP[item.unit]  || item.unit || '',
            unit_cost_try:   String(cost),
            subtotal_try:    String(subtotal),
            contingency_pct: String(ctgPct),
            contingency_try: String(ctg),
            total_try:       String(total),
            approval_status: STATUS_MAP[item.status] || 'DRAFT',
            paid_status:     'UNPAID',
            scene_ids:       sceneIds,
            location_id:     item.location_id    || '',
            supply_method:   item.supply_method  || '',
            usage_purpose:   item.usage_purpose  || '',
            producer_note:   item.producer_note  || '',
            notes:           item.notes          || '',
          };
        });
        const csvLines = [CSV_HEADERS.join(';')];
        for (const row of csvRows) {
          csvLines.push(CSV_HEADERS.map(h => escapeDelimited(row[h] || '')).join(';'));
        }
        await fs.writeFile(path.join(BUDGET_DIR, 'budget.csv'), csvLines.join('\n') + '\n', 'utf8');
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (pathname === '/api/export/package') {
      const screenplay = (await exists(path.join(STORY_DIR, 'source', 'screenplay.fountain')))
        ? await fs.readFile(path.join(STORY_DIR, 'source', 'screenplay.fountain'), 'utf8') : '';
      const scenes = await readCsvRows(path.join(BREAKDOWN_DIR, 'sequential_breakdown.csv'));
      const locations = await readCsvRows(path.join(BREAKDOWN_DIR, 'location_index.csv'));
      const budget = await readCsvRows(path.join(BUDGET_DIR, 'budget.csv'));
      const schedule = await readCsvRows(path.join(SCHEDULE_DIR, 'shooting_schedule.csv'));
      const report = (await exists(path.join(ADMIN_DIR, 'LAST_SYNC_REPORT.md')))
        ? await fs.readFile(path.join(ADMIN_DIR, 'LAST_SYNC_REPORT.md'), 'utf8') : '';

      const pkgData = {
        title: "FİLM PRODÜKSİYON HAZIRLIK — Prodüksiyon Paketi",
        generated_at: new Date().toISOString(),
        screenplay,
        scenes,
        locations,
        budget,
        schedule,
        report
      };

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="PRODUKSIYON_PAKETI.json"'
      });
      res.end(JSON.stringify(pkgData, null, 2));
      return;
    }

    if (pathname === '/api/scenes') {
      const scenes = await readCsvRows(path.join(BREAKDOWN_DIR, 'sequential_breakdown.csv'));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(scenes));
      return;
    }

    if (pathname === '/api/locations') {
      const locations = await getLocationsWithAssets();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(locations));
      return;
    }

    if (pathname === '/api/elements') {
      const elements = await readCsvRows(path.join(BREAKDOWN_DIR, 'elements_breakdown.csv'));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(elements));
      return;
    }

    if (pathname === '/api/budget') {
      const budget = await readCsvRows(path.join(BUDGET_DIR, 'budget.csv'));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(budget));
      return;
    }

    if (pathname === '/api/schedule') {
      const schedule = await readCsvRows(path.join(SCHEDULE_DIR, 'shooting_schedule.csv'));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(schedule));
      return;
    }

    if (pathname === '/api/report') {
      const rPath = path.join(ADMIN_DIR, 'LAST_SYNC_REPORT.md');
      const report = (await exists(rPath)) ? await fs.readFile(rPath, 'utf8') : '';
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(report);
      return;
    }

    if (pathname === '/api/sync' && req.method === 'POST') {
      const syncRes = await runProjectSync();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(syncRes));
      return;
    }

    if (pathname === '/api/cell-update' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const data = JSON.parse(body);
      const change = await updateCsvCell(data.file, data.keyField, data.keyValue, data.field, data.value);
      const syncRes = await runProjectSync();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, change, sync: syncRes }));
      return;
    }

    if (pathname === '/api/call-sheet') {
      const schedule = await readCsvRows(path.join(SCHEDULE_DIR, 'shooting_schedule.csv'));
      const scenes = await readCsvRows(path.join(BREAKDOWN_DIR, 'sequential_breakdown.csv'));
      const locations = await readCsvRows(path.join(BREAKDOWN_DIR, 'location_index.csv'));
      const elements = await readCsvRows(path.join(BREAKDOWN_DIR, 'elements_breakdown.csv'));
      
      const dayId = parsedUrl.searchParams.get('day_id') || (schedule[0]?.shoot_day_id || 'DAY-001');
      const dayRow = schedule.find(s => s.shoot_day_id === dayId) || schedule[0] || {};
      const dayScenes = scenes.filter(sc => (dayRow.scene_ids || '').split(',').map(s=>s.trim()).includes(sc.scene_id));
      
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        call_sheet: {
          shoot_day_id: dayId,
          date: dayRow.date || 'TBD',
          day_type: dayRow.day_type || 'SHOOT_DAY',
          location_name: dayRow.location_name || 'TBD',
          company_call: dayRow.company_call || '07:00',
          cast_call: dayRow.cast_call || '08:00',
          first_shot: dayRow.first_shot || '09:00',
          meal: dayRow.meal || '13:00',
          wrap: dayRow.wrap || '19:00',
          scenes: dayScenes,
          schedule: dayRow,
          elements: elements,
          locations: locations,
        }
      }));
      return;
    }

    if (pathname === '/api/draft/ingest' && req.method === 'POST') {
      const ingestRes = await runDraftIngest();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(ingestRes));
      return;
    }

    // Kapsamlı proje arşivi — tüm veri dosyaları tek JSON'da (bulut kayıt/yükleme)
    if (pathname === '/api/export/archive') {
      const readJson  = async (p) => (await exists(p)) ? JSON.parse(await fs.readFile(p, 'utf8')) : null;
      const readText  = async (p) => (await exists(p)) ? await fs.readFile(p, 'utf8') : '';
      const readCsvTx = async (p) => (await exists(p)) ? await fs.readFile(p, 'utf8') : '';
      const archive = {
        schema_version: '1.0.0',
        exported_at: new Date().toISOString(),
        project_title: 'FİLM PRODÜKSİYON HAZIRLIK',
        files: {
          'screenplay.fountain':           await readText(path.join(STORY_DIR, 'source', 'screenplay.fountain')),
          'sequential_breakdown.csv':      await readCsvTx(path.join(BREAKDOWN_DIR, 'sequential_breakdown.csv')),
          'location_index.csv':            await readCsvTx(path.join(BREAKDOWN_DIR, 'location_index.csv')),
          'elements_breakdown.csv':        await readCsvTx(path.join(BREAKDOWN_DIR, 'elements_breakdown.csv')),
          'shot_list.csv':                 await readCsvTx(path.join(BREAKDOWN_DIR, 'shot_list.csv')),
          'budget.csv':                    await readCsvTx(path.join(BUDGET_DIR, 'budget.csv')),
          'shooting_schedule.csv':         await readCsvTx(path.join(SCHEDULE_DIR, 'shooting_schedule.csv')),
          'research_log.csv':              await readCsvTx(path.join(ROOT, '05_research', 'research_log.csv')),
          'budget_items.json':             await readJson(path.join(ADMIN_DIR, 'budget_items.json')),
          'crew_registry.json':            await readJson(path.join(ADMIN_DIR, 'crew_registry.json')),
          'custom_categories.json':        await readJson(path.join(ADMIN_DIR, 'custom_categories.json')),
          'user_constraints.json':         await readJson(path.join(SCHEDULE_DIR, 'user_constraints.json')),
          'PROJECT_CONTROL.md':            await readText(path.join(ADMIN_DIR, 'PROJECT_CONTROL.md')),
          'LAST_SYNC_REPORT.md':           await readText(path.join(ADMIN_DIR, 'LAST_SYNC_REPORT.md')),
        },
      };
      const filename = `cor3us-ready-archive-${new Date().toISOString().slice(0,10)}.json`;
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      res.end(JSON.stringify(archive, null, 2));
      return;
    }

    // Proje arşivini geri yükle (POST)
    if (pathname === '/api/import/archive' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const archive = JSON.parse(body);
      const files = archive.files || {};
      const restored = [];
      const writeFile = async (filePath, content) => {
        if (content === null || content === undefined) return;
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        const data = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        await fs.writeFile(filePath, data, 'utf8');
        restored.push(path.relative(ROOT, filePath));
      };
      await writeFile(path.join(STORY_DIR, 'source', 'screenplay.fountain'),    files['screenplay.fountain']);
      await writeFile(path.join(BREAKDOWN_DIR, 'sequential_breakdown.csv'),     files['sequential_breakdown.csv']);
      await writeFile(path.join(BREAKDOWN_DIR, 'location_index.csv'),           files['location_index.csv']);
      await writeFile(path.join(BREAKDOWN_DIR, 'elements_breakdown.csv'),       files['elements_breakdown.csv']);
      await writeFile(path.join(BREAKDOWN_DIR, 'shot_list.csv'),                files['shot_list.csv']);
      await writeFile(path.join(BUDGET_DIR, 'budget.csv'),                      files['budget.csv']);
      await writeFile(path.join(SCHEDULE_DIR, 'shooting_schedule.csv'),         files['shooting_schedule.csv']);
      await writeFile(path.join(ROOT, '05_research', 'research_log.csv'),       files['research_log.csv']);
      await writeFile(path.join(ADMIN_DIR, 'budget_items.json'),                files['budget_items.json']);
      await writeFile(path.join(ADMIN_DIR, 'crew_registry.json'),               files['crew_registry.json']);
      await writeFile(path.join(ADMIN_DIR, 'custom_categories.json'),           files['custom_categories.json']);
      await writeFile(path.join(SCHEDULE_DIR, 'user_constraints.json'),         files['user_constraints.json']);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, restored }));
      return;
    }

    // Serve asset files from 06_assets/
    if (pathname.startsWith('/assets/')) {
      const relPath = pathname.slice('/assets/'.length);
      const safePath = path.resolve(ASSETS_DIR, relPath);
      if (safePath.startsWith(ASSETS_DIR) && (await exists(safePath))) {
        const ext = path.extname(safePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        createReadStream(safePath).pipe(res);
        return;
      }
    }

    // Serve static files from public/
    let reqPath = pathname === '/' ? '/index.html' : pathname;
    let filePath = path.join(PUBLIC_DIR, reqPath);
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      res.end('Access Denied');
      return;
    }

    if (await exists(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'text/plain';
      res.writeHead(200, { 'Content-Type': contentType });
      createReadStream(filePath).pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');

  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  const authStatus = (process.env.AUTH_USER && process.env.AUTH_PASS) ? '🔐 Auth AÇIK' : '🔓 Auth KAPALI (geliştirme)';
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  🎬 FİLM PRODÜKSİYON HAZIRLIK                    ║`);
  console.log(`║  Sistemi Başarıyla Başlatıldı                    ║`);
  console.log(`╠══════════════════════════════════════════════════╣`);
  console.log(`║  📌 http://localhost:${PORT}                         ║`);
  console.log(`║  ${authStatus.padEnd(46)}║`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);
});
