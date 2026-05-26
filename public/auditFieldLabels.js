/**
 * Ετικέτες πεδίων ιστορικού — ίδιες με τις ετικέτες φορμών στο frontend.
 */
const path = require('path');
const fs = require('fs');

const labelsPathLocal = path.join(__dirname, 'auditFieldLabels.json');
const labelsPathSrc = path.join(__dirname, '..', 'src', 'data', 'auditFieldLabels.json');
const labelsPath = fs.existsSync(labelsPathLocal) ? labelsPathLocal : labelsPathSrc;
const config = JSON.parse(fs.readFileSync(labelsPath, 'utf8'));

const { resolveChargeLabel } = require('./chargeFilterUtils');

const FIELD_LABELS_GR = config.fieldLabels;
const ARRAY_ITEM_PREFIXES = config.arrayItemPrefixes || {};
const AUDIT_FIELDS_TO_SKIP = new Set(config.fieldsToSkip || []);

const ENGINEER_VALUE_KEYS = new Set([
  'supervisorEngineerIds',
  'supervisorChargeFreePrimary',
  'supervisorChargeFreeParticipants',
  'assignedSupervisors'
]);

const ROLE_LABELS_GR = {
  SUPERADMIN: 'Υπερδιαχειριστής',
  ADMIN: 'Διαχειριστής',
  ENGINEER: 'Μηχανικός',
  USER: 'Χρήστης'
};

function getFieldLabel(key) {
  return FIELD_LABELS_GR[key] || null;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isEmptyValue(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function normalizeString(s) {
  return s
    .normalize('NFC')
    .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deepNormalize(v) {
  if (typeof v === 'string') return normalizeString(v);
  if (Array.isArray(v)) return v.map(deepNormalize);
  if (isPlainObject(v)) {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = deepNormalize(val);
    return out;
  }
  return v;
}

function valuesEqual(a, b) {
  return JSON.stringify(deepNormalize(a)) === JSON.stringify(deepNormalize(b));
}

function formatAuditScalar(key, value, catalog) {
  if (isEmptyValue(value)) return '(κενό)';
  if (key === 'role') {
    const r = String(value).toUpperCase();
    return ROLE_LABELS_GR[r] || value;
  }
  if (ENGINEER_VALUE_KEYS.has(key)) {
    if (Array.isArray(value)) {
      return value
        .map((v) => resolveChargeLabel(v, catalog))
        .filter(Boolean)
        .join(' · ') || '(κενό)';
    }
    return resolveChargeLabel(value, catalog) || String(value);
  }
  if (typeof value === 'string' && /^user:/i.test(value)) {
    return resolveChargeLabel(value, catalog) || value;
  }
  return value;
}

function summarizeArray(arr, key, catalog) {
  if (!Array.isArray(arr) || arr.length === 0) return '(κενό)';
  if (arr.every((v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
    const strings = arr.map(String);
    if (ENGINEER_VALUE_KEYS.has(key) || strings.some((s) => /^user:/i.test(s))) {
      return strings
        .map((s) => resolveChargeLabel(s, catalog))
        .filter(Boolean)
        .join(' · ') || '(κενό)';
    }
    return strings.join(' • ');
  }
  return `${arr.length} ${arr.length === 1 ? 'εγγραφή' : 'εγραφές'}`;
}

function collectObjectChanges(oldObj, newObj, prefix = '', catalog = []) {
  const changes = {};
  const allKeys = new Set([
    ...Object.keys(oldObj || {}),
    ...Object.keys(newObj || {})
  ]);

  for (const key of allKeys) {
    if (AUDIT_FIELDS_TO_SKIP.has(key)) continue;

    const label = getFieldLabel(key);
    if (!label) continue;

    const fullLabel = prefix ? `${prefix} — ${label}` : label;
    const oldVal = oldObj ? oldObj[key] : undefined;
    const newVal = newObj ? newObj[key] : undefined;

    if (valuesEqual(oldVal, newVal)) continue;

    if (isPlainObject(oldVal) || isPlainObject(newVal)) {
      const nested = collectObjectChanges(
        isPlainObject(oldVal) ? oldVal : {},
        isPlainObject(newVal) ? newVal : {},
        fullLabel,
        catalog
      );
      Object.assign(changes, nested);
      continue;
    }

    if (Array.isArray(oldVal) || Array.isArray(newVal)) {
      const oldArr = Array.isArray(oldVal) ? oldVal : [];
      const newArr = Array.isArray(newVal) ? newVal : [];
      const itemPrefix = ARRAY_ITEM_PREFIXES[key];

      if (itemPrefix && newArr.some(isPlainObject)) {
        const maxLen = Math.max(oldArr.length, newArr.length);
        for (let i = 0; i < maxLen; i++) {
          const itemLabel = `${itemPrefix} ${i + 1}`;
          const nested = collectObjectChanges(oldArr[i] || {}, newArr[i] || {}, itemLabel, catalog);
          Object.assign(changes, nested);
        }
        continue;
      }

      changes[fullLabel] = {
        old: summarizeArray(oldArr, key, catalog),
        new: summarizeArray(newArr, key, catalog)
      };
      continue;
    }

    changes[fullLabel] = {
      old: formatAuditScalar(key, oldVal, catalog),
      new: formatAuditScalar(key, newVal, catalog)
    };
  }

  return changes;
}

function collectAuditChanges(oldValue, newValue, options = {}) {
  const catalog = options.engineerCatalog || [];

  if (isPlainObject(oldValue) && isPlainObject(newValue)) {
    return collectObjectChanges(oldValue, newValue, '', catalog);
  }

  if (typeof oldValue !== 'object' || typeof newValue !== 'object') {
    return {
      Τιμή: { old: oldValue ?? '(κενό)', new: newValue ?? '(κενό)' }
    };
  }

  return collectObjectChanges(
    isPlainObject(oldValue) ? oldValue : {},
    isPlainObject(newValue) ? newValue : {},
    '',
    catalog
  );
}

module.exports = {
  FIELD_LABELS_GR,
  AUDIT_FIELDS_TO_SKIP,
  ARRAY_ITEM_PREFIXES,
  getFieldLabel,
  collectAuditChanges
};
