/**
 * Συγχρονισμός λίστας υποέργων με το ελαφρύ ευρετήριο.
 * Νέα / διαγραμμένα / αλλαγμένα υποέργα εντοπίζονται χωρίς να ξαναδιαβαστούν όλα τα αρχεία.
 * Αν το ευρετήριο λείπει, ο καλών πέφτει σε πλήρη φόρτωση.
 */
import { diffProjectsIndexEntries, INDEX_MTIME_TOLERANCE_MS } from './mergeLoadedSubproject';

export function planCatalogCatchUp(knownProjects, indexEntries, previousEntries) {
  if (!Array.isArray(indexEntries)) {
    return { ok: false, missing: [], removedIds: [], changed: [] };
  }

  const knownIds = new Set();
  (knownProjects || []).forEach((project) => {
    const id = String(project?.subprojectId || '').trim();
    if (id) knownIds.add(id);
  });

  const indexIds = new Set();
  const missing = [];
  indexEntries.forEach((entry) => {
    const id = String(entry?.subprojectId || '').trim();
    if (!id || indexIds.has(id)) return;
    indexIds.add(id);
    if (!knownIds.has(id)) {
      missing.push({
        projectId: String(entry.projectId || '').trim(),
        subprojectId: id,
      });
    }
  });

  const removedIds = [];
  knownIds.forEach((id) => {
    if (!indexIds.has(id)) removedIds.push(id);
  });

  // Άδειο ευρετήριο ενώ η λίστα έχει υποέργα: αποτυχημένη εγγραφή, όχι μαζική διαγραφή.
  // Ο καλών ξαναδιαβάζει τον φάκελο, όπως κάνει και η αρχική λίστα.
  if (indexIds.size === 0 && knownIds.size > 0) {
    return { ok: false, missing: [], removedIds: [], changed: [] };
  }

  const changed = [];
  if (Array.isArray(previousEntries) && previousEntries.length) {
    const diff = diffProjectsIndexEntries(previousEntries, indexEntries);
    diff.changed.forEach((entry) => {
      const id = String(entry?.subprojectId || '').trim();
      if (!id || !knownIds.has(id)) return;
      changed.push({
        projectId: String(entry.projectId || '').trim(),
        subprojectId: id,
      });
    });
  }

  return { ok: true, missing, removedIds, changed };
}

/** Ώρα αρχείου τη στιγμή που διαβάστηκε η λίστα — όχι μια μεταγενέστερη ματιά στο ευρετήριο. */
export function indexBaselineFromProjects(knownProjects) {
  const baseline = [];
  (knownProjects || []).forEach((project) => {
    const id = String(project?.subprojectId || '').trim();
    const mtimeMs = Number(project?.indexMtimeMs);
    if (!id || !Number.isFinite(mtimeMs) || mtimeMs <= 0) return;
    baseline.push({
      projectId: String(project.projectId || '').trim(),
      subprojectId: id,
      mtimeMs,
    });
  });
  return baseline;
}

export function projectHasIndexStamp(project) {
  const stamp = Number(project?.indexMtimeMs);
  return Number.isFinite(stamp) && stamp > 0;
}

export function indexEntryContentIsNewer(entry, project) {
  const stamp = Number(project?.indexMtimeMs);
  if (!project || !Number.isFinite(stamp) || stamp <= 0) return false;
  if (Math.abs(Number(entry?.mtimeMs || 0) - stamp) > INDEX_MTIME_TOLERANCE_MS) return true;
  return String(project.projectId || '') !== String(entry?.projectId || '');
}

/**
 * Υποέργο χωρίς ώρα ανάγνωσης, ενώ η λίστα έχει ήδη ώρες για τα υπόλοιπα.
 * Χωρίς αυτό, μια μεταγενέστερη ματιά στο ευρετήριο «κλείδωνε» τον παλιό τίτλο.
 */
export function indexStampNeedsRead(entry, project, anyKnownStamp) {
  if (!project) return false;
  if (indexEntryContentIsNewer(entry, project)) return true;
  if (!anyKnownStamp) return false;
  return !projectHasIndexStamp(project);
}

/** Γνωστά υποέργα που είναι στο ευρετήριο αλλά δεν έχουν ώρα ανάγνωσης. */
export function unstampedIndexTargets(knownProjects, indexEntries) {
  if (!Array.isArray(indexEntries) || !indexEntries.length) return [];
  const indexById = new Map();
  indexEntries.forEach((entry) => {
    const id = String(entry?.subprojectId || '').trim();
    if (id && !indexById.has(id)) indexById.set(id, entry);
  });
  const targets = [];
  (knownProjects || []).forEach((project) => {
    const id = String(project?.subprojectId || '').trim();
    if (!id || !indexById.has(id) || projectHasIndexStamp(project)) return;
    const entry = indexById.get(id);
    targets.push({
      projectId: String(entry.projectId || project.projectId || '').trim(),
      subprojectId: id,
    });
  });
  return targets;
}

