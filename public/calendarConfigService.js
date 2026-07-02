/**
 * Ρυθμίσεις Ημερολογίου Προθεσμιών (Φάση 3β).
 * Αποθήκευση: {dataDir}/config/calendar_config.json
 */
const fs = require('fs');
const path = require('path');
const { safeWriteJSON } = require('./safeWrite');

const CONFIG_DIR = 'config';
const CONFIG_FILE = 'calendar_config.json';

const ALLOWED_ROLES = ['ADMIN', 'ENGINEER', 'USER'];

const NOTIFY_EVENT_TYPES = {
  DEADLINE: 'deadline',
  OFFERS_EXPIRY: 'offers_expiry',
  CONTRACT_END: 'contract_end',
  COMPLIANCE_12M: 'compliance_12m',
  CUSTOM: 'custom',
};

const ALLOWED_NOTIFY_EVENT_TYPES = Object.values(NOTIFY_EVENT_TYPES);

const NOTIFY_EVENT_TYPE_LABELS = {
  [NOTIFY_EVENT_TYPES.DEADLINE]: 'Καταληκτική υποβολής προσφορών',
  [NOTIFY_EVENT_TYPES.OFFERS_EXPIRY]: 'Λήξη ισχύος προσφορών',
  [NOTIFY_EVENT_TYPES.CONTRACT_END]: 'Λήξη σύμβασης',
  [NOTIFY_EVENT_TYPES.COMPLIANCE_12M]: 'Παράβαση κανόνα 12 μηνών',
  [NOTIFY_EVENT_TYPES.CUSTOM]: 'Ειδοποίηση ημερολογίου',
};

function defaultConfig() {
  return {
    enabled: false,
    recipientRoles: ['ADMIN', 'ENGINEER'],
    recipientUsernames: [],
    daysBefore: [7, 3, 1, 0],
    notifyEventTypes: [...ALLOWED_NOTIFY_EVENT_TYPES],
    urgentRepeat: {
      enabled: true,
      maxCount: 3,
      intervalHours: 24,
    },
  };
}

function getConfigPath(dataDir) {
  return path.join(dataDir, CONFIG_DIR, CONFIG_FILE);
}

function normalizeRoles(roles) {
  const set = new Set();
  (Array.isArray(roles) ? roles : []).forEach((r) => {
    const role = String(r || '').trim().toUpperCase();
    if (ALLOWED_ROLES.includes(role)) set.add(role);
  });
  if (!set.size) ALLOWED_ROLES.forEach((r) => set.add(r));
  return [...set];
}

function normalizeDaysBefore(days) {
  const nums = (Array.isArray(days) ? days : [])
    .map((d) => Number(d))
    .filter((d) => Number.isFinite(d) && d >= 0 && d <= 365);
  const unique = [...new Set(nums)].sort((a, b) => b - a);
  return unique.length ? unique : [7, 3, 1, 0];
}

function normalizeUsernames(list) {
  const seen = new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((u) => {
    const name = String(u || '').trim().toLowerCase();
    if (!name || seen.has(name)) return;
    seen.add(name);
    out.push(name);
  });
  return out;
}

function normalizeNotifyEventTypes(types) {
  const set = new Set();
  (Array.isArray(types) ? types : []).forEach((t) => {
    const type = String(t || '').trim().toLowerCase();
    if (ALLOWED_NOTIFY_EVENT_TYPES.includes(type)) set.add(type);
  });
  return set.size ? [...set] : [...ALLOWED_NOTIFY_EVENT_TYPES];
}

function isNotifyEventTypeEnabled(config, eventType) {
  const type = String(eventType || '').trim().toLowerCase();
  if (!type) return false;
  const enabled = normalizeNotifyEventTypes(config?.notifyEventTypes);
  return enabled.includes(type);
}

function normalizeUrgentRepeat(raw) {
  const base = defaultConfig().urgentRepeat;
  const src = raw && typeof raw === 'object' ? raw : {};
  const maxCount = Number(src.maxCount);
  const intervalHours = Number(src.intervalHours);
  return {
    enabled: src.enabled !== false,
    maxCount: Number.isFinite(maxCount) && maxCount > 0 ? Math.min(maxCount, 14) : base.maxCount,
    intervalHours: Number.isFinite(intervalHours) && intervalHours >= 6
      ? Math.min(intervalHours, 168)
      : base.intervalHours,
  };
}

function normalizeConfig(raw) {
  const base = defaultConfig();
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: src.enabled === true,
    recipientRoles: normalizeRoles(src.recipientRoles || base.recipientRoles),
    recipientUsernames: normalizeUsernames(src.recipientUsernames),
    daysBefore: normalizeDaysBefore(src.daysBefore || base.daysBefore),
    notifyEventTypes: normalizeNotifyEventTypes(src.notifyEventTypes),
    urgentRepeat: normalizeUrgentRepeat(src.urgentRepeat),
  };
}

function loadCalendarConfig(dataDir) {
  try {
    const p = getConfigPath(dataDir);
    if (!fs.existsSync(p)) return defaultConfig();
    return normalizeConfig(JSON.parse(fs.readFileSync(p, 'utf8')));
  } catch {
    return defaultConfig();
  }
}

function saveCalendarConfig(dataDir, config) {
  const normalized = normalizeConfig(config);
  const dir = path.join(dataDir, CONFIG_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  safeWriteJSON(getConfigPath(dataDir), normalized);
  return normalized;
}

module.exports = {
  ALLOWED_ROLES,
  ALLOWED_NOTIFY_EVENT_TYPES,
  NOTIFY_EVENT_TYPES,
  NOTIFY_EVENT_TYPE_LABELS,
  defaultConfig,
  loadCalendarConfig,
  saveCalendarConfig,
  normalizeConfig,
  normalizeNotifyEventTypes,
  isNotifyEventTypeEnabled,
};
