#!/usr/bin/env node

import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { constants as fsConstants, watch as fsWatch } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const PROCESSOR_VERSION = "1.0.0";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const DRAFT_ROOT = path.join(PROJECT_ROOT, "09_draft");
const INBOX_ROOT = path.join(DRAFT_ROOT, "inbox");
const RECEIPTS_ROOT = path.join(DRAFT_ROOT, "receipts");
const BACKUPS_ROOT = path.join(DRAFT_ROOT, "backups");
const LOCATION_CSV = path.join(PROJECT_ROOT, "02_breakdown", "location_index.csv");
const BUDGET_CSV = path.join(PROJECT_ROOT, "04_budget", "budget.csv");
const LOCATION_ASSETS_ROOT = path.join(PROJECT_ROOT, "06_assets", "locations");
const PROJECT_SYNC = path.join(PROJECT_ROOT, "tools", "project-sync.mjs");

const PACKAGE_ID_PATTERN = /^DRF-[A-Z0-9][A-Z0-9-]*$/;
const LOCATION_ID_PATTERN = /^LOC-\d{3,}$/;
const BUDGET_ID_PATTERN = /^BUD-\d{3,}$/;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif", ".tiff"]);
const ASSET_ROLES = new Set(["location_photo", "location_document", "other"]);
const SAFE_LOCATION_STATUSES = new Set(["DRAFT", "REVIEW", "NEEDS_APPROVAL", "TBD"]);
const SAFE_APPROVAL_STATUSES = new Set(["DRAFT", "QUOTED", "NEEDS_APPROVAL"]);
const SAFE_PAID_STATUSES = new Set(["UNPAID", "NOT_APPLICABLE"]);

function parseArgs(argv) {
  const args = {
    apply: false,
    all: false,
    force: false,
    help: false,
    manifest: null,
    noSync: false,
    packageId: null,
    watch: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--apply") args.apply = true;
    else if (token === "--all") args.all = true;
    else if (token === "--force") args.force = true;
    else if (token === "--watch") args.watch = true;
    else if (token === "--help" || token === "-h") args.help = true;
    else if (token === "--package") args.packageId = argv[++index] ?? null;
    else if (token === "--manifest") args.manifest = argv[++index] ?? null;
    else if (token === "--no-sync") args.noSync = true;
    else throw new Error(`Bilinmeyen seçenek: ${token}`);
  }

  if (args.packageId && args.all) throw new Error("--package ile --all birlikte kullanılamaz.");
  if (args.manifest && (args.packageId || args.all || args.watch)) {
    throw new Error("--manifest yalnızca tek dosyalık önizleme için kullanılabilir.");
  }
  if (args.apply && args.manifest) throw new Error("Örnek manifest doğrudan uygulanamaz; önce inbox içine kopyalayın.");
  if (args.apply && !args.packageId && !args.all) {
    throw new Error("Uygulama için açık hedef gerekir: --package DRF-... veya --all.");
  }
  if (args.watch && args.apply && !args.packageId && !args.all) {
    throw new Error("Otomatik uygulamalı izleme için --package veya --all gerekir.");
  }
  return args;
}

function printHelp() {
  console.log(`Kısa Film Draft İşlemcisi v${PROCESSOR_VERSION}

Önizleme (varsayılan):
  node tools/draft-ingest.mjs
  node tools/draft-ingest.mjs --package DRF-LOC-001

Uygulama:
  node tools/draft-ingest.mjs --apply --package DRF-LOC-001
  node tools/draft-ingest.mjs --apply --all

İzleme:
  node tools/draft-ingest.mjs --watch
  node tools/draft-ingest.mjs --watch --apply --all

Örnek dosyayı test etme:
  node tools/draft-ingest.mjs --manifest 09_draft/examples/location-package/draft.json
`);
}

