/**
 * Συγχώνευση ενός υποέργου στη λίστα Dashboard — χωρίς πλήρη επαναφόρτωση.
 */
import subprojectLifecycle from '../../app/core/subprojectLifecycle';

const INDEX_MTIME_TOLERANCE_MS = 2000;

const PRESERVE_LIST_FLAGS = ['hasEgkrisiLink', 'hasProsklisiLink', 'hasEntaxiLink'];

export function subprojectTitlesChanged(prev, next) {
  return String(prev?.projectTitle || '') !== String(next?.projectTitle || '')
    || String(prev?.subprojectTitle || '') !== String(next?.subprojectTitle || '');
}

function withPreservedFlags(loaded, previous) {
  if (!loaded || typeof loaded !== 'object') return loaded;
  const next = { ...loaded };
  if (previous) {
    PRESERVE_LIST_FLAGS.forEach((key) => {
      if (next[key] == null && previous[key] != null) next[key] = previous[key];
    });
    // Κλείδωμα: το δίσκο είναι πηγή αλήθειας όταν το loaded το δηλώνει ρητά
    // (ακόμα και isLocked:false / lockedBy:''). Αλλιώς θα έμενε το παλιό όνομα.
    if (!Object.prototype.hasOwnProperty.call(loaded, 'isLocked') && previous.isLocked != null) {
      next.isLocked = previous.isLocked;
    }
    if (!Object.prototype.hasOwnProperty.call(loaded, 'lockedBy') && previous.lockedBy) {
      next.lockedBy = previous.lockedBy;
    }
  }
  return next;
}

/**
 * @param {Array} projects
 * @param {object} loaded
 * @returns {{ projects: Array, changed: boolean, needsSort: boolean, action: 'add'|'update'|'none' }}
 */
export function mergeOneSubprojectIntoList(projects, loaded) {
  const list = Array.isArray(projects) ? projects : [];
  const sid = String(loaded?.subprojectId || '').trim();
  if (!sid) return { projects: list, changed: false, needsSort: false, action: 'none' };

  const idx = list.findIndex((p) => String(p?.subprojectId || '') === sid);
  if (idx < 0) {
    const row = withPreservedFlags(loaded, null);
    return {
      projects: [...list, row],
      changed: true,
      needsSort: true,
      action: 'add',
    };
  }

  const prev = list[idx];
  const merged = withPreservedFlags(loaded, prev);
  const next = list.slice();
  next[idx] = merged;
  return {
    projects: next,
    changed: true,
    needsSort: subprojectTitlesChanged(prev, merged),
    action: 'update',
  };
}

export function removeSubprojectFromList(projects, subprojectId) {
  return subprojectLifecycle.removeSubprojectFromList(projects, subprojectId);
}

/**
 * Σύγκριση ελαφρού ευρετηρίου (χωρίς ανάγνωση data.json).
 * @returns {{ added: Array, changed: Array, removed: Array }}
 */
export function diffProjectsIndexEntries(prevEntries, nextEntries) {
  const prev = new Map();
  (prevEntries || []).forEach((e) => {
    const id = String(e?.subprojectId || '').trim();
    if (id) prev.set(id, e);
  });
  const next = new Map();
  (nextEntries || []).forEach((e) => {
    const id = String(e?.subprojectId || '').trim();
    if (id) next.set(id, e);
  });

  const added = [];
  const changed = [];
  const removed = [];

  next.forEach((e, id) => {
    const p = prev.get(id);
    if (!p) {
      added.push(e);
      return;
    }
    const mtimeDelta = Math.abs(Number(e.mtimeMs || 0) - Number(p.mtimeMs || 0));
    if (mtimeDelta > INDEX_MTIME_TOLERANCE_MS || String(p.projectId || '') !== String(e.projectId || '')) {
      changed.push(e);
    }
  });

  prev.forEach((_e, id) => {
    if (!next.has(id)) removed.push({ subprojectId: id });
  });

  return { added, changed, removed };
}

export function collectIndexReloadTargets(diff) {
  const seen = new Set();
  const out = [];
  [...(diff?.added || []), ...(diff?.changed || [])].forEach((e) => {
    const sid = String(e?.subprojectId || '').trim();
    if (!sid || seen.has(sid)) return;
    seen.add(sid);
    out.push({
      projectId: e.projectId || '',
      subprojectId: sid,
    });
  });
  return out;
}

/** Περιορισμένη παραλληλία — για ανανεώσεις ενός-ενός χωρίς κορεσμό. */
export async function runWithConcurrency(items, limit, fn) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];
  const n = Math.max(1, Math.min(Number(limit) || 1, list.length));
  const out = new Array(list.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < list.length) {
      const idx = i;
      i += 1;
      out[idx] = await fn(list[idx], idx);
    }
  }));
  return out;
}
