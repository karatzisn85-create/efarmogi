/**
 * Ρυθμίσεις Ημερολογίου Προθεσμιών (Φάση 3β).
 * Αποθήκευση: {dataDir}/config/calendar_config.json
 *
 * eventTypeSettings: παραλήπτες ανά τύπο γεγονότος.
 * Τα παλιά πεδία recipientRoles / recipientUsernames / notifyEventTypes
 * διατηρούνται για συμβατότητα και γεμίζουν αυτόματα από τα eventTypeSettings.
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
  PROSKLISI_DEADLINE: 'prosklisi_deadline',
};

const ALLOWED_NOTIFY_EVENT_TYPES = Object.values(NOTIFY_EVENT_TYPES);

const NOTIFY_EVENT_TYPE_LABELS = {
  [NOTIFY_EVENT_TYPES.DEADLINE]: 'Καταληκτική υποβολής προσφορών',
  [NOTIFY_EVENT_TYPES.OFFERS_EXPIRY]: 'Λήξη ισχύος προσφορών',
  [NOTIFY_EVENT_TYPES.CONTRACT_END]: 'Λήξη σύμβασης',
  [NOTIFY_EVENT_TYPES.COMPLIANCE_12M]: 'Παράβαση κανόνα 12 μηνών',
  [NOTIFY_EVENT_TYPES.CUSTOM]: 'Ειδοποίηση ημερολογίου',
  [NOTIFY_EVENT_TYPES.PROSKLISI_DEADLINE]: 'Λήξη υποβολής πρόσκλησης',
};

function normalizeRolesAllowEmpty(roles) {
  const set = new Set();
  (Array.isArray(roles) ? roles : []).forEach((r) => {
    const role = String(r || '').trim().toUpperCase();
    if (ALLOWED_ROLES.includes(role)) set.add(role);
  });
  return [...set];
}

function normalizeRoles(roles) {
  const normalized = normalizeRolesAllowEmpty(roles);
  if (!normalized.length) return [...ALLOWED_ROLES];
  return normalized;
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

function makeEventTypeSetting({ enabled = true, recipientRoles, recipientUsernames } = {}) {
  const roles = normalizeRolesAllowEmpty(recipientRoles);
  const users = normalizeUsernames(recipientUsernames);
  // Άδειοι ρόλοι επιτρέπονται αν υπάρχουν συγκεκριμένοι χρήστες.
  // Μόνο αν λείπουν και τα δύο → προεπιλογή Διαχειριστές.
  const finalRoles = roles.length ? roles : (users.length ? [] : ['ADMIN']);
  return {
    enabled: enabled === true,
    recipientRoles: finalRoles,
    recipientUsernames: users,
  };
}

function defaultEventTypeSettings() {
  const out = {};
  ALLOWED_NOTIFY_EVENT_TYPES.forEach((type) => {
    out[type] = makeEventTypeSetting({
      enabled: true,
      recipientRoles: ['ADMIN', 'ENGINEER'],
      recipientUsernames: [],
    });
  });
  return out;
}

/**
 * Μετατροπή παλιού σχήματος (κοινοί παραλήπτες) → ανά τύπο.
 * Αν υπάρχει ήδη eventTypeSettings, συμπληρώνει τυχόν νέους τύπους.
 */
function normalizeEventTypeSettings(rawSettings, legacy = {}) {
  const legacyRoles = normalizeRolesAllowEmpty(legacy.recipientRoles);
  const fallbackRoles = legacyRoles.length ? legacyRoles : ['ADMIN', 'ENGINEER'];
  const legacyUsers = normalizeUsernames(legacy.recipientUsernames);
  const legacyEnabled = new Set(normalizeNotifyEventTypes(legacy.notifyEventTypes));
  const src = rawSettings && typeof rawSettings === 'object' ? rawSettings : null;
  const out = {};

  ALLOWED_NOTIFY_EVENT_TYPES.forEach((type) => {
    const row = src && src[type] && typeof src[type] === 'object' ? src[type] : null;
    if (row) {
      out[type] = makeEventTypeSetting({
        enabled: row.enabled !== false,
        recipientRoles: row.recipientRoles,
        recipientUsernames: row.recipientUsernames,
      });
    } else {
      out[type] = makeEventTypeSetting({
        enabled: legacyEnabled.has(type),
        recipientRoles: fallbackRoles,
        recipientUsernames: legacyUsers,
      });
    }
  });
  return out;
}

