/**
 * Ισχύουσα προθεσμία υποβολής πρόσκλησης (με τροποποιήσεις).
 * Κοινό helper για main process (ημερολόγιο / υπενθυμίσεις).
 */

function parseProsklisiDeadline(dateString) {
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

function getEffectiveProsklisiDeadline(prosklisi, modifications = []) {
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

function loadProsklisiModificationsFromDir(prosklisiDir) {
  try {
    const fs = require('fs');
    const path = require('path');
    const modificationsPath = path.join(prosklisiDir, 'modifications.json');
    if (!fs.existsSync(modificationsPath)) return [];
    const data = JSON.parse(fs.readFileSync(modificationsPath, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function applyEffectiveDeadlineToProsklisi(prosklisi, prosklisiDir, { persist = false } = {}) {
  if (!prosklisi || typeof prosklisi !== 'object') return prosklisi;
  const mods = loadProsklisiModificationsFromDir(prosklisiDir);
  const effective = getEffectiveProsklisiDeadline(prosklisi, mods);
  if (!effective || String(effective) === String(prosklisi.deadline || '')) {
    return prosklisi;
  }
  const updated = {
    ...prosklisi,
    deadline: effective,
    updatedAt: prosklisi.updatedAt || new Date().toISOString(),
  };
  if (persist && prosklisiDir) {
    try {
      const fs = require('fs');
      const path = require('path');
      const { safeWriteJSON } = require('./safeWrite');
      const dataFilePath = path.join(prosklisiDir, 'data.json');
      if (fs.existsSync(dataFilePath)) {
        safeWriteJSON(dataFilePath, updated);
      }
    } catch {
      // Η οθόνη εξακολουθεί να βλέπει την ισχύουσα τιμή ακόμα κι αν αποτύχει το γράψιμο
    }
  }
  return updated;
}

module.exports = {
  parseProsklisiDeadline,
  getEffectiveProsklisiDeadline,
  applyEffectiveDeadlineToProsklisi,
  loadProsklisiModificationsFromDir,
};