function assertInside(parent, candidate, label) {
  const relative = path.relative(parent, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} proje sınırının dışında: ${candidate}`);
  }
}

function normalizeSlashes(value) {
  return value.split(path.sep).join("/");
}

function csvValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(",");
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

function parseDelimited(text, delimiter = ";") {
  const result = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      result.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    result.push(row);
  }
  return result.filter((fields) => fields.some((value) => value !== ""));
}

function escapeDelimited(value, delimiter = ";") {
  const stringValue = csvValue(value);
  if (stringValue.includes(delimiter) || stringValue.includes('"') || /[\r\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

async function readCsv(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  const matrix = parseDelimited(text);
  if (matrix.length === 0) throw new Error(`CSV başlığı bulunamadı: ${filePath}`);
  const headers = matrix[0];
  const rows = matrix.slice(1).map((fields) =>
    Object.fromEntries(headers.map((header, index) => [header, fields[index] ?? ""])),
  );
  return { headers, rows };
}

function serializeCsv(headers, rows) {
  const lines = [headers.map((header) => escapeDelimited(header)).join(";")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeDelimited(row[header] ?? "")).join(";"));
  }
  return `${lines.join("\n")}\n`;
}

function blankRow(headers) {
  return Object.fromEntries(headers.map((header) => [header, ""]));
}

function nextId(prefix, existingIds) {
  let max = 0;
  for (const id of existingIds) {
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  let candidate;
  do {
    max += 1;
    candidate = `${prefix}-${String(max).padStart(3, "0")}`;
  } while (existingIds.has(candidate));
  existingIds.add(candidate);
  return candidate;
}

function mergeNote(current, addition) {
  const parts = String(current ?? "")
    .split(" | ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.includes(addition)) parts.push(addition);
  return parts.join(" | ");
}

function asNonNegativeNumber(value, label, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} negatif olmayan sayı olmalı.`);
  return number;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sanitizeFilename(filename) {
  const parsed = path.parse(path.basename(filename));
  const safeName = parsed.name
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "asset";
  return `${safeName}${parsed.ext.toLowerCase()}`;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function hashFile(filePath) {
  const data = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function loadReceipt(packageId) {
  const receiptPath = path.join(RECEIPTS_ROOT, `${packageId}.json`);
  if (!(await fileExists(receiptPath))) return { receipt: null, receiptPath };
  const receipt = JSON.parse(await fs.readFile(receiptPath, "utf8"));
  return { receipt, receiptPath };
}

async function resolvePackageDirs(args) {
  if (args.manifest) {
    const manifestPath = path.resolve(PROJECT_ROOT, args.manifest);
    assertInside(PROJECT_ROOT, manifestPath, "Manifest");
    if (path.basename(manifestPath) !== "draft.json") {
      throw new Error("--manifest hedefinin adı draft.json olmalı.");
    }
    if (!(await fileExists(manifestPath))) throw new Error(`Manifest bulunamadı: ${manifestPath}`);
    return [path.dirname(manifestPath)];
  }

  await fs.mkdir(INBOX_ROOT, { recursive: true });
  if (args.packageId) {
    if (!PACKAGE_ID_PATTERN.test(args.packageId)) throw new Error(`Geçersiz paket kimliği: ${args.packageId}`);
    const packageDir = path.join(INBOX_ROOT, args.packageId);
    if (!(await fileExists(path.join(packageDir, "draft.json")))) {
      throw new Error(`Paket bulunamadı: ${normalizeSlashes(path.relative(PROJECT_ROOT, packageDir))}`);
    }
    return [packageDir];
  }

  const entries = await fs.readdir(INBOX_ROOT, { withFileTypes: true });
  const packageDirs = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const packageDir = path.join(INBOX_ROOT, entry.name);
    if (await fileExists(path.join(packageDir, "draft.json"))) packageDirs.push(packageDir);
  }
  return packageDirs;
}

async function normalizeAssets(manifest, packageDir) {
  let sourceAssets = manifest.assets;
  if (sourceAssets === undefined) {
    const entries = await fs.readdir(packageDir, { withFileTypes: true });
    sourceAssets = entries
      .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => ({ file: entry.name, role: "location_photo" }));
  }
  if (!Array.isArray(sourceAssets)) throw new Error("assets bir liste olmalı.");

  const assets = [];
  for (const [index, rawAsset] of sourceAssets.entries()) {
    const asset = typeof rawAsset === "string" ? { file: rawAsset } : rawAsset;
    if (!asset || typeof asset !== "object" || !asset.file) {
      throw new Error(`assets[${index}].file zorunlu.`);
    }
    const sourcePath = path.resolve(packageDir, asset.file);
    assertInside(packageDir, sourcePath, `assets[${index}]`);
    const stat = await fs.stat(sourcePath).catch(() => null);
    if (!stat?.isFile()) throw new Error(`Varlık dosyası bulunamadı: ${asset.file}`);
    const role = asset.role ?? "location_photo";
    if (!ASSET_ROLES.has(role)) throw new Error(`Desteklenmeyen varlık rolü: ${role}`);
    const extension = path.extname(sourcePath).toLowerCase();
    if (role === "location_photo" && !IMAGE_EXTENSIONS.has(extension)) {
      throw new Error(`Mekan fotoğrafı için desteklenmeyen uzantı: ${asset.file}`);
    }
    assets.push({
      caption: csvValue(asset.caption),
      file: asset.file,
      rights_status: csvValue(asset.rights_status || "UNKNOWN"),
      role,
      sourcePath,
    });
  }
  return assets;
}

