/**
 * Συγχρονισμός λίστας υποέργων με το ελαφρύ ευρετήριο.
 * Νέα / διαγραμμένα / αλλαγμένα υποέργα εντοπίζονται χωρίς να ξαναδιαβαστούν όλα τα αρχεία.
 * Αν το ευρετήριο λείπει, ο καλών πέφτει σε πλήρη φόρτωση.
 */
import { diffProjectsIndexEntries } from './mergeLoadedSubproject';

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
  for (const id of plan.removedIds || []) {
    const read = byId[id];
    if (!read || read.error) return { ok: false, projects: [] };
    if (read.missing) removedIds.push(id);
  }

  const replaced = [];
  for (const item of plan.changed || []) {
    const read = byId[item.subprojectId];
    if (!read || read.error) continue;
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
