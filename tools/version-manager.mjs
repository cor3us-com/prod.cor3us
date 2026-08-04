import crypto from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const REGISTRY_PATH = path.join(ROOT, '00_admin', 'version-registry.json');
const GENERAL_VERSIONS = path.join(ROOT, '00_admin', 'versions');

export const TRACKED_FILES = {
  screenplay: {
    working: path.join(ROOT, '01_story', 'source', 'screenplay.fountain'),
    revisions: path.join(ROOT, '01_story', 'revisions'),
  },
  scenes: {
    working: path.join(ROOT, '02_breakdown', 'sequential_breakdown.csv'),
    revisions: path.join(GENERAL_VERSIONS, 'sequential_breakdown'),
  },
  locations: {
    working: path.join(ROOT, '02_breakdown', 'location_index.csv'),
    revisions: path.join(GENERAL_VERSIONS, 'location_index'),
  },
  elements: {
    working: path.join(ROOT, '02_breakdown', 'elements_breakdown.csv'),
    revisions: path.join(GENERAL_VERSIONS, 'elements_breakdown'),
  },
  shots: {
    working: path.join(ROOT, '02_breakdown', 'shot_list.csv'),
    revisions: path.join(GENERAL_VERSIONS, 'shot_list'),
  },
  schedule: {
    working: path.join(ROOT, '03_schedule', 'shooting_schedule.csv'),
    revisions: path.join(GENERAL_VERSIONS, 'shooting_schedule'),
  },
  budget: {
    working: path.join(ROOT, '04_budget', 'budget.csv'),
    revisions: path.join(GENERAL_VERSIONS, 'budget'),
  },
  research: {
    working: path.join(ROOT, '05_research', 'research_log.csv'),
    revisions: path.join(GENERAL_VERSIONS, 'research_log'),
  },
  evidence: {
    working: path.join(ROOT, '05_research', 'evidence_register.csv'),
    revisions: path.join(GENERAL_VERSIONS, 'evidence_register'),
  },
};

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

async function hashFile(filePath) {
  const data = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function loadVersionRegistry() {
  if (!(await exists(REGISTRY_PATH))) {
    return {
      schema_version: '1.0.0',
      updated_at: null,
      sources: {},
    };
  }
  return JSON.parse(await fs.readFile(REGISTRY_PATH, 'utf8'));
}

function nextVersion(entry) {
  return Number(entry?.active_version || 0) + 1;
}

function revisionName(workingPath, version) {
  const parsed = path.parse(workingPath);
  return parsed.name + '.v' + String(version).padStart(3, '0') + parsed.ext.toLowerCase();
}

export function resolveActivePath(key, registry) {
  const active = registry?.sources?.[key]?.active_file;
  if (!active) return null;
  const resolved = path.resolve(ROOT, active);
  const relative = path.relative(ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Aktif sürüm proje dışında: ' + active);
  }
  return resolved;
}

export async function snapshotTrackedFiles(trigger) {
  const registry = await loadVersionRegistry();
  const created = [];
  for (const [key, config] of Object.entries(TRACKED_FILES)) {
    if (!(await exists(config.working))) continue;
    const hash = await hashFile(config.working);
    const current = registry.sources[key];
    if (current?.hash_sha256 === hash) continue;
    const version = nextVersion(current);
    const destination = path.join(config.revisions, revisionName(config.working, version));
    await fs.mkdir(config.revisions, { recursive: true });
    await fs.copyFile(config.working, destination, fsConstants.COPYFILE_EXCL);
    const now = new Date().toISOString();
    registry.sources[key] = {
      key,
      working_file: rel(config.working),
      active_version: version,
      active_file: rel(destination),
      hash_sha256: hash,
      created_at: now,
      trigger,
      previous_file: current?.active_file || null,
    };
    created.push({
      key,
      version,
      active_file: rel(destination),
      hash_sha256: hash,
    });
  }
  if (created.length) {
    registry.updated_at = new Date().toISOString();
    await fs.mkdir(path.dirname(REGISTRY_PATH), { recursive: true });
    await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n', 'utf8');
  }
  return { created, registry };
}

export { REGISTRY_PATH };