async function packageFingerprint(manifestPath, assets) {
  const hash = crypto.createHash("sha256");
  hash.update(await fs.readFile(manifestPath));
  for (const asset of [...assets].sort((a, b) => a.file.localeCompare(b.file))) {
    hash.update(asset.file);
    hash.update(await fs.readFile(asset.sourcePath));
  }
  return hash.digest("hex");
}

function copyKnownFields(target, source, headers, excluded = new Set()) {
  const unknown = [];
  for (const [key, value] of Object.entries(source)) {
    if (excluded.has(key)) continue;
    if (!headers.includes(key)) {
      unknown.push(key);
      continue;
    }
    if (value !== undefined && value !== null && value !== "") target[key] = csvValue(value);
  }
  return unknown;
}

function rowsDiffer(headers, first, second) {
  return headers.some((header) => csvValue(first?.[header]) !== csvValue(second?.[header]));
}

async function chooseAssetDestination(asset, locationId) {
  const subfolder = asset.role === "location_photo" ? "photos" : asset.role === "location_document" ? "documents" : "other";
  const destinationDir = path.join(LOCATION_ASSETS_ROOT, locationId, subfolder);
  const sourceHash = await hashFile(asset.sourcePath);
  const safeFilename = sanitizeFilename(asset.file);
  let destinationPath = path.join(destinationDir, safeFilename);

  if (await fileExists(destinationPath)) {
    const destinationHash = await hashFile(destinationPath);
    if (destinationHash === sourceHash) {
      return { ...asset, action: "unchanged", destinationPath, hash: sourceHash };
    }
    const parsed = path.parse(safeFilename);
    destinationPath = path.join(destinationDir, `${parsed.name}-${sourceHash.slice(0, 8)}${parsed.ext}`);
    if (await fileExists(destinationPath)) {
      const versionHash = await hashFile(destinationPath);
      if (versionHash === sourceHash) {
        return { ...asset, action: "unchanged", destinationPath, hash: sourceHash };
      }
      throw new Error(`Hash çakışması nedeniyle hedef üretilemedi: ${destinationPath}`);
    }
  }
  return { ...asset, action: "copy", destinationPath, hash: sourceHash };
}

