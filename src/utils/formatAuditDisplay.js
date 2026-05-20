import auditConfig from '../data/auditFieldLabels.json';
import { resolveChargeDisplay } from './supervisorChargeDisplay';

const FIELD_LABELS = auditConfig.fieldLabels;
const FIELDS_TO_SKIP = new Set(auditConfig.fieldsToSkip || []);

const ROLE_LABELS_GR = {
  SUPERADMIN: 'Υπερδιαχειριστής',
  ADMIN: 'Διαχειριστής',
  ENGINEER: 'Μηχανικός',
  USER: 'Χρήστης'
};

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Μετατρέπει συμβολοσειρά τύπου "user:a • user:b" σε ονόματα */
function formatEngineerListString(str, catalog) {
  const s = String(str || '').trim();
  if (!s) return '(κενό)';
  if (!/user:/i.test(s)) return s;
  return s
    .split(/\s*•\s*|\s*·\s*|\s*,\s*/)
    .map((part) => resolveChargeDisplay(part.trim(), catalog))
    .filter(Boolean)
    .join(' · ') || s;
}

/**
 * Μορφοποίηση τιμής αλλαγής για εμφάνιση στο Ιστορικό Ενεργειών (όπως στο UI).
 * @param {*} value
 * @param {Array} engineerCatalog - κατάλογος μηχανικών από get-registered-engineers
 */
export function formatAuditDisplayValue(value, engineerCatalog = []) {
  if (value === null || value === undefined) return '(κενό)';
  if (typeof value === 'boolean') return value ? 'Ναι' : 'Όχι';
  if (typeof value === 'number') return String(value);

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === '(κενό)') return '(κενό)';
    if (/^user:/i.test(trimmed) || /\buser:/i.test(trimmed)) {
      return formatEngineerListString(trimmed, engineerCatalog);
    }
    const roleUpper = trimmed.toUpperCase();
    if (ROLE_LABELS_GR[roleUpper]) return ROLE_LABELS_GR[roleUpper];
    return trimmed;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '(κενό)';
    if (value.every((v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
      const strings = value.map(String);
      if (strings.some((s) => /^user:/i.test(s))) {
        return strings.map((s) => resolveChargeDisplay(s, engineerCatalog)).filter(Boolean).join(' · ') || '(κενό)';
      }
      return strings.join(' • ');
    }
    const parts = value.map((item) => {
      if (isPlainObject(item)) return formatPlainObjectInline(item, engineerCatalog);
      return String(item);
    });
    return parts.join(' | ');
  }

  if (isPlainObject(value)) {
    if (value.name && (value.path || value.filePath)) {
      return value.name;
    }
    return formatPlainObjectInline(value, engineerCatalog);
  }

  return String(value);
}

function formatPlainObjectInline(obj, engineerCatalog) {
  const keys = Object.keys(obj).filter((k) => !FIELDS_TO_SKIP.has(k) && FIELD_LABELS[k]);
  if (keys.length === 0) return '(κενό)';
  return keys
    .map((k) => {
      const label = FIELD_LABELS[k];
      const val = formatAuditDisplayValue(obj[k], engineerCatalog);
      return `${label}: ${val}`;
    })
    .join('; ');
}
