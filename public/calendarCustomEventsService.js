/**
 * Ειδοποιήσεις / προθεσμίες ημερολογίου (ADMIN / SUPERADMIN).
 * Αποθήκευση: {dataDir}/config/calendar_custom_events.json
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { safeWriteJSON } = require('./safeWrite');
const { daysUntilKhmdhsDate } = require('./khmdhsDateUtils');
const calendarDeadlinesCore = require('../app/core/calendarDeadlines');

const CONFIG_DIR = 'config';
const EVENTS_FILE = 'calendar_custom_events.json';
const CUSTOM_EVENT_RETENTION_DAYS = 730;

const ALLOWED_VISIBILITY_ROLES = ['ADMIN', 'ENGINEER', 'USER'];

function getEventsPath(dataDir) {
  return path.join(dataDir, CONFIG_DIR, EVENTS_FILE);
}

function defaultStore() {
  return { events: [] };
}

function loadStore(dataDir) {
  try {
    const p = getEventsPath(dataDir);
    if (!fs.existsSync(p)) return defaultStore();
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    const events = Array.isArray(raw?.events) ? raw.events : [];
    return { events };
  } catch {
    return defaultStore();
  }
}

function saveStore(dataDir, store) {
  const dir = path.join(dataDir, CONFIG_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  safeWriteJSON(getEventsPath(dataDir), {
    events: Array.isArray(store?.events) ? store.events : [],
  });
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRoles(roles) {
  const set = new Set();
  (Array.isArray(roles) ? roles : []).forEach((r) => {
    const role = String(r || '').trim().toUpperCase();
    if (ALLOWED_VISIBILITY_ROLES.includes(role)) set.add(role);
  });
  return [...set];
}

function normalizeUsernames(list) {
  const seen = new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((u) => {
    const name = normalizeUsername(u);
    if (!name || seen.has(name)) return;
    seen.add(name);
    out.push(name);
  });
  return out;
}

function normalizeDateIso(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function normalizeEvent(raw, { actor } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || '').trim();
  const dateIso = normalizeDateIso(raw.dateIso);
  if (!title || !dateIso) return null;

  const now = new Date().toISOString();
  const id = String(raw.id || '').trim() || uuidv4();
  const createdBy = String(raw.createdBy || actor?.username || '').trim();
  const createdByFullName = String(raw.createdByFullName || actor?.fullName || createdBy).trim();

  return {
    id,
    title,
    description: String(raw.description || '').trim(),
    dateIso,
    visibilityRoles: normalizeRoles(raw.visibilityRoles),
    visibilityUsernames: normalizeUsernames(raw.visibilityUsernames),
    createdBy,
    createdByFullName,
    createdAt: String(raw.createdAt || now),
    updatedAt: now,
  };
}

function userCanSeeCustomEvent(event, user, opts) {
  return calendarDeadlinesCore.userCanSeeCustomEvent(event, user, opts);
}

function isStaleCustomEvent(event) {
  const daysLeft = daysUntilKhmdhsDate(event?.dateIso);
  return daysLeft != null && daysLeft < -CUSTOM_EVENT_RETENTION_DAYS;
}

function listEventsForUser(dataDir, user) {
  const store = loadStore(dataDir);
  const role = String(user?.role || '').trim().toUpperCase();
  return store.events.filter((ev) => {
    if (role !== 'SUPERADMIN' && isStaleCustomEvent(ev)) return false;
    return userCanSeeCustomEvent(ev, user);
  });
}

function canManageCustomEvent(event, actor) {
  return calendarDeadlinesCore.canManageCustomEvent(event, actor);
}

function upsertEvent(dataDir, payload, actor) {
  const required = calendarDeadlinesCore.collectCustomEventRequiredErrors({
    title: payload && payload.title,
    date: payload && payload.dateIso,
  });
  if (required.title || required.date) {
    return { success: false, error: 'Απαιτούνται τίτλος και έγκυρη ημερομηνία' };
  }
  const normalized = normalizeEvent(payload, { actor });
  if (!normalized) {
    return { success: false, error: 'Απαιτούνται τίτλος και έγκυρη ημερομηνία' };
  }

  const store = loadStore(dataDir);
  const idx = store.events.findIndex((e) => e.id === normalized.id);
  if (idx >= 0) {
    const prev = store.events[idx];
    if (!canManageCustomEvent(prev, actor)) {
      return { success: false, error: 'Δεν έχετε δικαίωμα επεξεργασίας αυτής της ειδοποίησης' };
    }
    normalized.createdAt = prev.createdAt || normalized.createdAt;
    normalized.createdBy = prev.createdBy || normalized.createdBy;
    normalized.createdByFullName = prev.createdByFullName || normalized.createdByFullName;
    store.events[idx] = normalized;
  } else {
    normalized.createdBy = actor?.username || normalized.createdBy;
    normalized.createdByFullName = actor?.fullName || normalized.createdByFullName;
    store.events.push(normalized);
  }

  store.events.sort(
    (a, b) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime()
      || (a.title || '').localeCompare(b.title || '', 'el', { sensitivity: 'base' })
  );
  saveStore(dataDir, store);
  return { success: true, event: normalized };
}

function deleteEvent(dataDir, eventId, actor) {
  const id = String(eventId || '').trim();
  if (!id) return { success: false, error: 'Λείπει αναγνωριστικό' };
  const store = loadStore(dataDir);
  const existing = store.events.find((e) => e.id === id);
  if (!existing) {
    return { success: false, error: 'Η εγγραφή δεν βρέθηκε' };
  }
  if (!canManageCustomEvent(existing, actor)) {
    return { success: false, error: 'Δεν έχετε δικαίωμα διαγραφής αυτής της ειδοποίησης' };
  }
  store.events = calendarDeadlinesCore.removeCustomEventFromList(store.events, id);
  saveStore(dataDir, store);
  return { success: true };
}

module.exports = {
  ALLOWED_VISIBILITY_ROLES,
  loadStore,
  listEventsForUser,
  upsertEvent,
  deleteEvent,
  canManageCustomEvent,
  userCanSeeCustomEvent,
  normalizeEvent,
};