async function readAssetIndex(indexPath, locationId) {
  if (!(await fileExists(indexPath))) {
    return { schema_version: "1.0.0", location_id: locationId, assets: [] };
  }
  const data = JSON.parse(await fs.readFile(indexPath, "utf8"));
  if (!Array.isArray(data.assets)) data.assets = [];
  return data;
}

async function buildPackagePlan(packageDir, args) {
  const manifestPath = path.join(packageDir, "draft.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const folderName = path.basename(packageDir);
  const packageId = manifest.package_id ?? folderName;
  const warnings = [];

  if (!PACKAGE_ID_PATTERN.test(packageId)) throw new Error(`Geçersiz package_id: ${packageId}`);
  if (path.dirname(packageDir) === INBOX_ROOT && folderName !== packageId) {
    throw new Error(`Klasör adı package_id ile aynı olmalı: ${folderName} != ${packageId}`);
  }
  if (manifest.type !== "location") throw new Error(`Bu sürüm yalnızca type=location destekliyor: ${manifest.type}`);
  if (!manifest.location || typeof manifest.location !== "object") throw new Error("location nesnesi zorunlu.");
  if (!csvValue(manifest.location.location_name)) throw new Error("location.location_name zorunlu.");

  const assets = await normalizeAssets(manifest, packageDir);
  const fingerprint = await packageFingerprint(manifestPath, assets);
  const { receipt, receiptPath } = await loadReceipt(packageId);
  if (receipt?.fingerprint === fingerprint && !args.force) {
    return { fingerprint, packageId, packageDir, receipt, receiptPath, skipped: true, warnings: receipt.warnings ?? [] };
  }

  const locationTable = await readCsv(LOCATION_CSV);
  const budgetTable = await readCsv(BUDGET_CSV);
  const locationIds = new Set(locationTable.rows.map((row) => row.location_id).filter(Boolean));
  const budgetIds = new Set(budgetTable.rows.map((row) => row.budget_item_id).filter(Boolean));

  let locationId = manifest.location.location_id || receipt?.outputs?.location_id;
  if (locationId && !LOCATION_ID_PATTERN.test(locationId)) throw new Error(`Geçersiz location_id: ${locationId}`);
  if (!locationId) locationId = nextId("LOC", locationIds);

  const existingLocationIndex = locationTable.rows.findIndex((row) => row.location_id === locationId);
  const existingLocation = existingLocationIndex >= 0 ? locationTable.rows[existingLocationIndex] : blankRow(locationTable.headers);
  const locationRow = { ...existingLocation, location_id: locationId };
  const unknownLocationFields = copyKnownFields(
    locationRow,
    manifest.location,
    locationTable.headers,
    new Set(["location_id"]),
  );
  if (unknownLocationFields.length) warnings.push(`Yok sayılan location alanları: ${unknownLocationFields.join(", ")}`);
  locationRow.location_name = csvValue(manifest.location.location_name);
  locationRow.permission_status ||= "UNKNOWN";
  locationRow.status ||= "DRAFT";
  if (locationRow.permission_status === "CONFIRMED") {
    locationRow.permission_status = "NEEDS_APPROVAL";
    warnings.push("Draft paketi mekan iznini CONFIRMED yapamaz; NEEDS_APPROVAL olarak kaydedildi.");
  }
  if (!SAFE_LOCATION_STATUSES.has(locationRow.status)) {
    locationRow.status = "REVIEW";
    warnings.push("Draft paketi kilitli/nihai mekan durumu veremez; REVIEW olarak kaydedildi.");
  }
  if (manifest.location.cost_estimate_try !== undefined) {
    locationRow.cost_estimate_try = csvValue(asNonNegativeNumber(manifest.location.cost_estimate_try, "location.cost_estimate_try"));
  }
  locationRow.notes = mergeNote(locationRow.notes, `draft_package=${packageId}`);

  const locationRows = [...locationTable.rows];
  const locationAction = existingLocationIndex >= 0 ? (rowsDiffer(locationTable.headers, existingLocation, locationRow) ? "update" : "unchanged") : "insert";
  if (existingLocationIndex >= 0) locationRows[existingLocationIndex] = locationRow;
  else locationRows.push(locationRow);

  const rawBudgetItems = manifest.budget ?? [];
  if (!Array.isArray(rawBudgetItems)) throw new Error("budget bir liste olmalı.");
  const budgetRows = [...budgetTable.rows];
  const budgetPlans = [];
  const receiptBudgetIds = receipt?.outputs?.budget_item_ids ?? [];

  for (const [index, rawItem] of rawBudgetItems.entries()) {
    if (!rawItem || typeof rawItem !== "object") throw new Error(`budget[${index}] nesne olmalı.`);
    let budgetId = rawItem.budget_item_id || receiptBudgetIds[index];
    if (budgetId && !BUDGET_ID_PATTERN.test(budgetId)) throw new Error(`Geçersiz budget_item_id: ${budgetId}`);
    if (!budgetId) budgetId = nextId("BUD", budgetIds);
    budgetIds.add(budgetId);

    const existingIndex = budgetRows.findIndex((row) => row.budget_item_id === budgetId);
    const existing = existingIndex >= 0 ? budgetRows[existingIndex] : blankRow(budgetTable.headers);
    const row = { ...existing, budget_item_id: budgetId, location_id: locationId };
    const unknownBudgetFields = copyKnownFields(row, rawItem, budgetTable.headers, new Set(["budget_item_id"]));
    if (unknownBudgetFields.length) warnings.push(`budget[${index}] için yok sayılan alanlar: ${unknownBudgetFields.join(", ")}`);

    row.category ||= "LOCATION";
    row.sub_category ||= "LOCATION_FEE";
    row.description ||= `${locationRow.location_name} mekan gideri`;
    row.unit ||= "item";
    const quantity = asNonNegativeNumber(rawItem.quantity ?? row.quantity, `budget[${index}].quantity`, 1);
    let unitCost = asNonNegativeNumber(rawItem.unit_cost_try ?? row.unit_cost_try, `budget[${index}].unit_cost_try`, null);
    const directTotal = asNonNegativeNumber(rawItem.total_try, `budget[${index}].total_try`, null);
    if (unitCost === null && directTotal !== null) unitCost = quantity === 0 ? directTotal : directTotal / quantity;
    if (unitCost === null) throw new Error(`budget[${index}] için unit_cost_try veya total_try zorunlu.`);
    const contingencyPct = asNonNegativeNumber(rawItem.contingency_pct ?? row.contingency_pct, `budget[${index}].contingency_pct`, 0);
    const subtotal = roundMoney(quantity * unitCost);
    const contingency = roundMoney(subtotal * contingencyPct / 100);
    const total = roundMoney(subtotal + contingency);
    row.quantity = csvValue(quantity);
    row.unit_cost_try = csvValue(roundMoney(unitCost));
    row.subtotal_try = csvValue(subtotal);
    row.contingency_pct = csvValue(contingencyPct);
    row.contingency_try = csvValue(contingency);
    row.total_try = csvValue(total);
    row.source ||= `draft:${packageId}`;
    row.approval_status ||= "NEEDS_APPROVAL";
    row.paid_status ||= "UNPAID";
    row.owner ||= "Producer";
    if (!SAFE_APPROVAL_STATUSES.has(row.approval_status)) {
      row.approval_status = "NEEDS_APPROVAL";
      warnings.push(`${budgetId} otomatik olarak APPROVED/REJECTED yapılamaz; NEEDS_APPROVAL olarak kaydedildi.`);
    }
    if (!SAFE_PAID_STATUSES.has(row.paid_status)) {
      row.paid_status = "UNPAID";
      warnings.push(`${budgetId} otomatik olarak ödenmiş işaretlenemez; UNPAID olarak kaydedildi.`);
    }
    row.notes = mergeNote(row.notes, `draft_package=${packageId}`);

    const action = existingIndex >= 0 ? (rowsDiffer(budgetTable.headers, existing, row) ? "update" : "unchanged") : "insert";
    if (existingIndex >= 0) budgetRows[existingIndex] = row;
    else budgetRows.push(row);
    budgetPlans.push({ action, budgetId, total });
  }

  const assetPlans = [];
  for (const asset of assets) assetPlans.push(await chooseAssetDestination(asset, locationId));
  const assetIndexPath = path.join(LOCATION_ASSETS_ROOT, locationId, "assets.json");
  const currentAssetIndex = await readAssetIndex(assetIndexPath, locationId);
  const mergedAssets = [...currentAssetIndex.assets];
  for (const asset of assetPlans) {
    const relativePath = normalizeSlashes(path.relative(PROJECT_ROOT, asset.destinationPath));
    const record = {
      asset_ref: `AST-${locationId}-${asset.hash.slice(0, 8).toUpperCase()}`,
      caption: asset.caption,
      hash_sha256: asset.hash,
      path: relativePath,
      rights_status: asset.rights_status,
      role: asset.role,
      source_package: packageId,
    };
    const currentIndex = mergedAssets.findIndex((item) => item.path === relativePath || item.hash_sha256 === asset.hash);
    if (currentIndex >= 0) mergedAssets[currentIndex] = { ...mergedAssets[currentIndex], ...record };
    else mergedAssets.push(record);
  }
  const nextAssetIndex = {
    schema_version: "1.0.0",
    location_id: locationId,
    assets: mergedAssets.sort((a, b) => a.path.localeCompare(b.path)),
  };

  return {
    assetIndexPath,
    assetPlans,
    budgetPlans,
    budgetRows,
    budgetTable,
    fingerprint,
    locationAction,
    locationId,
    locationRows,
    locationTable,
    nextAssetIndex,
    packageDir,
    packageId,
    receipt,
    receiptPath,
    skipped: false,
    warnings: [...new Set(warnings)],
  };
}

function printPlan(plan, apply) {
  console.log(`\n[${plan.packageId}] ${apply ? "UYGULAMA" : "ÖNİZLEME"}`);
  if (plan.skipped) {
    console.log(`  Değişiklik yok; daha önce uygulanmış (${plan.receipt?.applied_at ?? "tarih bilinmiyor"}).`);
    return;
  }
  console.log(`  Mekan: ${plan.locationId} -> ${plan.locationAction}`);
  for (const item of plan.budgetPlans) console.log(`  Bütçe: ${item.budgetId} -> ${item.action}, toplam ${item.total} TRY`);
  for (const asset of plan.assetPlans) {
    console.log(`  Varlık: ${asset.file} -> ${normalizeSlashes(path.relative(PROJECT_ROOT, asset.destinationPath))} (${asset.action})`);
  }
  if (plan.assetPlans.length === 0) console.log("  Varlık: yok");
  for (const warning of plan.warnings) console.log(`  Uyarı: ${warning}`);
}

async function backupFiles(packageId, files) {
  const presentFiles = [];
  for (const filePath of files) if (await fileExists(filePath)) presentFiles.push(filePath);
  if (presentFiles.length === 0) return null;
  const timestamp = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
  const backupRoot = path.join(BACKUPS_ROOT, `${timestamp}-${packageId}`);
  for (const filePath of presentFiles) {
    assertInside(PROJECT_ROOT, filePath, "Yedek kaynağı");
    const destination = path.join(backupRoot, path.relative(PROJECT_ROOT, filePath));
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(filePath, destination);
  }
  return normalizeSlashes(path.relative(PROJECT_ROOT, backupRoot));
}

async function applyPlan(plan) {
  if (plan.skipped) return false;

  const backupPath = await backupFiles(plan.packageId, [
    LOCATION_CSV,
    BUDGET_CSV,
    plan.assetIndexPath,
    plan.receiptPath,
  ]);

  for (const asset of plan.assetPlans) {
    if (asset.action !== "copy") continue;
    await fs.mkdir(path.dirname(asset.destinationPath), { recursive: true });
    await fs.copyFile(asset.sourcePath, asset.destinationPath, fsConstants.COPYFILE_EXCL);
  }

  if (plan.assetPlans.length > 0) {
    await fs.mkdir(path.dirname(plan.assetIndexPath), { recursive: true });
    await fs.writeFile(plan.assetIndexPath, `${JSON.stringify(plan.nextAssetIndex, null, 2)}\n`, "utf8");
  }
  if (plan.locationAction !== "unchanged") {
    await fs.writeFile(LOCATION_CSV, serializeCsv(plan.locationTable.headers, plan.locationRows), "utf8");
  }
  if (plan.budgetPlans.some((item) => item.action !== "unchanged")) {
    await fs.writeFile(BUDGET_CSV, serializeCsv(plan.budgetTable.headers, plan.budgetRows), "utf8");
  }

  const receipt = {
    schema_version: "1.0.0",
    processor_version: PROCESSOR_VERSION,
    package_id: plan.packageId,
    status: "APPLIED",
    fingerprint: plan.fingerprint,
    applied_at: new Date().toISOString(),
    backup_path: backupPath,
    outputs: {
      location_id: plan.locationId,
      budget_item_ids: plan.budgetPlans.map((item) => item.budgetId),
      assets: plan.assetPlans.map((asset) => ({
        hash_sha256: asset.hash,
        path: normalizeSlashes(path.relative(PROJECT_ROOT, asset.destinationPath)),
        role: asset.role,
      })),
    },
    warnings: plan.warnings,
  };
  await fs.mkdir(RECEIPTS_ROOT, { recursive: true });
  await fs.writeFile(plan.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`  Tamamlandı. Alındı kaydı: ${normalizeSlashes(path.relative(PROJECT_ROOT, plan.receiptPath))}`);
  return true;
}

async function runProjectSync(packageIds) {
  const trigger = "draft:" + packageIds.join(",");
  const result = await execFileAsync(
    process.execPath,
    [PROJECT_SYNC, "--apply", "--trigger", trigger],
    { cwd: PROJECT_ROOT },
  );
  if (result.stdout.trim()) console.log(result.stdout.trim());
  if (result.stderr.trim()) console.error(result.stderr.trim());
}

async function processOnce(args) {
  const packageDirs = await resolvePackageDirs(args);
  if (packageDirs.length === 0) {
    console.log("Draft gelen kutusunda işlenecek paket yok.");
    return;
  }
  let failures = 0;
  const appliedPackages = [];
  for (const packageDir of packageDirs) {
    try {
      const plan = await buildPackagePlan(packageDir, args);
      printPlan(plan, args.apply);
      if (args.apply && await applyPlan(plan)) appliedPackages.push(plan.packageId);
    } catch (error) {
      failures += 1;
      console.error(`\n[HATA] ${path.basename(packageDir)}: ${error.message}`);
    }
  }
  if (appliedPackages.length > 0 && !args.noSync) await runProjectSync(appliedPackages);
  if (failures > 0 && !args.watch) process.exitCode = 1;
}

async function runWatch(args) {
  await processOnce(args);
  console.log(`\n09_draft/inbox izleniyor (${args.apply ? "uygulama" : "yalnız önizleme"}). Durdurmak için Ctrl+C.`);
  let timer = null;
  const watcher = fsWatch(INBOX_ROOT, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      processOnce(args).catch((error) => console.error(`[HATA] ${error.message}`));
    }, 600);
  });
  await new Promise((resolve) => watcher.on("close", resolve));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args.watch) await runWatch(args);
  else await processOnce(args);
}

main().catch((error) => {
  console.error(`[HATA] ${error.message}`);
  process.exitCode = 1;
});