function deriveNotifyEventTypes(eventTypeSettings) {
  // Κενή λίστα = κανένας ενεργός τύπος (όχι fallback σε «όλοι»).
  return ALLOWED_NOTIFY_EVENT_TYPES.filter(
    (type) => eventTypeSettings?.[type]?.enabled === true
  );
}

function deriveLegacyRecipients(eventTypeSettings) {
  const roles = new Set();
  const users = new Set();
  ALLOWED_NOTIFY_EVENT_TYPES.forEach((type) => {
    const row = eventTypeSettings?.[type];
    if (!row || row.enabled !== true) return;
    (row.recipientRoles || []).forEach((r) => roles.add(r));
    (row.recipientUsernames || []).forEach((u) => users.add(u));
  });
  return {
    recipientRoles: roles.size ? [...roles] : ['ADMIN'],
    recipientUsernames: [...users],
  };
}

function getEventTypeSetting(config, eventType) {
  const type = String(eventType || '').trim().toLowerCase();
  if (!type) return null;
  if (config?.eventTypeSettings?.[type]) return config.eventTypeSettings[type];
  return makeEventTypeSetting({
    enabled: normalizeNotifyEventTypes(config?.notifyEventTypes).includes(type),
    recipientRoles: config?.recipientRoles || ['ADMIN', 'ENGINEER'],
    recipientUsernames: config?.recipientUsernames || [],
  });
}

function isNotifyEventTypeEnabled(config, eventType) {
  const setting = getEventTypeSetting(config, eventType);
  return !!(setting && setting.enabled === true);
}

function roleMatchesRecipientRoles(role, recipientRoles) {
  const r = String(role || '').trim().toUpperCase();
  const roles = new Set((recipientRoles || []).map((x) => String(x || '').trim().toUpperCase()));
  if (r === 'SUPERADMIN') return roles.has('ADMIN');
  return roles.has(r);
}

function userMatchesEventTypeRecipients(user, eventTypeSetting) {
  if (!user || !eventTypeSetting || eventTypeSetting.enabled !== true) return false;
  const username = String(user.username || '').trim().toLowerCase();
  if (!username) return false;
  const explicit = new Set(
    (eventTypeSetting.recipientUsernames || []).map((u) => String(u || '').trim().toLowerCase())
  );
  if (explicit.has(username)) return true;
  return roleMatchesRecipientRoles(user.role, eventTypeSetting.recipientRoles);
}

function normalizeUrgentRepeat(raw) {
  const base = {
    enabled: true,
    maxCount: 3,
    intervalHours: 24,
  };
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

function defaultConfig() {
  const eventTypeSettings = defaultEventTypeSettings();
  const legacy = deriveLegacyRecipients(eventTypeSettings);
  return {
    enabled: false,
    recipientRoles: legacy.recipientRoles,
    recipientUsernames: legacy.recipientUsernames,
    daysBefore: [7, 3, 1, 0],
    notifyEventTypes: deriveNotifyEventTypes(eventTypeSettings),
    eventTypeSettings,
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

function normalizeConfig(raw) {
  const base = defaultConfig();
  const src = raw && typeof raw === 'object' ? raw : {};
  const eventTypeSettings = normalizeEventTypeSettings(src.eventTypeSettings, {
    recipientRoles: src.recipientRoles || base.recipientRoles,
    recipientUsernames: src.recipientUsernames || base.recipientUsernames,
    notifyEventTypes: src.notifyEventTypes,
  });
  const legacy = deriveLegacyRecipients(eventTypeSettings);
  return {
    enabled: src.enabled === true,
    recipientRoles: legacy.recipientRoles,
    recipientUsernames: legacy.recipientUsernames,
    daysBefore: normalizeDaysBefore(src.daysBefore || base.daysBefore),
    notifyEventTypes: deriveNotifyEventTypes(eventTypeSettings),
    eventTypeSettings,
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
  defaultEventTypeSettings,
  loadCalendarConfig,
  saveCalendarConfig,
  normalizeConfig,
  normalizeNotifyEventTypes,
  normalizeEventTypeSettings,
  isNotifyEventTypeEnabled,
  getEventTypeSetting,
  userMatchesEventTypeRecipients,
  roleMatchesRecipientRoles,
  makeEventTypeSetting,
};