export function appendUnstampedIndexTargets(checks, knownProjects, indexEntries) {
  const list = Array.isArray(checks) ? [...checks] : [];
  const seen = new Set(list.map((item) => String(item?.subprojectId || '').trim()));
  unstampedIndexTargets(knownProjects, indexEntries).forEach((target) => {
    if (!target.subprojectId || seen.has(target.subprojectId)) return;
    seen.add(target.subprojectId);
    list.push(target);
  });
  return list;
}

/**
 * Κλείνει τον συγχρονισμό αφού διαβαστούν τα αμφισβητούμενα αρχεία.
 * «Λείπει από το ευρετήριο» δεν αρκεί για διαγραφή: το αρχείο πρέπει να λείπει κι από τον φάκελο.
 * Σφάλμα ανάγνωσης → ο καλών ξαναφορτώνει όλη τη λίστα.
 *
 * @param {Record<string, { project?: object, missing?: boolean, error?: boolean }>} reads
 */
export function readForIndexAbsence(result) {
  if (!result || result.reachable === false || result.success === false) {
    return { project: { kept: true } };
  }
  if (result.exists) return { project: { kept: true } };
  return { missing: true };
}

/** Ο κοινός φάκελος δεν απάντησε: η φόρμα κρατά τη λίστα που ήδη δείχνει η αρχική. */
export function catalogWhenDiskUnreadable(knownProjects) {
  return Array.isArray(knownProjects) ? knownProjects : [];
}

/**
 * Υποέργα που η αρχική ήδη δείχνει αλλά η πλήρης ανάγνωση δεν τα έφερε.
 * Συμβαίνει όταν η γραμμή τους λείπει από το ευρετήριο ενώ ο φάκελος του έργου είναι ήδη μέσα.
 */
export function knownMissingFromFullLoad(knownProjects, loadedProjects) {
  const loadedIds = new Set();
  (loadedProjects || []).forEach((project) => {
    const id = String(project?.subprojectId || '').trim();
    if (id) loadedIds.add(id);
  });
  const missing = [];
  const seen = new Set();
  (knownProjects || []).forEach((project) => {
    const id = String(project?.subprojectId || '').trim();
    if (!id || loadedIds.has(id) || seen.has(id)) return;
    seen.add(id);
    missing.push(project);
  });
  return missing;
}

export function readResultForCatchUp(result) {
  if (!result) return { error: true };
  if (result.missing) return { missing: true };
  if (result.success && result.project) return { project: result.project };
  return { error: true };
}

export function finishCatalogCatchUp(knownProjects, plan, reads) {
  if (!plan?.ok) return { ok: false, projects: [] };
  const byId = reads || {};
  const loaded = [];

  for (const item of plan.missing || []) {
    const read = byId[item.subprojectId];
    if (!read || read.error) return { ok: false, projects: [] };
    if (read.missing) continue;
    if (read.project) loaded.push(read.project);
  }

  const removedIds = [];
  const replaced = [];
  for (const id of plan.removedIds || []) {
    const read = byId[id];
    if (!read || read.error) return { ok: false, projects: [] };
    if (read.missing) {
      removedIds.push(id);
      continue;
    }
    const freshId = String(read.project?.subprojectId || '').trim();
    if (freshId) replaced.push(read.project);
  }

  for (const item of plan.changed || []) {
    const read = byId[item.subprojectId];
    if (!read || read.error) return { ok: false, projects: [] };
    if (read.missing) {
      removedIds.push(item.subprojectId);
      continue;
    }
    if (read.project) replaced.push(read.project);
  }

  return {
    ok: true,
    projects: applyCatalogCatchUp(knownProjects, { loaded, removedIds, replaced }),
  };
}

export function applyCatalogCatchUp(knownProjects, { loaded = [], removedIds = [], replaced = [] } = {}) {
  const drop = new Set((removedIds || []).map((id) => String(id)));
  const replaceById = new Map();
  (replaced || []).forEach((project) => {
    const id = String(project?.subprojectId || '').trim();
    if (id && !drop.has(id)) replaceById.set(id, project);
  });
  const next = [];
  const seen = new Set();

  (knownProjects || []).forEach((project) => {
    const id = String(project?.subprojectId || '').trim();
    if (!id || drop.has(id) || seen.has(id)) return;
    seen.add(id);
    next.push(replaceById.get(id) || project);
  });

  (loaded || []).forEach((project) => {
    const id = String(project?.subprojectId || '').trim();
    if (!id || drop.has(id) || seen.has(id)) return;
    seen.add(id);
    next.push(project);
  });

  return next;
}
