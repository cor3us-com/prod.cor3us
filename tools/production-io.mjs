import crypto from 'node:crypto';
import fs from 'node:fs/promises';

export function csvValue(value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join(',');
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return String(value).trim();
}

function parseDelimited(text, delimiter = ';') {
  const result = [];
  let row = [];
  let field = '';
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
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      result.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    result.push(row);
  }
  return result.filter((fields) => fields.some((value) => value !== ''));
}

function escapeDelimited(value, delimiter = ';') {
  const stringValue = csvValue(value);
  if (stringValue.includes(delimiter) || stringValue.includes('"') || /[\r\n]/.test(stringValue)) {
    return '"' + stringValue.replaceAll('"', '""') + '"';
  }
  return stringValue;
}

export async function readCsv(filePath) {
  const originalText = await fs.readFile(filePath, 'utf8');
  const matrix = parseDelimited(originalText);
  if (!matrix.length) throw new Error('CSV başlığı bulunamadı: ' + filePath);
  const headers = matrix[0];
  const rows = matrix.slice(1).map((fields) =>
    Object.fromEntries(headers.map((header, index) => [header, fields[index] || ''])),
  );
  return { filePath, headers, originalText, rows };
}

export function serializeCsv(table) {
  const lines = [table.headers.map((header) => escapeDelimited(header)).join(';')];
  for (const row of table.rows) {
    lines.push(table.headers.map((header) => escapeDelimited(row[header] || '')).join(';'));
  }
  return lines.join('\n') + '\n';
}

export function blankRow(headers) {
  return Object.fromEntries(headers.map((header) => [header, '']));
}

export function splitIds(value) {
  return csvValue(value).split(/[,\s|]+/).map((item) => item.trim()).filter(Boolean);
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function intersects(value, ids) {
  return splitIds(value).some((id) => ids.has(id));
}

export function mergeNote(current, addition) {
  const parts = String(current || '').split(' | ').map((item) => item.trim()).filter(Boolean);
  if (!parts.includes(addition)) parts.push(addition);
  return parts.join(' | ');
}

export function normalizeKey(value) {
  return csvValue(value)
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleUpperCase('tr-TR')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

export function nextId(prefix, usedIds) {
  let max = 0;
  for (const id of usedIds) {
    const match = new RegExp('^' + prefix + '-(\\d+)$').exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  let candidate;
  do {
    max += 1;
    candidate = prefix + '-' + String(max).padStart(3, '0');
  } while (usedIds.has(candidate));
  usedIds.add(candidate);
  return candidate;
}

export function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function hashText(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function rowSignature(row, headers) {
  return hashText(JSON.stringify(headers.map((header) => csvValue(row[header]))));
}

export function changedRows(beforeRows, afterRows, headers, key) {
  const before = new Map(beforeRows.filter((row) => row[key]).map((row) => [row[key], row]));
  const after = new Map(afterRows.filter((row) => row[key]).map((row) => [row[key], row]));
  const ids = new Set([...before.keys(), ...after.keys()]);
  return new Set([...ids].filter((id) =>
    rowSignature(before.get(id) || {}, headers) !== rowSignature(after.get(id) || {}, headers),
  ));
}

export function entitySignatures(table, key) {
  return Object.fromEntries(
    table.rows.filter((row) => row[key]).map((row) => [row[key], rowSignature(row, table.headers)]),
  );
}
