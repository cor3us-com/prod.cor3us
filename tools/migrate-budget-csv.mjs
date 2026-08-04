/**
 * Tek seferlik budget.csv migrasyon scripti
 * budget_items.json (gerçek kaynak) → semicolon CSV (sync uyumlu format)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET_ITEMS_FILE = path.join(ROOT, '00_admin', 'budget_items.json');
const BUDGET_CSV_FILE   = path.join(ROOT, '04_budget', 'budget.csv');

const STATUS_MAP = {
  '❌ Talep Edilmedi': 'DRAFT',
  '⏳ Onay Bekliyor': 'NEEDS_APPROVAL',
  '✅ Onaylandı':     'APPROVED',
  '🔴 Reddedildi':    'REJECTED',
  '—':                'DRAFT',
};
const UNIT_MAP = { 'Gün': 'day', 'Adet': 'adet', 'Paket': 'paket', 'Set': 'set', 'Kişi': 'kisi' };

function escapeCell(value) {
  const str = (value === null || value === undefined) ? '' : String(value).trim();
  if (str.includes(';') || str.includes('"') || /[\r\n]/.test(str)) {
    return '"' + str.replaceAll('"', '""') + '"';
  }
  return str;
}

const budgetItems = JSON.parse(await fs.readFile(BUDGET_ITEMS_FILE, 'utf8'));

const CSV_HEADERS = [
  'budget_item_id','category','sub_category','description',
  'quantity','unit','unit_cost_try','subtotal_try','contingency_pct',
  'contingency_try','total_try','approval_status','paid_status',
  'scene_ids','location_id','supply_method','usage_purpose','producer_note','notes',
];

let grandTotal = 0;
const categoryTotals = {};

const csvRows = budgetItems.map(item => {
  const qty    = Number(item.quantity)      || 0;
  const cost   = Number(item.unit_cost_try) || 0;
  const ctgPct = Number(item.contingency_pct) || 0;
  const subtotal = Math.round(qty * cost * 100) / 100;
  const ctg    = Math.round(subtotal * ctgPct / 100 * 100) / 100;
  const total  = Math.round((subtotal + ctg) * 100) / 100;

  grandTotal += total;
  const cat = item.category || 'Diğer';
  categoryTotals[cat] = (categoryTotals[cat] || 0) + total;

  // scene_ids: gerçek SC-xxx kalıplarını çıkar, genel prodüksiyon etiketlerini boş bırak
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
    unit:            UNIT_MAP[item.unit] || item.unit || '',
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
  csvLines.push(CSV_HEADERS.map(h => escapeCell(row[h])).join(';'));
}
await fs.writeFile(BUDGET_CSV_FILE, csvLines.join('\n') + '\n', 'utf8');

console.log('\n✅ budget.csv başarıyla yeniden oluşturuldu!');
console.log(`   Format   : semicolon (;) — sync uyumlu`);
console.log(`   Kalem sayısı: ${csvRows.length}`);
console.log(`   Genel toplam: ${Math.round(grandTotal).toLocaleString('tr-TR')} TRY\n`);
console.log('Kategori dağılımı:');
for (const [cat, total] of Object.entries(categoryTotals)) {
  console.log(`  ${cat}: ${Math.round(total).toLocaleString('tr-TR')} TRY`);
}
console.log('');
