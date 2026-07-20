/**
 * Προθεσμίες προσκλήσεων — urgencies για κάρτες / φίλτρα / ταξινόμηση.
 */

export function parseProsklisiDeadline(dateString) {
  if (!dateString || dateString === '-') return null;
  const raw = String(dateString).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(`${raw.slice(0, 10)}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(raw)) {
    const sep = raw.includes('/') ? '/' : '-';
    const [dd, mm, yyyy] = raw.split(sep);
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isUsableDeadlineValue(value) {
  if (value == null) return false;
  const s = String(value).trim();
  return !!s && s !== '-';
}

function modificationTimeMs(mod) {
  const candidates = [
    mod?.modificationDocumentDate,
    mod?.createdAt,
    mod?.updatedAt,
  ];
  for (const c of candidates) {
    if (!c) continue;
    const parsed = parseProsklisiDeadline(c);
    if (parsed) return parsed.getTime();
    const t = Date.parse(c);
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function sortModificationsChronologically(modifications) {
  return [...(modifications || [])].sort((a, b) => {
    const ta = modificationTimeMs(a);
    const tb = modificationTimeMs(b);
    if (ta !== tb) return ta - tb;
    return String(a?.createdAt || '').localeCompare(String(b?.createdAt || ''));
  });
}

/**
 * Ισχύουσα ημερομηνία λήξης υποβολής: η τελευταία τροποποίηση που άλλαξε
 * το πεδίο deadline, αλλιώς το πεδίο της πρόσκλησης.
 */
export function getEffectiveProsklisiDeadline(prosklisi, modifications = []) {
  const mods = sortModificationsChronologically(modifications);
  const deadlineChanges = mods.filter((m) => isUsableDeadlineValue(m?.changes?.deadline?.current));

  if (deadlineChanges.length > 0) {
    let deadline = deadlineChanges[0].changes.deadline.original;
    if (!isUsableDeadlineValue(deadline)) {
      deadline = prosklisi?.deadline || '';
    }
    for (const mod of deadlineChanges) {
      deadline = mod.changes.deadline.current;
    }
    return deadline;
  }

  return prosklisi?.deadline || '';
}

function startOfToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

/**
 * @returns {'expired'|'urgent'|'soon'|'ok'|'none'}
 * urgent: λήγει σε ≤7 ημέρες (συμπεριλ. σήμερα)
 * soon: λήγει σε 8–30 ημέρες
 */
export function getProsklisiDeadlineUrgency(deadline, now = new Date()) {
  const d = parseProsklisiDeadline(deadline);
  if (!d) return 'none';
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'expired';
  if (diffDays <= 7) return 'urgent';
  if (diffDays <= 30) return 'soon';
  return 'ok';
}

export function getProsklisiDeadlineDaysLeft(deadline, now = new Date()) {
  const d = parseProsklisiDeadline(deadline);
  if (!d) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function getProsklisiDeadlineChipMeta(deadline, formatDateFn) {
  const urgency = getProsklisiDeadlineUrgency(deadline);
  if (urgency === 'none') return null;
  const days = getProsklisiDeadlineDaysLeft(deadline);
  const dateLabel = typeof formatDateFn === 'function' ? formatDateFn(deadline) : String(deadline);
  let label = `Λήξη: ${dateLabel}`;
  let title = 'Ημερομηνία λήξης υποβολής';
  if (urgency === 'expired') {
    label = `Έληξε · ${dateLabel}`;
    title = 'Η προθεσμία υποβολής έχει παρέλθει';
  } else if (urgency === 'urgent') {
    label = days === 0 ? `Λήγει σήμερα · ${dateLabel}` : `Λήγει σε ${days} ημ. · ${dateLabel}`;
    title = 'Προθεσμία εντός 7 ημερών';
  } else if (urgency === 'soon') {
    label = `Λήγει σε ${days} ημ. · ${dateLabel}`;
    title = 'Προθεσμία εντός 30 ημερών';
  }
  return { urgency, label, title, days };
}

/** Ταξινόμηση: ληγμένες πρώτα (πιο πρόσφατα ληγμένες), μετά επείγουσες, μετά οι υπόλοιπες. Χωρίς ημερομηνία στο τέλος. */
export function compareProskliseisByDeadline(a, b) {
  const da = parseProsklisiDeadline(a?.deadline);
  const db = parseProsklisiDeadline(b?.deadline);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return da.getTime() - db.getTime();
}

export function isProsklisiDeadlineExpiringSoon(deadline, withinDays = 30) {
  const urgency = getProsklisiDeadlineUrgency(deadline);
  if (urgency === 'expired' || urgency === 'urgent' || urgency === 'soon') {
    if (withinDays <= 7) return urgency === 'expired' || urgency === 'urgent';
    return true;
  }
  return false;
}

/** Tabs προβολής προσκλήσεων (μόνο UI — δεν αλλάζει κατάσταση εγγραφής). */
export const PROSKLISI_VIEW_TABS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  SUBMITTED: 'submitted',
};

export function isProsklisiSubmittedStatus(status) {
  const s = String(status || '').trim();
  return s === 'Υποβληθέν ΤΔΠ' || s === 'Υποβληθέν';
}

/**
 * Ενεργές | Ληγμένες | Υποβληθείσες
 * — Υποβληθείσες: ολοκληρωμένες ανεξαρτήτως ημερομηνίας
 * — Ληγμένες: ανοιχτές με παρελθούσα ισχύουσα προθεσμία
 * — Ενεργές: ανοιχτές χωρίς λήξη (ή χωρίς ημερομηνία)
 */
export function getProsklisiViewTab(prosklisi, modifications = [], now = new Date()) {
  if (isProsklisiSubmittedStatus(prosklisi?.status)) {
    return PROSKLISI_VIEW_TABS.SUBMITTED;
  }
  const deadline = getEffectiveProsklisiDeadline(prosklisi, modifications);
  if (getProsklisiDeadlineUrgency(deadline, now) === 'expired') {
    return PROSKLISI_VIEW_TABS.EXPIRED;
  }
  return PROSKLISI_VIEW_TABS.ACTIVE;
}

function deadlineSortKey(prosklisi, modificationsById) {
  const mods = modificationsById?.[prosklisi?.prosklisiId] || [];
  const d = parseProsklisiDeadline(getEffectiveProsklisiDeadline(prosklisi, mods));
  return d ? d.getTime() : null;
}

/** Ενεργές: πιο κοντινή λήξη πρώτα · χωρίς ημερομηνία στο τέλος */
export function compareActiveProskliseis(a, b, modificationsById = {}) {
  const ta = deadlineSortKey(a, modificationsById);
  const tb = deadlineSortKey(b, modificationsById);
  if (ta == null && tb == null) return 0;
  if (ta == null) return 1;
  if (tb == null) return -1;
  return ta - tb;
}

/** Ληγμένες: πιο πρόσφατα ληγμένες πρώτα */
export function compareExpiredProskliseis(a, b, modificationsById = {}) {
  const ta = deadlineSortKey(a, modificationsById);
  const tb = deadlineSortKey(b, modificationsById);
  if (ta == null && tb == null) return 0;
  if (ta == null) return 1;
  if (tb == null) return -1;
  return tb - ta;
}

export function partitionProskliseisByViewTab(proskliseis, modificationsById = {}, now = new Date()) {
  const out = {
    [PROSKLISI_VIEW_TABS.ACTIVE]: [],
    [PROSKLISI_VIEW_TABS.EXPIRED]: [],
    [PROSKLISI_VIEW_TABS.SUBMITTED]: [],
  };
  for (const p of proskliseis || []) {
    const tab = getProsklisiViewTab(p, modificationsById[p.prosklisiId] || [], now);
    out[tab].push(p);
  }
  out[PROSKLISI_VIEW_TABS.ACTIVE].sort((a, b) => compareActiveProskliseis(a, b, modificationsById));
  out[PROSKLISI_VIEW_TABS.EXPIRED].sort((a, b) => compareExpiredProskliseis(a, b, modificationsById));
  out[PROSKLISI_VIEW_TABS.SUBMITTED].sort((a, b) =>
    String(a?.title || '').localeCompare(String(b?.title || ''), 'el', { sensitivity: 'base' })
  );
  return out;
}

export { startOfToday };
